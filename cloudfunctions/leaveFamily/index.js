// 云函数：退出家庭（创建人不可退出）
const {
  db,
  ok,
  fail,
  createError,
  getDocOrNull,
  getFamily,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId } = event;
  if (!familyId) return fail('缺少家庭信息');

  const family = await getFamily(familyId);
  if (family.creatorOpenid === openid) {
    return fail('创建人不能退出家庭');
  }

  const memberRes = await db
    .collection('family_members')
    .where({ familyId, openid })
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
    if (!currentMembers.includes(openid)) return 0;

    for (const memberId of memberIds) {
      // eslint-disable-next-line no-await-in-loop
      await transaction
        .collection('family_members')
        .doc(memberId)
        .remove();
    }
    const nextMembers = currentMembers.filter((item) => item !== openid);
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
