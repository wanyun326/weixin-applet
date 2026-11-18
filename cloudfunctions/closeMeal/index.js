// 云函数：结束当餐（结束后订单冻结，不可再操作）
const {
  db,
  ok,
  fail,
  createError,
  getDocOrNull,
  getFamilyMeal,
  serverDate,
  assertMember,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId, mealId } = event;
  if (!mealId) return fail('缺少当餐信息');
  const member = await assertMember(familyId, openid);
  const postNote = String(event.postNote || '').trim().slice(0, 500);
  const photoFileIDs = Array.isArray(event.photoFileIDs)
    ? event.photoFileIDs
        .filter((fileID) => /^cloud:\/\//.test(fileID || ''))
        .filter((fileID, index, list) => list.indexOf(fileID) === index)
        .slice(0, 9)
    : [];

  await db.runTransaction(async (transaction) => {
    const meal = await getFamilyMeal(familyId, mealId, {
      requireActive: true,
      source: transaction
    });
    const family = await getDocOrNull(
      transaction.collection('families'),
      familyId
    );
    if (!family) throw createError('家庭不存在', 404);

    await transaction.collection('meals').doc(mealId).update({
      data: {
        status: 'closed',
        closedBy: openid,
        closedByName: member.nickname || '成员',
        closedAt: serverDate(),
        postNote,
        photoFileIDs,
        recordedBy: openid,
        recordedByName: member.nickname || '成员',
        recordedAt: serverDate()
      }
    });
    if (family.activeMealId === mealId) {
      await transaction.collection('families').doc(familyId).update({
        data: {
          activeMealId: '',
          activeMealLabel: ''
        }
      });
    }
    return meal;
  });

  return ok({ mealId, postNote, photoFileIDs });
});
