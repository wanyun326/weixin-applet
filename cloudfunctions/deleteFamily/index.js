// 云函数：创建人解散家庭，并清理该家庭的关联数据
const {
  cloud,
  db,
  ok,
  fail,
  createError,
  getFamily,
  handler
} = require('./common');

const RELATED_COLLECTIONS = [
  'family_members',
  'meals',
  'orders',
  'operation_logs',
  'babies',
  'baby_foods',
  'dishes',
  'dish_overrides'
];

function isCollectionMissing(err) {
  return /DATABASE_COLLECTION_NOT_EXIST|Db or Table not exist|collection.*not exists/i.test(
    [err && err.errCode, err && err.errMsg, err && err.message]
      .filter(Boolean)
      .join(' ')
  );
}

/** 分批删除某家庭下的所有关联文档，兼容云数据库单次返回数量限制 */
async function removeFamilyDocuments(collectionName, familyId) {
  let removed = 0;
  for (let guard = 0; guard < 200; guard += 1) {
    let res;
    try {
      // eslint-disable-next-line no-await-in-loop
      res = await db
        .collection(collectionName)
        .where({ familyId })
        .limit(100)
        .get();
    } catch (err) {
      if (isCollectionMissing(err)) return removed;
      throw err;
    }
    if (!res.data.length) break;

    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      res.data.map((document) =>
        db.collection(collectionName).doc(document._id).remove()
      )
    );
    removed += res.data.length;
  }
  return removed;
}

async function cleanupDishImages(familyId) {
  const dishes = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    // eslint-disable-next-line no-await-in-loop
    const dishRes = await db
      .collection('dishes')
      .where({ familyId })
      .skip(skip)
      .limit(100)
      .get();
    dishes.push(...dishRes.data);
    if (dishRes.data.length < 100) break;
  }
  const fileList = dishes
    .map((dish) => dish.imageUrl)
    .filter((imageUrl) => /^cloud:\/\//.test(imageUrl || ''));
  await deleteCloudFiles(fileList);
}

async function deleteCloudFiles(fileList) {
  if (!fileList.length) return;
  try {
    for (let index = 0; index < fileList.length; index += 50) {
      // eslint-disable-next-line no-await-in-loop
      await cloud.deleteFile({
        fileList: fileList.slice(index, index + 50)
      });
    }
  } catch (err) {
    console.warn('清理解散家庭的云存储图片失败', err);
  }
}

async function cleanupMealImages(familyId) {
  const meals = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    // eslint-disable-next-line no-await-in-loop
    const mealRes = await db
      .collection('meals')
      .where({ familyId })
      .skip(skip)
      .limit(100)
      .get();
    meals.push(...mealRes.data);
    if (mealRes.data.length < 100) break;
  }
  const fileList = [];
  meals.forEach((meal) => {
    (meal.photoFileIDs || []).forEach((fileID) => {
      if (/^cloud:\/\//.test(fileID) && !fileList.includes(fileID)) {
        fileList.push(fileID);
      }
    });
  });
  await deleteCloudFiles(fileList);
}

async function cleanupDishOverrideImages(familyId) {
  const overrides = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    let res;
    try {
      // eslint-disable-next-line no-await-in-loop
      res = await db
        .collection('dish_overrides')
        .where({ familyId })
        .skip(skip)
        .limit(100)
        .get();
    } catch (err) {
      if (isCollectionMissing(err)) return;
      throw err;
    }
    overrides.push(...res.data);
    if (res.data.length < 100) break;
  }
  await deleteCloudFiles(
    overrides
      .map((override) => override.imageUrl)
      .filter((imageUrl) => /^cloud:\/\//.test(imageUrl || ''))
  );
}

exports.main = handler(async (event, openid) => {
  const { familyId } = event;
  if (!familyId) return fail('缺少家庭信息');

  const family = await getFamily(familyId);
  if (family.creatorOpenid !== openid) {
    throw createError('只有家庭创建人可以解散家庭', 403);
  }

  const removed = {};
  await cleanupDishImages(familyId);
  await cleanupDishOverrideImages(familyId);
  await cleanupMealImages(familyId);
  for (const collectionName of RELATED_COLLECTIONS) {
    // eslint-disable-next-line no-await-in-loop
    removed[collectionName] = await removeFamilyDocuments(
      collectionName,
      familyId
    );
  }

  // 家庭文档最后删除，中途失败时可安全重试。
  await db.collection('families').doc(familyId).remove();

  return ok({
    familyId,
    removed
  });
});
