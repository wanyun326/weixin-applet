// 云函数：结束当餐（结束后订单冻结，不可再操作）
const { db, ok, fail, serverDate, assertMember, handler } = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId, mealId } = event;
  if (!mealId) return fail('缺少当餐信息');
  const member = await assertMember(familyId, openid);

  const meal = await db.collection('meals').doc(mealId).get().catch(() => null);
  if (!meal || !meal.data) return fail('当餐不存在');
  if (meal.data.status !== 'active') return fail('这一餐已经结束了');

  await db.collection('meals').doc(mealId).update({
    data: {
      status: 'closed',
      closedBy: openid,
      closedByName: member.nickname || '成员',
      closedAt: serverDate()
    }
  });

  return ok({ mealId });
});
