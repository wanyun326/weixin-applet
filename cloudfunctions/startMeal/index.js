// 云函数：开启当餐（同一家庭同时只允许一个进行中的当餐）
const { db, ok, fail, serverDate, assertMember, handler } = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId } = event;
  const member = await assertMember(familyId, openid);

  const active = await db
    .collection('meals')
    .where({ familyId, status: 'active' })
    .count();
  if (active.total > 0) return fail('当前已有进行中的一餐，请先结束它');

  const label = (event.label || '').trim() || '新的一餐';
  const add = await db.collection('meals').add({
    data: {
      familyId,
      label,
      status: 'active',
      createdBy: openid,
      createdByName: member.nickname || '成员',
      createdAt: serverDate(),
      closedBy: '',
      closedAt: null
    }
  });

  return ok({
    _id: add._id,
    familyId,
    label,
    status: 'active'
  });
});
