// 云函数：家庭自定义菜品的增 / 改 / 删与可见菜品列表
const {
  cloud,
  db,
  ok,
  fail,
  createError,
  getDocOrNull,
  stableDocId,
  serverDate,
  assertMember,
  handler
} = require('./common');

const CATEGORIES = ['热销', '荤菜', '素菜', '主食', '汤类', '宝妈专属'];
const PAGE_SIZE = 100;

function isCollectionMissing(err) {
  const text = [
    err && err.errCode,
    err && err.errMsg,
    err && err.message
  ]
    .filter(Boolean)
    .join(' ');
  return /DATABASE_COLLECTION_NOT_EXIST|Db or Table not exist|collection.*not exists/i.test(
    text
  );
}

async function ensureOverrideCollection() {
  try {
    await db.collection('dish_overrides').limit(1).get();
    return;
  } catch (err) {
    if (!isCollectionMissing(err)) throw err;
  }
  try {
    await db.createCollection('dish_overrides');
  } catch (err) {
    if (!/already exists|collection.*exist/i.test(
      [err && err.errCode, err && err.errMsg, err && err.message]
        .filter(Boolean)
        .join(' ')
    )) {
      throw err;
    }
  }
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function validateImageUrl(imageUrl) {
  if (!imageUrl) return '/images/dishes/hot.png';
  if (/^cloud:\/\//.test(imageUrl) || /^\/images\/dishes\//.test(imageUrl)) {
    return imageUrl;
  }
  throw createError('菜品图片必须先上传到云存储', 400);
}

async function listAllDishes() {
  const result = [];
  for (let skip = 0; skip < 1000; skip += PAGE_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    const res = await db
      .collection('dishes')
      .skip(skip)
      .limit(PAGE_SIZE)
      .get();
    result.push(...res.data);
    if (res.data.length < PAGE_SIZE) break;
  }
  return result;
}

async function listFamilyOverrides(familyId) {
  await ensureOverrideCollection();
  const result = [];
  for (let skip = 0; skip < 1000; skip += PAGE_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    const res = await db
      .collection('dish_overrides')
      .where({ familyId })
      .skip(skip)
      .limit(PAGE_SIZE)
      .get();
    result.push(...res.data);
    if (res.data.length < PAGE_SIZE) break;
  }
  return result;
}

async function cleanupCloudFile(fileID) {
  if (!fileID || !/^cloud:\/\//.test(fileID)) return;
  try {
    await cloud.deleteFile({ fileList: [fileID] });
  } catch (err) {
    console.warn('清理菜品图片失败', err);
  }
}

async function getCustomDish(familyId, dishId) {
  const dish = await getDocOrNull(db.collection('dishes'), dishId);
  if (!dish) throw createError('菜品不存在', 404);
  if (!dish.isCustom || dish.familyId !== familyId) {
    throw createError('只能修改本家庭的自定义菜品', 403);
  }
  return dish;
}

exports.main = handler(async (event, openid) => {
  const { familyId, action = 'list', dishId } = event;
  await assertMember(familyId, openid);

  if (action === 'list') {
    const [allDishes, overrides] = await Promise.all([
      listAllDishes(),
      listFamilyOverrides(familyId)
    ]);
    const overrideByDish = {};
    overrides.forEach((override) => {
      overrideByDish[override.dishId] = override;
    });
    return ok({
      dishes: allDishes
        .filter((dish) => !dish.isCustom || dish.familyId === familyId)
        .map((dish) => {
          if (dish.isCustom) {
            return { ...dish, isBuiltIn: false, imageOverridden: false };
          }
          const override = overrideByDish[dish._id];
          return {
            ...dish,
            imageUrl: override ? override.imageUrl : dish.imageUrl,
            isBuiltIn: true,
            imageOverridden: !!override
          };
        })
        .sort((left, right) => {
          if ((left.sort || 0) !== (right.sort || 0)) {
            return (right.sort || 0) - (left.sort || 0);
          }
          return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
        })
    });
  }

  if (action === 'setDefaultImage') {
    await ensureOverrideCollection();
    const imageUrl = validateImageUrl(event.imageUrl);
    if (!/^cloud:\/\//.test(imageUrl)) {
      return fail('默认菜图片必须先上传到云存储');
    }
    const dish = await getDocOrNull(db.collection('dishes'), dishId);
    if (!dish) return fail('菜品不存在');
    if (dish.isCustom) return fail('自定义菜请使用编辑功能更换图片');

    const overrideId = stableDocId('dishimg', [familyId, dishId]);
    const previous = await getDocOrNull(
      db.collection('dish_overrides'),
      overrideId
    );
    await db.collection('dish_overrides').doc(overrideId).set({
      data: {
        familyId,
        dishId,
        imageUrl,
        updatedBy: openid,
        updatedAt: serverDate()
      }
    });
    if (previous && previous.imageUrl !== imageUrl) {
      await cleanupCloudFile(previous.imageUrl);
    }
    return ok({ dishId, imageUrl });
  }

  if (action === 'restoreDefaultImage') {
    if (!dishId) return fail('缺少菜品信息');
    await ensureOverrideCollection();
    const overrideId = stableDocId('dishimg', [familyId, dishId]);
    const override = await getDocOrNull(
      db.collection('dish_overrides'),
      overrideId
    );
    if (override) {
      await db.collection('dish_overrides').doc(overrideId).remove();
      await cleanupCloudFile(override.imageUrl);
    }
    return ok({ dishId });
  }

  if (action === 'add') {
    const dish = event.dish || {};
    const name = cleanText(dish.name, 20);
    const desc = cleanText(dish.desc, 80);
    const category = dish.category;
    if (!name) return fail('请填写菜品名称');
    if (!CATEGORIES.includes(category)) return fail('菜品分类不正确');

    const imageUrl = validateImageUrl(dish.imageUrl);
    const add = await db.collection('dishes').add({
      data: {
        name,
        desc,
        category,
        imageUrl,
        price: 0,
        sort: 0,
        isCustom: true,
        familyId,
        createdBy: openid,
        createdAt: serverDate(),
        updatedAt: serverDate()
      }
    });
    return ok({
      dish: {
        _id: add._id,
        name,
        desc,
        category,
        imageUrl,
        isCustom: true,
        familyId
      }
    });
  }

  if (!dishId) return fail('缺少菜品信息');
  const currentDish = await getCustomDish(familyId, dishId);

  if (action === 'update') {
    const patch = event.dish || {};
    const updateData = {};
    if (patch.name !== undefined) {
      const name = cleanText(patch.name, 20);
      if (!name) return fail('请填写菜品名称');
      updateData.name = name;
    }
    if (patch.desc !== undefined) updateData.desc = cleanText(patch.desc, 80);
    if (patch.category !== undefined) {
      if (!CATEGORIES.includes(patch.category)) return fail('菜品分类不正确');
      updateData.category = patch.category;
    }
    if (patch.imageUrl !== undefined) {
      updateData.imageUrl = validateImageUrl(patch.imageUrl);
    }
    updateData.updatedAt = serverDate();

    await db.collection('dishes').doc(dishId).update({ data: updateData });
    if (
      updateData.imageUrl &&
      currentDish.imageUrl !== updateData.imageUrl
    ) {
      await cleanupCloudFile(currentDish.imageUrl);
    }
    return ok({ dishId });
  }

  if (action === 'delete') {
    await db.collection('dishes').doc(dishId).remove();
    await cleanupCloudFile(currentDish.imageUrl);
    return ok({ dishId });
  }

  throw createError('不支持的操作', 400);
});
