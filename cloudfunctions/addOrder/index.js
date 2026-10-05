// 云函数：点菜（校验当餐进行中；同一人重复点同一道菜合并数量）+ 写日志
const {
  db,
  _,
  ok,
  fail,
  serverDate,
  assertMember,
  writeLog,
  handler
} = require('./common');

exports.main = handler(async (event, openid) => {
  const { familyId, mealId, dishId } = event;
  if (!mealId || !dishId) return fail('参数不完整');
  const member = await assertMember(familyId, openid);
  const operatorName = member.nickname || '成员';
  const operatorAvatar = member.avatar || '';

  const meal = await db.collection('meals').doc(mealId).get().catch(() => null);
  if (!meal || !meal.data) return fail('当餐不存在');
  if (meal.data.status !== 'active') return fail('这一餐已结束，不能再点菜');

  const dishRes = await db.collection('dishes').doc(dishId).get().catch(() => null);
  if (!dishRes || !dishRes.data) return fail('菜品不存在');
  const dish = dishRes.data;

  // 同一人、同一餐、同一道菜、仍处于待做：合并数量
  const existing = await db
    .collection('orders')
    .where({ familyId, mealId, dishId, orderedBy: openid, status: 'pending' })
    .limit(1)
    .get();

  let orderId;
  if (existing.data.length) {
    orderId = existing.data[0]._id;
    await db.collection('orders').doc(orderId).update({
      data: { quantity: _.inc(1), updatedAt: serverDate() }
    });
  } else {
    const add = await db.collection('orders').add({
      data: {
        familyId,
        mealId,
        dishId,
        dishName: dish.name,
        dishImage: dish.imageUrl,
        orderedBy: openid,
        orderedByName: operatorName,
        quantity: 1,
        status: 'pending',
        cookingBy: '',
        cookingByName: '',
        doneBy: '',
        doneByName: '',
        createdAt: serverDate(),
        updatedAt: serverDate()
      }
    });
    orderId = add._id;
  }

  await writeLog(familyId, mealId, {
    orderId,
    action: 'add',
    dishId,
    dishName: dish.name,
    orderedBy: openid,
    orderedByName: operatorName,
    orderStatusBefore: 'pending',
    operatorOpenid: openid,
    operatorName,
    operatorAvatar
  });

  return ok({ orderId });
});
