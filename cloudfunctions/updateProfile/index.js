// 云函数：同步当前用户在所有家庭中的成员资料
const { db, ok, fail, handler } = require('./common');

const PAGE_SIZE = 100;

exports.main = handler(async (event, openid) => {
  const nickname = (event.nickname || '').trim();
  const avatar = event.avatar || '';
  if (!nickname) return fail('请填写昵称');
  if (nickname.length > 20) return fail('昵称不能超过 20 个字');
  if (avatar && !/^cloud:\/\//.test(avatar)) {
    return fail('头像必须先上传到云存储');
  }

  let updated = 0;
  for (let skip = 0; skip < 1000; skip += PAGE_SIZE) {
    const res = await db
      .collection('family_members')
      .where({ openid })
      .skip(skip)
      .limit(PAGE_SIZE)
      .get();
    if (!res.data.length) break;

    await Promise.all(
      res.data.map((member) =>
        db.collection('family_members').doc(member._id).update({
          data: { nickname, avatar }
        })
      )
    );
    updated += res.data.length;
    if (res.data.length < PAGE_SIZE) break;
  }

  return ok({ updated, nickname, avatar });
});
