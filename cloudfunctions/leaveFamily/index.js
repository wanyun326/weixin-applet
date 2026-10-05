// 云函数：退出家庭（创建人不可退出）
const { db, _, ok, fail, getFamily, handler } = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId } = event;
  if (!familyId) return fail('缺少家庭信息');

  const family = await getFamily(familyId);
  if (family.creatorOpenid === openid) {
    return fail('创建人不能退出家庭');
  }

  const del = await db
    .collection('family_members')
    .where({ familyId, openid })
    .remove();
  const removed = del.stats ? del.stats.removed : 0;

  if (removed > 0) {
    await db.collection('families').doc(familyId).update({
      data: {
        memberOpenids: _.pull(openid),
        memberCount: _.inc(-removed)
      }
    });
  }

  return ok({ removed });
});
