/**
 * 项目自检：页面结构、图片引用、初始化数据、推荐算法
 * 用法：node scripts/verify.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IMAGE_ROOT = path.join(ROOT, 'images');
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

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
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
  'deleteFamily', 'startMeal', 'closeMeal', 'addOrder', 'deleteOrder', 'updateOrderStatus',
  'toggleBabyFood', 'addBabyFood', 'updateProfile', 'manageDish', 'initData'
].forEach((fn) => {
  check(exists(`cloudfunctions/${fn}/index.js`), `cloudfunctions/${fn}/index.js`);
  check(exists(`cloudfunctions/${fn}/package.json`), `cloudfunctions/${fn}/package.json`);
  check(exists(`cloudfunctions/${fn}/common.js`), `cloudfunctions/${fn}/common.js`);
});

console.log('\n[4] 初始化数据与图片引用');
const dishes = require('../cloudfunctions/initData/data/dishes');
const foods = require('../cloudfunctions/initData/data/babyFoods');
check(dishes.length >= 21, `预设菜品数量=${dishes.length}`);
check(foods.length >= 12, `辅食数量=${foods.length}`);

const dishCategories = new Set(dishes.map((d) => d.category));
const allowedDishCategories = ['热销', '荤菜', '素菜', '主食', '汤类', '宝妈专属'];
dishes.forEach((dish) =>
  check(
    allowedDishCategories.includes(dish.category),
    `菜品「${dish.name}」分类合法`
  )
);
check(dishCategories.size >= 3, `预设菜品覆盖 ${dishCategories.size} 个分类`);
check(
  dishes.some((dish) => dish.postpartumFriendly),
  '至少有一道宝妈专属推荐菜'
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

console.log('\n[5] 小程序图片资源预算');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const imageFiles = walkFiles(IMAGE_ROOT).filter((file) =>
  imageExtensions.has(path.extname(file).toLowerCase())
);
const imageStats = imageFiles.map((file) => ({ file, bytes: fs.statSync(file).size }));
const imageBytes = imageStats.reduce((sum, item) => sum + item.bytes, 0);
const largestImage = imageStats.reduce((max, item) =>
  item.bytes > max.bytes ? item : max
);
check(
  imageBytes <= 200 * 1024,
  `图片资源总量 ${(imageBytes / 1024).toFixed(1)}KB ≤ 200KB`
);
check(
  largestImage.bytes <= 200 * 1024,
  `最大图片 ${(largestImage.bytes / 1024).toFixed(1)}KB ≤ 200KB`
);

console.log('\n[6] 分享、备餐状态与操作记录接入');
[
  ['pages/index/index.js', '首页'],
  ['pages/home/home.js', '点菜页'],
  ['pages/menu/menu.js', '菜单页'],
  ['pages/members/members.js', '成员页']
].forEach(([file, label]) => {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  check(source.includes('onShareAppMessage'), `${label}支持分享给好友`);
  check(source.includes('onShareTimeline'), `${label}支持分享到朋友圈`);
});
const menuSource = fs.readFileSync(path.join(ROOT, 'pages/menu/menu.js'), 'utf8');
const menuMarkup = fs.readFileSync(path.join(ROOT, 'pages/menu/menu.wxml'), 'utf8');
check(menuSource.includes("'prepare'"), '菜单页一键标记已准备');
check(menuMarkup.includes('已准备') && !menuMarkup.includes('正在做'), '菜单仅展示待准备与已准备');
check(
  menuMarkup.includes('prepared') && !/order--prepared[\s\S]*onDelete/.test(menuMarkup),
  '已准备菜品不渲染删除按钮'
);
const logsSource = fs.readFileSync(
  path.join(ROOT, 'pages/operation-logs/operation-logs.js'),
  'utf8'
);
check(logsSource.includes("action: 'logs'"), '操作记录通过云函数读取');

console.log('\n[7] 辅食推荐算法（同日稳定 + 换一道生效）');
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

console.log('\n[8] 云函数核心规则');
const cloudLogic = spawnSync(
  process.execPath,
  [path.join(ROOT, 'scripts/verify-cloud-logic.js')],
  { stdio: 'inherit' }
);
check(cloudLogic.status === 0, '云函数权限、事务与首页已点状态');

console.log(errors === 0 ? '\n✅ 全部检查通过\n' : `\n❌ 共 ${errors} 项未通过\n`);
process.exit(errors === 0 ? 0 : 1);
