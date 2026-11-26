// 云函数：把菜品标记为已准备；兼容历史 cooking/done 状态和旧客户端动作
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
  const { familyId, orderId, action } = event;
  if (!orderId || !action) return fail('参数不完整');
  const member = await assertMember(familyId, openid);
  const operatorName = member.nickname || '成员';
  const operatorAvatar = member.avatar || '';
  const logId = stableDocId('log', [
    orderId,
    openid,
    action,
    Date.now()
  ]);
  let nextStatus = '';

  // 订单状态、当餐冻结校验和操作日志放在同一事务中，避免半成功。
  await db.runTransaction(async (transaction) => {
    const order = await getDocOrNull(
      transaction.collection('orders'),
      orderId
    );
    if (!order) throw createError('订单不存在', 404);
    if (order.familyId !== familyId) {
      throw createError('无权操作该订单', 403);
    }
    await getFamilyMeal(familyId, order.mealId, {
      requireActive: true,
      source: transaction
    });

    let updateData = {};
    let statusBefore = '';
    if (action === 'prepare') {
      if (order.status === 'prepared' || order.status === 'done') {
        throw createError('这道菜已经准备好了', 409);
      }
      statusBefore = order.status;
      nextStatus = 'prepared';
      updateData = {
        status: nextStatus,
        preparedBy: openid,
        preparedByName: operatorName,
        preparedAt: serverDate(),
        updatedAt: serverDate()
      };
    } else if (action === 'start') {
      if (order.status !== 'pending') {
        throw createError('只有待准备的菜可以开始准备', 409);
      }
      statusBefore = 'pending';
      nextStatus = 'cooking';
      updateData = {
        status: nextStatus,
        cookingBy: openid,
        cookingByName: operatorName,
        updatedAt: serverDate()
      };
    } else if (action === 'done') {
      if (order.status !== 'cooking' && order.status !== 'pending') {
        throw createError('这道菜已经准备好了', 409);
      }
      statusBefore = order.status;
      nextStatus = 'done';
      updateData = {
        status: nextStatus,
        doneBy: openid,
        doneByName: operatorName,
        updatedAt: serverDate()
      };
    } else {
      throw createError('不支持的操作', 400);
    }

    await transaction
      .collection('orders')
      .doc(orderId)
      .update({ data: updateData });
    await transaction.collection('operation_logs').doc(logId).set({
      data: buildLogData(familyId, order.mealId, {
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
      })
    });
  });

  return ok({ orderId, status: nextStatus });
});
