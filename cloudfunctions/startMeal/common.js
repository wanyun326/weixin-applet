/**
 * 云函数公共工具（每个云函数目录都放一份，部署时各自独立上传）
 * 统一：初始化、返回格式、成员/创建人校验、操作日志、异常包裹
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

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
    const e = new Error('缺少家庭信息');
    e.code = 400;
    throw e;
  }
  const res = await db
    .collection('family_members')
    .where({ familyId, openid })
    .limit(1)
    .get();
  if (!res.data.length) {
    const e = new Error('你不是该家庭成员');
    e.code = 403;
    throw e;
  }
  return res.data[0];
}

/**
 * 校验当前 openid 是否为家庭创建人，返回家庭文档；否则抛出错误
 */
async function assertCreator(familyId, openid) {
  const family = await getFamily(familyId);
  if (family.creatorOpenid !== openid) {
    const e = new Error('只有家庭创建人可以执行此操作');
    e.code = 403;
    throw e;
  }
  return family;
}

/** 读取家庭文档，不存在则抛错 */
async function getFamily(familyId) {
  try {
    const res = await db.collection('families').doc(familyId).get();
    if (!res.data) {
      const e = new Error('家庭不存在');
      e.code = 404;
      throw e;
    }
    return res.data;
  } catch (err) {
    if (err && (err.errCode === -1 || /not exist/i.test(err.errMsg || ''))) {
      const e = new Error('家庭不存在');
      e.code = 404;
      throw e;
    }
    throw err;
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
  serverDate,
  assertMember,
  assertCreator,
  getFamily,
  writeLog,
  handler
};
