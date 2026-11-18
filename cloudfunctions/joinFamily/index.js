// 云函数：通过邀请码加入家庭
const {
  db,
  ok,
  fail,
  createError,
  getDocOrNull,
  stableDocId,
  serverDate,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const code = (event.inviteCode || '').trim().toUpperCase();
  if (!code) return fail('请输入邀请码');

  const res = await db
    .collection('families')
    .where({ inviteCode: code })
    .limit(1)
    .get();
  if (!res.data.length) return fail('邀请码无效，请检查后重试');

  const family = res.data[0];
  const nickname = (event.nickname || '').trim() || '成员';
  const now = serverDate();
  const memberId = stableDocId('member', [family._id, openid]);

  // 以家庭文档为并发锁，确保同一用户不会因重复点击或并发邀请写入两条成员记录。
  const result = await db.runTransaction(async (transaction) => {
    const currentFamily = await getDocOrNull(
      transaction.collection('families'),
      family._id
    );
    if (!currentFamily) throw createError('家庭不存在', 404);
    const currentMembers = currentFamily.memberOpenids || [];
    if (currentMembers.includes(openid)) {
      throw createError('你已经是该家庭成员', 2);
    }

    const existingMember = await getDocOrNull(
      transaction.collection('family_members'),
      memberId
    );
    if (existingMember) throw createError('你已经是该家庭成员', 2);

    await transaction.collection('family_members').doc(memberId).set({
      data: {
        familyId: family._id,
        openid,
        nickname,
        avatar: event.avatar || '',
        joinedAt: now
      }
    });
    const nextMembers = currentMembers.concat(openid);
    await transaction.collection('families').doc(family._id).update({
      data: {
        memberOpenids: nextMembers,
        memberCount: nextMembers.length
      }
    });
    return {
      memberCount: nextMembers.length,
      babyFoodEnabled: !!currentFamily.babyFoodEnabled,
      name: currentFamily.name,
      inviteCode: currentFamily.inviteCode,
      creatorOpenid: currentFamily.creatorOpenid
    };
  });

  return ok({
    _id: family._id,
    name: result.name,
    inviteCode: result.inviteCode,
    babyFoodEnabled: result.babyFoodEnabled,
    creatorOpenid: result.creatorOpenid,
    memberCount: result.memberCount
  });
});
