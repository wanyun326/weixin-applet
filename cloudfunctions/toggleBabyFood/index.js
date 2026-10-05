// 云函数：开关家庭辅食推荐
const { db, ok, fail, assertMember, handler } = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId } = event;
  await assertMember(familyId, openid);
  const enabled = !!event.enabled;

  await db.collection('families').doc(familyId).update({
    data: { babyFoodEnabled: enabled }
  });

  return ok({ babyFoodEnabled: enabled });
});
