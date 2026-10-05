/**
 * 辅食推荐算法
 * 用「宝宝ID + 日期」做随机种子，保证同一天推荐结果稳定；换一道通过 salt 递增偏移。
 */

/** 字符串 -> 32 位整数种子 */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 伪随机数生成器 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 在候选池中确定性地选一道
 * @param {Array} foods 候选辅食（已按 category/month 过滤）
 * @param {string} babyId
 * @param {string} date YYYY-MM-DD
 * @param {string} category 早/午/晚/加餐
 * @param {number} salt 换菜次数
 * @returns {object|null}
 */
function pickOne(foods, babyId, date, category, salt = 0) {
  if (!foods.length) return null;
  const rng = mulberry32(hashSeed(`${babyId}|${date}|${category}`));
  // 先随机出一个基础下标，换菜时再偏移 salt 位（取模保证落在池内）
  const base = Math.floor(rng() * foods.length);
  const index = (base + salt) % foods.length;
  return foods[index];
}

/**
 * 生成某宝宝某天的 4 道推荐
 * @param {Array} allFoods 全部可见辅食（内置 + 家庭自定义）
 * @param {object} options { babyId, date, ageMonths, categories, saltMap }
 * @returns {Array<{category, food}>}
 */
function recommendDaily(allFoods, options) {
  const { babyId, date, ageMonths, categories, saltMap = {} } = options;
  return categories.map((category) => {
    const pool = allFoods.filter(
      (f) =>
        f.category === category &&
        ageMonths >= f.minMonth &&
        ageMonths <= f.maxMonth
    );
    const salt = saltMap[category] || 0;
    return { category, food: pickOne(pool, babyId, date, category, salt) };
  });
}

module.exports = {
  hashSeed,
  pickOne,
  recommendDaily
};
