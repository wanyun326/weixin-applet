// 云函数：家庭自定义辅食的增 / 改 / 删（仅本家庭可见）
const {
  db,
  ok,
  fail,
  serverDate,
  assertMember,
  handler
} = require('./common');

const CATEGORIES = ['早餐', '午餐', '晚餐', '加餐'];

exports.main = handler(async (event, openid) => {
  const { familyId, action = 'add' } = event;
  await assertMember(familyId, openid);

  if (action === 'add') {
    const food = event.food || {};
    if (!food.name || !food.name.trim()) return fail('请填写辅食名称');
    if (!CATEGORIES.includes(food.category)) return fail('辅食分类不正确');
    const minMonth = Number(food.minMonth) || 0;
    const maxMonth = Number(food.maxMonth) || 36;
    if (maxMonth < minMonth) return fail('最大月龄不能小于最小月龄');

    const add = await db.collection('baby_foods').add({
      data: {
        name: food.name.trim(),
        imageUrl: food.imageUrl || '/images/babyfood/custom.png',
        minMonth,
        maxMonth,
        category: food.category,
        ingredients: Array.isArray(food.ingredients) ? food.ingredients : [],
        steps: Array.isArray(food.steps) ? food.steps : [],
        nutrition: food.nutrition || '',
        isCustom: true,
        familyId,
        createdBy: openid,
        createdAt: serverDate()
      }
    });
    return ok({ _id: add._id });
  }

  const foodId = event.foodId;
  if (!foodId) return fail('缺少辅食 ID');
  const res = await db.collection('baby_foods').doc(foodId).get().catch(() => null);
  if (!res || !res.data) return fail('辅食不存在');
  const food = res.data;
  if (!food.isCustom || food.familyId !== familyId) {
    return fail('只能修改本家庭自定义的辅食');
  }

  if (action === 'update') {
    const patch = event.food || {};
    const data = {};
    ['name', 'imageUrl', 'category', 'nutrition'].forEach((key) => {
      if (patch[key] !== undefined) data[key] = patch[key];
    });
    if (patch.minMonth !== undefined) data.minMonth = Number(patch.minMonth) || 0;
    if (patch.maxMonth !== undefined) data.maxMonth = Number(patch.maxMonth) || 36;
    if (Array.isArray(patch.ingredients)) data.ingredients = patch.ingredients;
    if (Array.isArray(patch.steps)) data.steps = patch.steps;
    await db.collection('baby_foods').doc(foodId).update({ data });
    return ok({ _id: foodId });
  }

  if (action === 'delete') {
    await db.collection('baby_foods').doc(foodId).remove();
    return ok({ _id: foodId });
  }

  return fail('不支持的操作');
});
