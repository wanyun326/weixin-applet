// 云函数：登录，返回当前用户 openid
const { db, ok, handler } = require('./common');

async function listAllFamilies() {
  const result = [];
  for (let skip = 0; skip < 500; skip += 100) {
    // eslint-disable-next-line no-await-in-loop
    const res = await db.collection('families').skip(skip).limit(100).get();
    result.push(...res.data);
    if (res.data.length < 100) break;
  }
  return result;
}

exports.main = handler(async (event, openid, wxContext) => {
  // 家庭文档中的 memberOpenids 是安全规则和成员关系的权威来源。
  // 即使历史 family_members 记录缺失，也不会导致家庭列表消失。
  const allFamilies = await listAllFamilies();
  const families = allFamilies
    .filter(
      (family) =>
        family.creatorOpenid === openid ||
        (family.memberOpenids || []).includes(openid)
    )
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

  return ok({
    openid,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || '',
    families
  });
});
