// 云函数：创建人移出成员
const {
  db,
  ok,
  fail,
  createError,
  getDocOrNull,
  assertCreator,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId, memberOpenid } = event;
  if (!familyId || !memberOpenid) return fail('参数不完整');

  await assertCreator(familyId, openid);
  if (memberOpenid === openid) return fail('不能移出自己');

  const memberRes = await db
    .collection('family_members')
    .where({ familyId, openid: memberOpenid })
    .limit(20)
    .get();
  const memberIds = memberRes.data.map((member) => member._id);

  const removed = await db.runTransaction(async (transaction) => {
    const currentFamily = await getDocOrNull(
      transaction.collection('families'),
      familyId
    );
    if (!currentFamily) throw createError('家庭不存在', 404);
    const currentMembers = currentFamily.memberOpenids || [];
    if (!currentMembers.includes(memberOpenid)) return 0;

    for (const memberId of memberIds) {
      // eslint-disable-next-line no-await-in-loop
      await transaction
        .collection('family_members')
        .doc(memberId)
        .remove();
    }
    const nextMembers = currentMembers.filter((item) => item !== memberOpenid);
    await transaction.collection('families').doc(familyId).update({
      data: {
        memberOpenids: nextMembers,
        memberCount: nextMembers.length
      }
    });
    return memberIds.length;
  });

  return ok({ removed });
});
