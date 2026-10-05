// 云函数：创建家庭（创建人自动成为成员）
const { db, _, ok, fail, serverDate, handler } = require('./common');

/** 生成唯一邀请码（6 位，去掉易混淆字符） */
async function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const dup = await db.collection('families').where({ inviteCode: code }).count();
    if (dup.total === 0) return code;
  }
  throw new Error('邀请码生成失败，请重试');
}

exports.main = handler(async (event, openid) => {
  const name = (event.name || '').trim();
  if (!name) return fail('请输入家庭名称');
  if (name.length > 20) return fail('家庭名称不能超过 20 个字');

  const nickname = (event.nickname || '').trim() || '成员';
  const avatar = event.avatar || '';
  const inviteCode = await generateInviteCode();
  const now = serverDate();

  const familyAdd = await db.collection('families').add({
    data: {
      name,
      creatorOpenid: openid,
      inviteCode,
      babyFoodEnabled: false,
      // memberOpenids 用于数据库安全规则做成员校验
      memberOpenids: [openid],
      memberCount: 1,
      createdAt: now
    }
  });
  const familyId = familyAdd._id;

  await db.collection('family_members').add({
    data: {
      familyId,
      openid,
      nickname,
      avatar,
      joinedAt: now
    }
  });

  return ok({
    _id: familyId,
    name,
    inviteCode,
    babyFoodEnabled: false,
    creatorOpenid: openid,
    memberCount: 1
  });
});
