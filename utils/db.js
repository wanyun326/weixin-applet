/**
 * 云开发数据库与云函数调用封装
 * - callFunction：统一处理云函数返回 { code: 0, data } / { code: 非0, message }
 * - db()：拿到数据库实例
 */

/** 获取数据库实例 */
function db() {
  return wx.cloud.database();
}

/** 获取查询指令对象（如 _.in） */
function cmd() {
  return wx.cloud.database().command;
}

/**
 * 分页拉取集合全部数据
 * 小程序端单次查询最多返回 20 条，超过会截断，这里按页取全。
 * @param {string} collectionName 集合名
 * @param {object} [options] { where, orderBy, order, pageSize, max }
 * @returns {Promise<Array>}
 */
async function getAll(collectionName, options = {}) {
  const {
    where = null,
    orderBy = '',
    order = 'asc',
    pageSize = 20,
    max = 500
  } = options;
  const dbInstance = db();
  const result = [];
  for (let skip = 0; skip < max; skip += pageSize) {
    let query = dbInstance.collection(collectionName);
    if (where && Object.keys(where).length) query = query.where(where);
    if (orderBy) query = query.orderBy(orderBy, order);
    // eslint-disable-next-line no-await-in-loop
    const res = await query.skip(skip).limit(pageSize).get();
    result.push(...res.data);
    if (res.data.length < pageSize) break;
  }
  return result;
}

/**
 * 调用云函数，成功返回 data，失败抛出可读错误
 * @param {string} name 云函数名
 * @param {object} data 入参
 * @returns {Promise<any>}
 */
function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        const result = res && res.result ? res.result : {};
        if (result.code === 0) {
          resolve(result.data);
        } else {
          reject(new Error(result.message || '操作失败'));
        }
      },
      fail(err) {
        console.error(`调用云函数 ${name} 失败`, err);
        reject(new Error((err && err.errMsg) || '网络异常，请稍后重试'));
      }
    });
  });
}

/**
 * 获取当前用户加入的所有家庭（附带成员数）
 * @param {string} openid
 * @returns {Promise<Array>}
 */
async function getMyFamilies(openid) {
  const members = await getAll('family_members', { where: { openid } });
  const familyIds = members.map((m) => m.familyId);
  if (familyIds.length === 0) return [];

  const families = await getAll('families', {
    where: { _id: cmd().in(familyIds) }
  });

  // 按加入时间保持一定稳定性（这里简单按创建时间倒序）
  return families.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

/** 读取进行中的当餐（没有则返回 null） */
async function getActiveMeal(familyId) {
  const res = await db()
    .collection('meals')
    .where({ familyId, status: 'active' })
    .limit(1)
    .get();
  return res.data[0] || null;
}

module.exports = {
  db,
  cmd,
  getAll,
  callFunction,
  getMyFamilies,
  getActiveMeal
};
