// 内置辅食库（category：早餐 / 午餐 / 晚餐 / 加餐）
// 图片同样使用内置占位图，生产环境建议替换为云存储 fileID。
module.exports = [
  // ---- 早餐 ----
  {
    name: '高铁米粉糊', imageUrl: '/images/babyfood/breakfast.png',
    minMonth: 4, maxMonth: 12, category: '早餐',
    ingredients: ['婴儿高铁米粉', '温水'],
    steps: ['取适量米粉放入碗中', '加入约 60℃ 温水边倒边搅拌', '调至顺滑无颗粒即可'],
    nutrition: '富含铁元素，适合作为宝宝第一口辅食',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '南瓜小米粥', imageUrl: '/images/babyfood/breakfast.png',
    minMonth: 6, maxMonth: 24, category: '早餐',
    ingredients: ['小米', '南瓜'],
    steps: ['小米淘洗后加水熬煮', '南瓜去皮蒸熟压泥', '将南瓜泥拌入小米粥中'],
    nutrition: '小米养胃，南瓜富含 β-胡萝卜素',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '蛋黄泥', imageUrl: '/images/babyfood/breakfast.png',
    minMonth: 6, maxMonth: 12, category: '早餐',
    ingredients: ['鸡蛋'],
    steps: ['鸡蛋煮熟后取蛋黄', '加少量温水或奶压成泥', '从 1/4 个蛋黄开始尝试'],
    nutrition: '补充优质蛋白与卵磷脂，注意观察过敏',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '香蕉燕麦糊', imageUrl: '/images/babyfood/breakfast.png',
    minMonth: 8, maxMonth: 24, category: '早餐',
    ingredients: ['香蕉', '即食燕麦', '配方奶'],
    steps: ['燕麦用温奶泡软', '香蕉压成泥', '两者混合搅匀'],
    nutrition: '膳食纤维丰富，帮助肠道蠕动',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },

  // ---- 午餐 ----
  {
    name: '西兰花土豆泥', imageUrl: '/images/babyfood/lunch.png',
    minMonth: 6, maxMonth: 18, category: '午餐',
    ingredients: ['西兰花', '土豆'],
    steps: ['西兰花焯水后切碎', '土豆蒸熟压泥', '混合拌匀'],
    nutrition: '维生素 C 与碳水搭配，营养均衡',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '胡萝卜鸡肉泥', imageUrl: '/images/babyfood/lunch.png',
    minMonth: 7, maxMonth: 18, category: '午餐',
    ingredients: ['胡萝卜', '鸡胸肉'],
    steps: ['鸡胸肉煮熟撕碎', '胡萝卜蒸熟', '两者混合打成泥'],
    nutrition: '优质蛋白 + 胡萝卜素，助力发育',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '三文鱼蔬菜粥', imageUrl: '/images/babyfood/lunch.png',
    minMonth: 8, maxMonth: 24, category: '午餐',
    ingredients: ['三文鱼', '大米', '青菜'],
    steps: ['大米熬成软粥', '三文鱼蒸熟去刺压碎', '青菜切碎后与鱼、粥同煮'],
    nutrition: '富含 DHA，有助于大脑发育',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '番茄牛肉碎面', imageUrl: '/images/babyfood/lunch.png',
    minMonth: 10, maxMonth: 30, category: '午餐',
    ingredients: ['番茄', '牛肉末', '宝宝面条'],
    steps: ['番茄去皮切丁炒出汁', '加入牛肉末炒熟', '加水下面条煮软'],
    nutrition: '铁与番茄红素丰富，酸甜开胃',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },

  // ---- 晚餐 ----
  {
    name: '山药南瓜泥', imageUrl: '/images/babyfood/dinner.png',
    minMonth: 6, maxMonth: 18, category: '晚餐',
    ingredients: ['山药', '南瓜'],
    steps: ['山药、南瓜去皮切块', '上锅蒸 15 分钟', '压成细腻泥状'],
    nutrition: '健脾养胃，口感绵软易消化',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '菠菜猪肝泥', imageUrl: '/images/babyfood/dinner.png',
    minMonth: 8, maxMonth: 18, category: '晚餐',
    ingredients: ['猪肝', '菠菜'],
    steps: ['猪肝浸泡后煮熟打泥', '菠菜焯水切碎', '两者混合拌匀'],
    nutrition: '补铁补血，每周 1-2 次为宜',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '鳕鱼豆腐羹', imageUrl: '/images/babyfood/dinner.png',
    minMonth: 9, maxMonth: 24, category: '晚餐',
    ingredients: ['鳕鱼', '内酯豆腐'],
    steps: ['鳕鱼蒸熟去刺', '豆腐压碎', '加水小火煮成羹'],
    nutrition: '高蛋白低脂肪，入口即化',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '香菇鸡肉软饭', imageUrl: '/images/babyfood/dinner.png',
    minMonth: 12, maxMonth: 36, category: '晚餐',
    ingredients: ['香菇', '鸡肉', '大米'],
    steps: ['香菇、鸡肉切小丁', '与米同煮成软饭', '焖 5 分钟后拌匀'],
    nutrition: '荤素搭配，锻炼咀嚼能力',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },

  // ---- 加餐 ----
  {
    name: '苹果泥', imageUrl: '/images/babyfood/snack.png',
    minMonth: 4, maxMonth: 18, category: '加餐',
    ingredients: ['苹果'],
    steps: ['苹果去皮去核切块', '蒸 5 分钟后压泥', '放温后喂食'],
    nutrition: '富含果胶，温和助消化',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '牛油果泥', imageUrl: '/images/babyfood/snack.png',
    minMonth: 6, maxMonth: 24, category: '加餐',
    ingredients: ['牛油果'],
    steps: ['牛油果取果肉', '用勺背压成泥', '可加少量奶调稀'],
    nutrition: '富含不饱和脂肪酸，助力脑发育',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '蒸红薯条', imageUrl: '/images/babyfood/snack.png',
    minMonth: 7, maxMonth: 24, category: '加餐',
    ingredients: ['红薯'],
    steps: ['红薯去皮切条', '上锅蒸 12 分钟', '放温后给宝宝抓握'],
    nutrition: '手指食物，锻炼抓握与咀嚼',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  },
  {
    name: '原味酸奶', imageUrl: '/images/babyfood/snack.png',
    minMonth: 10, maxMonth: 36, category: '加餐',
    ingredients: ['无糖原味酸奶'],
    steps: ['取小杯原味酸奶', '放置回温', '用勺喂食，注意少量'],
    nutrition: '含益生菌，帮助调节肠道',
    isCustom: false, familyId: '', createdAt: new Date('2024-01-01')
  }
];
