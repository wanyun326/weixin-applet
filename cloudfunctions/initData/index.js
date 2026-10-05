// 云函数：初始化数据库（写入预设菜品库 / 辅食库 / 索引提示）
// 使用方式：微信开发者工具「云函数 -> initData -> 云端测试」传入 {} 或 { "reset": true }
// reset=true 会先清空这两个集合再写入（谨慎使用）。
const { db, ok, handler } = require('./common');

const DISHES = require('./data/dishes');
const BABY_FOODS = require('./data/babyFoods');

/** 清空集合（分批删除，绕开单次 20 条限制） */
async function clearCollection(name) {
  let removed = 0;
  for (let guard = 0; guard < 200; guard += 1) {
    const res = await db.collection(name).limit(100).get();
    if (!res.data.length) break;
    await Promise.all(res.data.map((doc) => db.collection(name).doc(doc._id).remove()));
    removed += res.data.length;
  }
  return removed;
}

async function seed(name, list) {
  // 用 name 作为幂等键，已存在同名则不重复插入
  const existing = await db.collection(name).field({ name: true }).limit(1000).get();
  const names = new Set(existing.data.map((d) => d.name));
  const toInsert = list.filter((item) => !names.has(item.name));
  for (const item of toInsert) {
    // eslint-disable-next-line no-await-in-loop
    await db.collection(name).add({ data: item });
  }
  return toInsert.length;
}

exports.main = handler(async (event) => {
  const reset = !!event.reset;
  let clearedDishes = 0;
  let clearedFoods = 0;
  if (reset) {
    clearedDishes = await clearCollection('dishes');
    clearedFoods = await clearCollection('baby_foods');
  }

  const dishesInserted = await seed('dishes', DISHES);
  const foodsInserted = await seed('baby_foods', BABY_FOODS);

  return ok({
    reset,
    clearedDishes,
    clearedFoods,
    dishesInserted,
    foodsInserted
  });
});
