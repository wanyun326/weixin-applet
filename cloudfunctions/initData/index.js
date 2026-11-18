// 云函数：初始化数据库（写入预设菜品库 / 辅食库 / 索引提示）
// 使用方式：微信开发者工具「云函数 -> initData -> 云端测试」传入 {} 或 { "reset": true }
// reset=true 会重建内置菜品与内置辅食，但保留家庭自定义辅食。
const { db, ok, stableDocId, assertAdmin, handler } = require('./common');

const DISHES = require('./data/dishes');
const BABY_FOODS = require('./data/babyFoods');

const COLLECTIONS = [
  'families',
  'family_members',
  'meals',
  'dishes',
  'dish_overrides',
  'orders',
  'operation_logs',
  'babies',
  'baby_foods'
];

function getErrorText(err) {
  return [
    err && err.errCode,
    err && err.errMsg,
    err && err.message
  ]
    .filter(Boolean)
    .join(' ');
}

function isCollectionMissing(err) {
  const text = getErrorText(err);
  return (
    Number(err && err.errCode) === -502005 ||
    /DATABASE_COLLECTION_NOT_EXIST|ResourceNotFound|Db or Table not exist|collection.*not exists/i.test(
      text
    )
  );
}

function isCollectionExists(err) {
  if (isCollectionMissing(err)) return false;
  return /already exists|collection.*exist|exist.*collection/i.test(
    getErrorText(err)
  );
}

async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get();
    return false;
  } catch (err) {
    if (!isCollectionMissing(err)) throw err;
  }

  try {
    await db.createCollection(name);
    return true;
  } catch (err) {
    if (isCollectionExists(err)) return false;
    throw err;
  }
}

async function ensureCollections() {
  if (typeof db.createCollection !== 'function') {
    throw new Error('当前云函数 SDK 不支持自动创建集合，请升级 wx-server-sdk');
  }

  const results = await Promise.all(
    COLLECTIONS.map(async (name) => ({
      name,
      created: await ensureCollection(name)
    }))
  );
  return results.filter((item) => item.created).map((item) => item.name);
}

/** 清空集合（分批删除，绕开单次 20 条限制） */
async function clearCollection(name, where = null) {
  let removed = 0;
  for (let guard = 0; guard < 200; guard += 1) {
    let query = db.collection(name);
    if (where) query = query.where(where);
    const res = await query.limit(100).get();
    if (!res.data.length) break;
    await Promise.all(res.data.map((doc) => db.collection(name).doc(doc._id).remove()));
    removed += res.data.length;
  }
  return removed;
}

/** 重置时只清理内置菜，保留所有家庭自定义菜品 */
async function clearBuiltInDishes() {
  const documents = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    // eslint-disable-next-line no-await-in-loop
    const res = await db.collection('dishes').skip(skip).limit(100).get();
    documents.push(...res.data);
    if (res.data.length < 100) break;
  }
  const builtIns = documents.filter((dish) => !dish.isCustom);
  await Promise.all(
    builtIns.map((dish) => db.collection('dishes').doc(dish._id).remove())
  );
  return builtIns.length;
}

const INSERT_BATCH_SIZE = 20;

async function seed(name, list) {
  // 用 name 作为幂等键，已存在同名则不重复插入
  const existing = await db.collection(name).field({ name: true }).limit(1000).get();
  const names = new Set(existing.data.map((d) => d.name));
  const toInsert = list.filter((item) => !names.has(item.name));
  const batches = [];
  for (let offset = 0; offset < toInsert.length; offset += INSERT_BATCH_SIZE) {
    batches.push(toInsert.slice(offset, offset + INSERT_BATCH_SIZE));
  }
  await Promise.all(
    batches.map((batch) => db.collection(name).add({ data: batch }))
  );
  return toInsert.length;
}

/** 内置菜使用稳定 ID，保证同步预设后家庭图片覆盖仍然关联正确 */
async function seedDishes(list) {
  const existing = await db
    .collection('dishes')
    .field({ name: true })
    .limit(1000)
    .get();
  const names = new Set(existing.data.map((dish) => dish.name));
  const toInsert = list.filter((item) => !names.has(item.name));
  await Promise.all(
    toInsert.map((dish) => {
      const dishId = stableDocId('dish', [dish.name]);
      return db.collection('dishes').doc(dishId).set({ data: dish });
    })
  );
  return toInsert.length;
}

exports.main = handler(async (event, openid) => {
  assertAdmin(openid);
  const reset = !!event.reset;
  const createdCollections = await ensureCollections();
  let clearedDishes = 0;
  let clearedFoods = 0;
  if (reset) {
    clearedDishes = await clearBuiltInDishes();
    // 重置只清理内置辅食，绝不能删除家庭自定义内容。
    clearedFoods = await clearCollection('baby_foods', { isCustom: false });
  }

  const [dishesInserted, foodsInserted] = await Promise.all([
    seedDishes(DISHES),
    seed('baby_foods', BABY_FOODS)
  ]);

  return ok({
    reset,
    createdCollections,
    clearedDishes,
    clearedFoods,
    dishesInserted,
    foodsInserted
  });
});
