// 云函数：删除待做订单（仅 pending 可删；物理删除 + 写日志）
const {
  db,
  ok,
  fail,
  createError,
  getDocOrNull,
  getFamilyMeal,
  stableDocId,
  assertMember,
  buildLogData,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId, orderId } = event;
  if (!orderId) return fail('缺少订单信息');
  const member = await assertMember(familyId, openid);
  const operatorName = member.nickname || '成员';
  const operatorAvatar = member.avatar || '';
  const logId = stableDocId('log', [
    orderId,
    openid,
    'delete',
    Date.now()
  ]);

  await db.runTransaction(async (transaction) => {
    const order = await getDocOrNull(
      transaction.collection('orders'),
      orderId
    );
    if (!order) throw createError('订单不存在', 404);
    if (order.familyId !== familyId) {
      throw createError('无权操作该订单', 403);
    }
    if (order.status !== 'pending') {
      throw createError('正在做或已完成的菜不可删除', 409);
    }

    // 当餐已结束时所有订单冻结，必须在删除前再次校验。
    await getFamilyMeal(familyId, order.mealId, {
      requireActive: true,
      source: transaction
    });
    await transaction.collection('orders').doc(orderId).remove();
    await transaction.collection('operation_logs').doc(logId).set({
      data: buildLogData(familyId, order.mealId, {
        orderId,
        action: 'delete',
        dishId: order.dishId,
        dishName: order.dishName,
        orderedBy: order.orderedBy,
        orderedByName: order.orderedByName,
        orderStatusBefore: 'pending',
        operatorOpenid: openid,
        operatorName,
        operatorAvatar
      })
    });
  });

  return ok({ orderId });
});
