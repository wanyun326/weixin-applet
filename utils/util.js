/**
 * 通用工具：日期格式化、月龄计算、餐次名称生成
 */

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 日期 -> "2025-01-15" */
function ymd(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 日期 -> "01-15 14:30" */
function mdhm(date) {
  const d = new Date(date);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** 日期 -> "1月15日 周一" */
function mDweek(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]}`;
}

/** 日期 -> "2025-01-15 14:30:05" */
function full(date) {
  const d = new Date(date);
  return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds()
  )}`;
}

/**
 * 根据出生日期计算月龄（按月向下取整）
 * @param {string|Date} birthday
 * @returns {number}
 */
function monthAge(birthday) {
  const b = new Date(birthday);
  const now = new Date();
  let months =
    (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  return Math.max(0, months);
}

/** 星期几：返回 0-6 */
function weekday(date) {
  return new Date(date).getDay();
}

/**
 * 自动生成餐次名称，如「1月15日 晚饭」
 * 根据当前时间推断餐次：<10 早餐，<15 午饭，<20 晚饭，其余 夜宵
 */
function defaultMealLabel(date = new Date()) {
  const d = new Date(date);
  const h = d.getHours();
  let slot = '夜宵';
  if (h < 10) slot = '早饭';
  else if (h < 15) slot = '午饭';
  else if (h < 20) slot = '晚饭';
  return `${d.getMonth() + 1}月${d.getDate()}日 ${slot}`;
}

module.exports = {
  ymd,
  mdhm,
  mDweek,
  full,
  monthAge,
  weekday,
  defaultMealLabel
};
