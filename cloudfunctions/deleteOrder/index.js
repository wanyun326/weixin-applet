// 云函数：删除待做订单（仅 pending 可删；物理删除 + 写日志）
const {
  db,
  ok,
  fail,
  assertMember,
  writeLog,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId, orderId } = event;
  if (!orderId) return fail('缺少订单信息');
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
  if (order.status !== 'pending') {
    return fail('正在做或已完成的菜不可删除');
  }

  await db.collection('orders').doc(orderId).remove();

  await writeLog(familyId, order.mealId, {
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
  });

  return ok({ orderId });
});
