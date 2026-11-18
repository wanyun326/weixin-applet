// 云函数：家庭自定义菜品的增 / 改 / 删与可见菜品列表
const {
  cloud,
  db,
  ok,
  fail,
  createError,
  getDocOrNull,
  serverDate,
  assertMember,
  handler
} = require('./common');

const CATEGORIES = ['热销', '荤菜', '素菜', '主食', '汤类'];
const PAGE_SIZE = 100;

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
    const allDishes = await listAllDishes();
    return ok({
      dishes: allDishes
        .filter(
          (dish) => !dish.isCustom || dish.familyId === familyId
        )
        .sort((left, right) => {
          if ((left.sort || 0) !== (right.sort || 0)) {
            return (right.sort || 0) - (left.sort || 0);
          }
          return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
        })
    });
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
