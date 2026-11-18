/**
 * 云函数公共工具（每个云函数目录都放一份，部署时各自独立上传）
 * 统一：初始化、返回格式、成员/创建人校验、操作日志、异常包裹
 */
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

/** 构造带业务错误码的异常 */
function createError(message, code = 500) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** 判断云数据库文档不存在 */
function isDocumentMissing(err) {
  const text = [
    err && err.errCode,
    err && err.errMsg,
    err && err.message
  ]
    .filter(Boolean)
    .join(' ');
  return /DOCUMENT_NOT_FOUND|cannot find document|document.*not exist|not exist/i.test(
    text
  );
}

/** 读取文档；不存在时返回 null，其他错误继续抛出 */
async function getDocOrNull(collection, docId) {
  try {
    const res = await collection.doc(docId).get();
    return res && res.data ? res.data : null;
  } catch (err) {
    if (isDocumentMissing(err)) return null;
    throw err;
  }
}

/**
 * 生成稳定且短小的文档 ID。
 * 用于把“同一家庭同一餐同一道菜”映射到同一个订单文档，避免并发重复写入。
 */
function stableDocId(prefix, values) {
  const digest = crypto
    .createHash('sha256')
    .update(values.map((value) => String(value)).join('|'))
    .digest('hex')
    .slice(0, 24);
  return `${prefix}_${digest}`;
}

/** 成功返回 */
function ok(data = {}) {
  return { code: 0, data };
}

/** 失败返回 */
function fail(message = '操作失败', code = 1) {
  return { code, message };
}

/** 服务端时间 */
function serverDate() {
  return db.serverDate();
}

/**
 * 校验当前 openid 是否为该家庭成员，返回成员记录；否则抛出错误
 */
async function assertMember(familyId, openid) {
  if (!familyId) {
    throw createError('缺少家庭信息', 400);
  }
  const res = await db
    .collection('family_members')
    .where({ familyId, openid })
    .limit(1)
    .get();
  if (res.data.length) return res.data[0];

  // 历史数据可能缺少 family_members 记录，家庭文档中的 memberOpenids 仍是权威来源。
  const family = await getFamily(familyId);
  if (!(family.memberOpenids || []).includes(openid)) {
    throw createError('你不是该家庭成员', 403);
  }
  return {
    familyId,
    openid,
    nickname: '成员',
    avatar: ''
  };
}

/**
 * 校验当前 openid 是否为家庭创建人，返回家庭文档；否则抛出错误
 */
async function assertCreator(familyId, openid) {
  const family = await getFamily(familyId);
  if (family.creatorOpenid !== openid) {
    throw createError('只有家庭创建人可以执行此操作', 403);
  }
  return family;
}

/** 读取家庭文档，不存在则抛错 */
async function getFamily(familyId) {
  if (!familyId) throw createError('缺少家庭信息', 400);
  try {
    const res = await db.collection('families').doc(familyId).get();
    if (!res.data) {
      throw createError('家庭不存在', 404);
    }
    return res.data;
  } catch (err) {
    if (err && (err.errCode === -1 || /not exist/i.test(err.errMsg || ''))) {
      throw createError('家庭不存在', 404);
    }
    throw err;
  }
}

/**
 * 读取当餐并校验家庭归属。
 * @param {string} familyId
 * @param {string} mealId
 * @param {object} options { requireActive, source }
 */
async function getFamilyMeal(familyId, mealId, options = {}) {
  const { requireActive = false, source = db } = options;
  if (!familyId || !mealId) throw createError('缺少当餐信息', 400);
  const meal = await getDocOrNull(source.collection('meals'), mealId);
  if (!meal) throw createError('当餐不存在', 404);
  if (meal.familyId !== familyId) {
    throw createError('无权操作其他家庭的当餐', 403);
  }
  if (requireActive && meal.status !== 'active') {
    throw createError('这一餐已结束，不能再操作', 409);
  }
  return meal;
}

/** 读取管理员 openid 白名单；未配置时默认拒绝执行敏感操作 */
function assertAdmin(openid) {
  const admins = (process.env.INIT_ADMIN_OPENIDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!admins.length) {
    throw createError(
      'initData 未配置管理员，请先设置云函数环境变量 INIT_ADMIN_OPENIDS',
      403
    );
  }
  if (!openid || !admins.includes(openid)) {
    throw createError('只有管理员可以执行初始化操作', 403);
  }
}

/** 写入一条操作日志（只增不删） */
async function writeLog(familyId, mealId, payload) {
  await db.collection('operation_logs').add({
    data: Object.assign(
      { familyId, mealId, createdAt: serverDate() },
      payload
    )
  });
}

/** 生成日志数据，供事务内原子写入 */
function buildLogData(familyId, mealId, payload) {
  return Object.assign(
    { familyId, mealId, createdAt: serverDate() },
    payload
  );
}

/** 统一包裹云函数入口：自动注入 openid 并捕获异常 */
function handler(fn) {
  return async (event, context) => {
    try {
      const wxContext = cloud.getWXContext();
      return await fn(event || {}, wxContext.OPENID, wxContext, context);
    } catch (err) {
      console.error('[cloud function error]', err);
      return fail((err && err.message) || '服务异常', (err && err.code) || 500);
    }
  };
}

module.exports = {
  cloud,
  db,
  _,
  ok,
  fail,
  createError,
  isDocumentMissing,
  getDocOrNull,
  stableDocId,
  serverDate,
  assertMember,
  assertCreator,
  getFamily,
  getFamilyMeal,
  assertAdmin,
  writeLog,
  buildLogData,
  handler
};
