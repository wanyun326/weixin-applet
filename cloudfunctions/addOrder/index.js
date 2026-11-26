// 云函数：点菜、读取本餐订单与操作记录（同餐同菜只能点一次）
const {
  db,
  ok,
  fail,
  createError,
  getDocOrNull,
  getFamilyMeal,
  stableDocId,
  serverDate,
  assertMember,
  buildLogData,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId, mealId, dishId, action } = event;
  if (!familyId || !mealId) return fail('参数不完整');
  const member = await assertMember(familyId, openid);
  const operatorName = member.nickname || '成员';
  const operatorAvatar = member.avatar || '';

  if (action === 'list') {
    await getFamilyMeal(familyId, mealId);
    const orderRes = await db
      .collection('orders')
      .where({ familyId, mealId })
      .limit(1000)
      .get();
    const dishIds = [];
    orderRes.data.forEach((order) => {
      if (order.dishId && dishIds.indexOf(order.dishId) === -1) {
        dishIds.push(order.dishId);
      }
    });
    return ok({
      dishIds,
      orders: orderRes.data.map((order) => ({
        _id: order._id,
        dishId: order.dishId,
        dishName: order.dishName,
        dishImage: order.dishImage,
        status: order.status,
        orderedByName: order.orderedByName,
        cookingBy: order.cookingBy || '',
        cookingByName: order.cookingByName || '',
        doneBy: order.doneBy || '',
        doneByName: order.doneByName || '',
        preparedBy: order.preparedBy || '',
        preparedByName: order.preparedByName || '',
        preparedAt: order.preparedAt || null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }))
    });
  }

  if (action === 'logs') {
    await getFamilyMeal(familyId, mealId);
    const logRes = await db
      .collection('operation_logs')
      .where({ familyId, mealId })
      .limit(500)
      .get();
    return ok({
      logs: logRes.data.map((log) => ({
        _id: log._id,
        action: log.action,
        dishName: log.dishName,
        orderedByName: log.orderedByName,
        orderStatusBefore: log.orderStatusBefore,
        operatorName: log.operatorName,
        operatorAvatar: log.operatorAvatar,
        createdAt: log.createdAt
      }))
    });
  }

  if (!dishId) return fail('参数不完整');

  await getFamilyMeal(familyId, mealId, {
    requireActive: true
  });
  const legacyExisting = await db
    .collection('orders')
    .where({ familyId, mealId, dishId })
    .limit(1)
    .get();

  if (legacyExisting.data.length) {
    return fail('这道菜已经点过了', 2);
  }

  const orderId = stableDocId('order', [familyId, mealId, dishId]);
  const logId = stableDocId('log', [orderId, openid, Date.now()]);
  const now = serverDate();
  const order = {
    familyId,
    mealId,
    dishId,
    dishName: '',
    dishImage: '',
    orderedBy: openid,
    orderedByName: operatorName,
    quantity: 1,
    status: 'pending',
    preparedBy: '',
    preparedByName: '',
    preparedAt: null,
    cookingBy: '',
    cookingByName: '',
    doneBy: '',
    doneByName: '',
    createdAt: now,
    updatedAt: now
  };

  const log = buildLogData(familyId, mealId, {
    orderId,
    action: 'add',
    dishId,
    dishName: '',
    orderedBy: openid,
    orderedByName: operatorName,
    orderStatusBefore: 'pending',
    operatorOpenid: openid,
    operatorName,
    operatorAvatar
  });

  // 确定性订单 ID 与事务共同兜底：并发点同一道菜只会成功一次。
  await db.runTransaction(async (transaction) => {
    await getFamilyMeal(familyId, mealId, {
      requireActive: true,
      source: transaction
    });
    const dish = await getDocOrNull(
      transaction.collection('dishes'),
      dishId
    );
    if (!dish) throw createError('菜品不存在', 404);

    const existing = await getDocOrNull(
      transaction.collection('orders'),
      orderId
    );
    if (existing) throw createError('这道菜已经点过了', 2);

    order.dishName = dish.name;
    order.dishImage = dish.imageUrl;
    log.dishName = dish.name;
    await transaction.collection('orders').doc(orderId).set({
      data: order
    });
    await transaction.collection('operation_logs').doc(logId).set({
      data: log
    });
  });

  return ok({
    orderId,
    dishId,
    dishName: order.dishName,
    dishImage: order.dishImage,
    status: 'pending'
  });
});
