// 云函数：登录，返回当前用户 openid
const { db, _, ok, handler } = require('./common');

exports.main = handler(async (event, openid, wxContext) => {
  // 家庭列表由服务端查询，避免客户端安全规则配置差异导致“刚创建就看不到”。
  const memberRes = await db
    .collection('family_members')
    .where({ openid })
    .limit(100)
    .get();
  const familyIds = [];
  memberRes.data.forEach((member) => {
    if (member.familyId && !familyIds.includes(member.familyId)) {
      familyIds.push(member.familyId);
    }
  });

  let families = [];
  if (familyIds.length) {
    const familyRes = await db
      .collection('families')
      .where({ _id: _.in(familyIds) })
      .limit(100)
      .get();
    families = familyRes.data
      .map((family) => ({
        _id: family._id,
        name: family.name,
        creatorOpenid: family.creatorOpenid,
        memberCount: family.memberCount || 1,
        babyFoodEnabled: !!family.babyFoodEnabled,
        createdAt: family.createdAt
      }))
      .sort(
        (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
      );
  }

  return ok({
    openid,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || '',
    families
  });
});
