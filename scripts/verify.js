/**
 * 项目自检：页面结构、图片引用、初始化数据、推荐算法
 * 用法：node scripts/verify.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let errors = 0;

function check(cond, message) {
  if (cond) {
    console.log('  ok   ' + message);
  } else {
    console.error('  FAIL ' + message);
    errors += 1;
  }
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

console.log('\n[1] app.json 页面与文件完整性');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
appJson.pages.forEach((p) => {
  ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
    check(exists(`${p}.${ext}`), `${p}.${ext}`);
  });
});

console.log('\n[2] tabBar 页面均在 pages 中注册');
const tabPaths = (appJson.tabBar.list || []).map((t) => t.pagePath);
tabPaths.forEach((p) => check(appJson.pages.includes(p), `tabBar 注册：${p}`));
check(exists('custom-tab-bar/index.js'), 'custom-tab-bar/index.js');

console.log('\n[3] 云函数齐全');
[
  'login', 'createFamily', 'joinFamily', 'leaveFamily', 'removeMember',
  'startMeal', 'closeMeal', 'addOrder', 'deleteOrder', 'updateOrderStatus',
  'toggleBabyFood', 'addBabyFood', 'initData'
].forEach((fn) => {
  check(exists(`cloudfunctions/${fn}/index.js`), `cloudfunctions/${fn}/index.js`);
  check(exists(`cloudfunctions/${fn}/package.json`), `cloudfunctions/${fn}/package.json`);
  check(exists(`cloudfunctions/${fn}/common.js`), `cloudfunctions/${fn}/common.js`);
});

console.log('\n[4] 初始化数据与图片引用');
const dishes = require('../cloudfunctions/initData/data/dishes');
const foods = require('../cloudfunctions/initData/data/babyFoods');
check(dishes.length >= 20, `预设菜品数量=${dishes.length}`);
check(foods.length >= 12, `辅食数量=${foods.length}`);

const dishCategories = new Set(dishes.map((d) => d.category));
['热销', '荤菜', '素菜', '主食', '汤类'].forEach((c) =>
  check(dishCategories.has(c), `菜品分类含 ${c}`)
);
const foodCategories = new Set(foods.map((f) => f.category));
['早餐', '午餐', '晚餐', '加餐'].forEach((c) =>
  check(foodCategories.has(c), `辅食分类含 ${c}`)
);

dishes.forEach((d) => {
  check(!!d.name && !!d.imageUrl, `菜品「${d.name}」字段完整`);
  check(exists(d.imageUrl.replace(/^\//, '')), `菜品图片存在：${d.imageUrl}`);
});
foods.forEach((f) => {
  check(!!f.name && !!f.imageUrl, `辅食「${f.name}」字段完整`);
  check(f.maxMonth >= f.minMonth, `辅食「${f.name}」月龄区间合法`);
  check(exists(f.imageUrl.replace(/^\//, '')), `辅食图片存在：${f.imageUrl}`);
});

console.log('\n[5] 辅食推荐算法（同日稳定 + 换一道生效）');
const recommend = require('../utils/recommend');
const opts = { babyId: 'baby1', date: '2025-01-15', ageMonths: 8, categories: ['早餐', '午餐', '晚餐', '加餐'] };
const a = recommend.recommendDaily(foods, opts).map((r) => (r.food ? r.food.name : null));
const b = recommend.recommendDaily(foods, opts).map((r) => (r.food ? r.food.name : null));
check(JSON.stringify(a) === JSON.stringify(b), '同一天结果稳定');
const nextDay = recommend.recommendDaily(foods, { ...opts, date: '2025-01-16' }).map((r) => (r.food ? r.food.name : null));
check(a.some((name, i) => name !== nextDay[i]), '第二天可能换新（至少一项不同或候选池变化）');
const swapped = recommend.recommendDaily(foods, { ...opts, saltMap: { 早餐: 1 } }).map((r) => (r.food ? r.food.name : null));
check(a[0] !== undefined, '推荐结果非空');
check(swapped[0] !== a[0] || foods.filter((f) => f.category === '早餐' && 8 >= f.minMonth && 8 <= f.maxMonth).length <= 1, '换一道会切换候选');

console.log(errors === 0 ? '\n✅ 全部检查通过\n' : `\n❌ 共 ${errors} 项未通过\n`);
process.exit(errors === 0 ? 0 : 1);
