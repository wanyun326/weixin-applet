// 云函数：开启当餐（同一家庭同时只允许一个进行中的当餐）
const {
  db,
  ok,
  fail,
  createError,
  getDocOrNull,
  stableDocId,
  serverDate,
  assertMember,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId } = event;
  const member = await assertMember(familyId, openid);

  const active = await db
    .collection('meals')
    .where({ familyId, status: 'active' })
    .count();
  if (active.total > 0) return fail('当前已有进行中的一餐，请先结束它');

  const label = (event.label || '').trim() || '新的一餐';
  if (label.length > 30) return fail('餐次名称不能超过 30 个字');
  const mealId = stableDocId('meal', [
    familyId,
    Date.now(),
    Math.random()
  ]);
  const now = serverDate();

  // family.activeMealId 作为家庭级锁，重复点击或并发请求只能有一个成功。
  await db.runTransaction(async (transaction) => {
    const family = await getDocOrNull(
      transaction.collection('families'),
      familyId
    );
    if (!family) throw createError('家庭不存在', 404);

    if (family.activeMealId) {
      const currentMeal = await getDocOrNull(
        transaction.collection('meals'),
        family.activeMealId
      );
      if (currentMeal && currentMeal.status === 'active') {
        throw createError('当前已有进行中的一餐，请先结束它', 409);
      }
    }

    await transaction.collection('meals').doc(mealId).set({
      data: {
        familyId,
        label,
        status: 'active',
        createdBy: openid,
        createdByName: member.nickname || '成员',
        createdAt: now,
        closedBy: '',
        closedByName: '',
        closedAt: null
      }
    });
    await transaction.collection('families').doc(familyId).update({
      data: {
        activeMealId: mealId,
        activeMealLabel: label
      }
    });
  });

  return ok({
    _id: mealId,
    familyId,
    label,
    status: 'active'
  });
});
