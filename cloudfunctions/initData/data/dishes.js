// 预设菜品库（category：热销 / 荤菜 / 素菜 / 主食 / 汤类）
// imageUrl 默认指向小程序内置占位图，生产环境请上传云存储后用 fileID 替换。
module.exports = [
  // ---- 热销 ----
  { name: '西红柿炒蛋', desc: '酸甜下饭，老少皆宜', category: '热销', imageUrl: '/images/dishes/hot.png', price: 0, sort: 100 },
  { name: '红烧肉', desc: '肥而不腻，入口即化', category: '热销', imageUrl: '/images/dishes/hot.png', price: 0, sort: 99 },
  { name: '宫保鸡丁', desc: '微辣鲜香，花生增脆', category: '热销', imageUrl: '/images/dishes/hot.png', price: 0, sort: 98 },
  { name: '可乐鸡翅', desc: '甜咸适口，孩子最爱', category: '热销', imageUrl: '/images/dishes/hot.png', price: 0, sort: 97 },
  { name: '酸辣土豆丝', desc: '爽脆开胃', category: '热销', imageUrl: '/images/dishes/hot.png', price: 0, sort: 96 },
  { name: '麻婆豆腐', desc: '麻辣鲜香，超下饭', category: '热销', imageUrl: '/images/dishes/hot.png', price: 0, sort: 95 },

  // ---- 荤菜 ----
  { name: '糖醋排骨', desc: '酸甜挂汁，软嫩脱骨', category: '荤菜', imageUrl: '/images/dishes/meat.png', price: 0, sort: 90 },
  { name: '清蒸鲈鱼', desc: '鲜嫩清淡，营养丰富', category: '荤菜', imageUrl: '/images/dishes/meat.png', price: 0, sort: 89 },
  { name: '青椒肉丝', desc: '家常小炒，咸香微辣', category: '荤菜', imageUrl: '/images/dishes/meat.png', price: 0, sort: 88 },
  { name: '回锅肉', desc: '酱香浓郁，肥瘦相间', category: '荤菜', imageUrl: '/images/dishes/meat.png', price: 0, sort: 87 },
  { name: '白切鸡', desc: '皮爽肉滑，原汁原味', category: '荤菜', imageUrl: '/images/dishes/meat.png', price: 0, sort: 86 },
  { name: '香煎鸡腿', desc: '外焦里嫩，简单快手', category: '荤菜', imageUrl: '/images/dishes/meat.png', price: 0, sort: 85 },
  { name: '虾仁滑蛋', desc: '嫩滑鲜甜', category: '荤菜', imageUrl: '/images/dishes/meat.png', price: 0, sort: 84 },
  { name: '鱼香肉丝', desc: '咸甜酸辣，经典川味', category: '荤菜', imageUrl: '/images/dishes/meat.png', price: 0, sort: 83 },

  // ---- 素菜 ----
  { name: '蒜蓉西兰花', desc: '清爽解腻，颜色好看', category: '素菜', imageUrl: '/images/dishes/veggie.png', price: 0, sort: 80 },
  { name: '清炒时蔬', desc: '当季蔬菜，清淡健康', category: '素菜', imageUrl: '/images/dishes/veggie.png', price: 0, sort: 79 },
  { name: '干煸豆角', desc: '干香入味', category: '素菜', imageUrl: '/images/dishes/veggie.png', price: 0, sort: 78 },
  { name: '手撕包菜', desc: '脆爽微酸', category: '素菜', imageUrl: '/images/dishes/veggie.png', price: 0, sort: 77 },
  { name: '凉拌黄瓜', desc: '清爽开胃小菜', category: '素菜', imageUrl: '/images/dishes/veggie.png', price: 0, sort: 76 },
  { name: '蚝油生菜', desc: '清甜爽口', category: '素菜', imageUrl: '/images/dishes/veggie.png', price: 0, sort: 75 },

  // ---- 主食 ----
  { name: '白米饭', desc: '一碗好饭', category: '主食', imageUrl: '/images/dishes/staple.png', price: 0, sort: 70 },
  { name: '蛋炒饭', desc: '粒粒分明，简单美味', category: '主食', imageUrl: '/images/dishes/staple.png', price: 0, sort: 69 },
  { name: '手擀面', desc: '筋道爽滑', category: '主食', imageUrl: '/images/dishes/staple.png', price: 0, sort: 68 },
  { name: '葱花饼', desc: '外酥里软，葱香扑鼻', category: '主食', imageUrl: '/images/dishes/staple.png', price: 0, sort: 67 },
  { name: '蒸紫薯', desc: '香甜软糯', category: '主食', imageUrl: '/images/dishes/staple.png', price: 0, sort: 66 },
  { name: '水煮玉米', desc: '清甜多汁', category: '主食', imageUrl: '/images/dishes/staple.png', price: 0, sort: 65 },

  // ---- 汤类 ----
  { name: '番茄蛋花汤', desc: '开胃鲜香，简单快手', category: '汤类', imageUrl: '/images/dishes/soup.png', price: 0, sort: 60 },
  { name: '冬瓜排骨汤', desc: '清爽不油腻', category: '汤类', imageUrl: '/images/dishes/soup.png', price: 0, sort: 59 },
  { name: '紫菜蛋花汤', desc: '清淡鲜美', category: '汤类', imageUrl: '/images/dishes/soup.png', price: 0, sort: 58 },
  { name: '玉米排骨汤', desc: '清甜滋补', category: '汤类', imageUrl: '/images/dishes/soup.png', price: 0, sort: 57 }
];
