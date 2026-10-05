// 云函数：订单状态流转（pending -> cooking -> done，单向不可逆）+ 写日志
const {
  db,
  ok,
  fail,
  serverDate,
  assertMember,
  writeLog,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId, orderId, action } = event;
  if (!orderId || !action) return fail('参数不完整');
  const member = await assertMember(familyId, openid);
  const operatorName = member.nickname || '成员';
  const operatorAvatar = member.avatar || '';

  const orderRes = await db
    .collection('orders')
    .doc(orderId)
    .get()
    .catch(() => null);
  if (!orderRes || !orderRes.data) return fail('订单不存在');
  const order = orderRes.data;
  if (order.familyId !== familyId) return fail('无权操作该订单');

  // 当餐已结束则订单冻结
  const meal = await db
    .collection('meals')
    .doc(order.mealId)
    .get()
    .catch(() => null);
  if (meal && meal.data && meal.data.status !== 'active') {
    return fail('这一餐已结束，不能再操作');
  }

  let updateData = {};
  let statusBefore = '';

  if (action === 'start') {
    if (order.status !== 'pending') return fail('只有待做的菜可以开始做');
    statusBefore = 'pending';
    updateData = {
      status: 'cooking',
      cookingBy: openid,
      cookingByName: operatorName,
      updatedAt: serverDate()
    };
  } else if (action === 'done') {
    if (order.status !== 'cooking') return fail('只有正在做的菜可以标记完成');
    statusBefore = 'cooking';
    updateData = {
      status: 'done',
      doneBy: openid,
      doneByName: operatorName,
      updatedAt: serverDate()
    };
  } else {
    return fail('不支持的操作');
  }

  await db.collection('orders').doc(orderId).update({ data: updateData });

  await writeLog(familyId, order.mealId, {
    orderId,
    action,
    dishId: order.dishId,
    dishName: order.dishName,
    orderedBy: order.orderedBy,
    orderedByName: order.orderedByName,
    orderStatusBefore: statusBefore,
    operatorOpenid: openid,
    operatorName,
    operatorAvatar
  });

  return ok({ orderId, status: updateData.status });
});
