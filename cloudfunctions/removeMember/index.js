// 云函数：创建人移出成员
const { db, _, ok, fail, assertCreator, handler } = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId, memberOpenid } = event;
  if (!familyId || !memberOpenid) return fail('参数不完整');

  await assertCreator(familyId, openid);
  if (memberOpenid === openid) return fail('不能移出自己');

  const del = await db
    .collection('family_members')
    .where({ familyId, openid: memberOpenid })
    .remove();
  const removed = del.stats ? del.stats.removed : 0;

  if (removed > 0) {
    await db.collection('families').doc(familyId).update({
      data: {
        memberOpenids: _.pull(memberOpenid),
        memberCount: _.inc(-removed)
      }
    });
  }

  return ok({ removed });
});
