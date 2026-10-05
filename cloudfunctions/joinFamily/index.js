// 云函数：通过邀请码加入家庭
const { db, _, ok, fail, serverDate, handler } = require('./common');

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
  if ((family.memberOpenids || []).includes(openid)) {
    return fail('你已经是该家庭成员');
  }

  const nickname = (event.nickname || '').trim() || '成员';
  const now = serverDate();

  await db.collection('family_members').add({
    data: {
      familyId: family._id,
      openid,
      nickname,
      avatar: event.avatar || '',
      joinedAt: now
    }
  });

  await db.collection('families').doc(family._id).update({
    data: {
      memberOpenids: _.addToSet(openid),
      memberCount: _.inc(1)
    }
  });

  return ok({
    _id: family._id,
    name: family.name,
    inviteCode: family.inviteCode,
    babyFoodEnabled: !!family.babyFoodEnabled,
    creatorOpenid: family.creatorOpenid,
    memberCount: (family.memberCount || 0) + 1
  });
});
