/**
 * 云函数核心规则测试。
 * 使用内存数据库模拟 wx-server-sdk，覆盖权限、事务和关键业务边界。
 * 用法：node scripts/verify-cloud-logic.js
 */
const assert = require('assert');
const Module = require('module');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let currentOpenid = 'user-a';
let collectionExists = new Set();
let stores = {};

function resetDatabase() {
  collectionExists = new Set();
  stores = {};
}

function clone(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((result, key) => {
      result[key] = clone(value[key]);
      return result;
    }, {});
  }
  return value;
}

function missingError(message) {
  const error = new Error(message);
  error.errCode = -1;
  error.errMsg = message;
  return error;
}

function matches(document, where) {
  if (!where) return true;
  return Object.keys(where).every((key) => {
    const expected = where[key];
    if (expected && expected.__operator === 'in') {
      return expected.values.includes(document[key]);
    }
    return document[key] === expected;
  });
}

class Query {
  constructor(name, options = {}) {
    this.name = name;
    this.whereValue = options.where || null;
    this.orderField = options.orderField || '';
    this.orderDirection = options.orderDirection || 'asc';
    this.skipValue = options.skipValue || 0;
    this.limitValue = options.limitValue || 20;
    this.fieldValue = options.fieldValue || null;
  }

  copy(patch) {
    return new Query(this.name, {
      where: this.whereValue,
      orderField: this.orderField,
      orderDirection: this.orderDirection,
      skipValue: this.skipValue,
      limitValue: this.limitValue,
      fieldValue: this.fieldValue,
      ...patch
    });
  }

  where(where) {
    return this.copy({ where });
  }

  orderBy(field, direction) {
    return this.copy({ orderField: field, orderDirection: direction });
  }

  skip(value) {
    return this.copy({ skipValue: value });
  }

  limit(value) {
    return this.copy({ limitValue: value });
  }

  field(value) {
    return this.copy({ fieldValue: value });
  }

  async get() {
    if (!collectionExists.has(this.name)) {
      throw missingError('DATABASE_COLLECTION_NOT_EXIST');
    }
    let documents = Object.values(stores[this.name] || {}).filter((document) =>
      matches(document, this.whereValue)
    );
    if (this.orderField) {
      const factor = this.orderDirection === 'desc' ? -1 : 1;
      documents.sort((left, right) => {
        const a = left[this.orderField];
        const b = right[this.orderField];
        if (a === b) return 0;
        return (a > b ? 1 : -1) * factor;
      });
    }
    documents = documents.slice(
      this.skipValue,
      this.skipValue + this.limitValue
    );
    if (this.fieldValue) {
      documents = documents.map((document) =>
        Object.keys(this.fieldValue).reduce(
          (result, key) => {
            result[key] = clone(document[key]);
            return result;
          },
          { _id: document._id }
        )
      );
    }
    return { data: clone(documents) };
  }

  async count() {
    const result = await this.limit(1000).get();
    return { total: result.data.length };
  }
}

class Collection {
  constructor(name) {
    this.name = name;
  }

  doc(docId) {
    const name = this.name;
    return {
      async get() {
        if (!collectionExists.has(name) || !stores[name][docId]) {
          throw missingError('DOCUMENT_NOT_FOUND');
        }
        return { data: clone(stores[name][docId]) };
      },
      async set({ data }) {
        collectionExists.add(name);
        stores[name] = stores[name] || {};
        stores[name][docId] = clone({ ...data, _id: docId });
        return { stats: { created: 1, updated: 0 } };
      },
      async update({ data }) {
        if (!collectionExists.has(name) || !stores[name][docId]) {
          throw missingError('DOCUMENT_NOT_FOUND');
        }
        stores[name][docId] = clone({ ...stores[name][docId], ...data });
        return { stats: { updated: 1 } };
      },
      async remove() {
        if (!collectionExists.has(name) || !stores[name][docId]) {
          throw missingError('DOCUMENT_NOT_FOUND');
        }
        delete stores[name][docId];
        return { stats: { removed: 1 } };
      }
    };
  }

  async add({ data }) {
    if (!collectionExists.has(this.name)) {
      throw missingError('DATABASE_COLLECTION_NOT_EXIST');
    }
    stores[this.name] = stores[this.name] || {};
    if (Array.isArray(data)) {
      return {
        _ids: data.map((document) => {
          const docId = `auto_${Object.keys(stores[this.name]).length + 1}`;
          stores[this.name][docId] = clone({ ...document, _id: docId });
          return docId;
        })
      };
    }
    const docId = `auto_${Object.keys(stores[this.name]).length + 1}`;
    stores[this.name][docId] = clone({ ...data, _id: docId });
    return { _id: docId };
  }

  where(where) {
    return new Query(this.name, { where });
  }

  orderBy(field, direction) {
    return new Query(this.name).orderBy(field, direction);
  }

  skip(value) {
    return new Query(this.name).skip(value);
  }

  limit(value) {
    return new Query(this.name).limit(value);
  }

  field(value) {
    return new Query(this.name).field(value);
  }

  async get() {
    return new Query(this.name).get();
  }
}

const command = {
  in(values) {
    return { __operator: 'in', values };
  }
};

const database = {
  command,
  collection(name) {
    return new Collection(name);
  },
  async createCollection(name) {
    if (collectionExists.has(name)) {
      throw new Error('collection already exists');
    }
    collectionExists.add(name);
    stores[name] = stores[name] || {};
  },
  serverDate() {
    return new Date();
  },
  async runTransaction(callback) {
    return callback(database);
  }
};

const fakeCloud = {
  DYNAMIC_CURRENT_ENV: 'dynamic',
  init() {},
  database() {
    return database;
  },
  getWXContext() {
    return { OPENID: currentOpenid, APPID: 'test-app' };
  }
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'wx-server-sdk') return fakeCloud;
  return originalLoad.call(this, request, parent, isMain);
};

function loadFunction(name) {
  return require(path.join(ROOT, 'cloudfunctions', name, 'index.js')).main;
}

async function seed(collectionName, documents) {
  collectionExists.add(collectionName);
  stores[collectionName] = stores[collectionName] || {};
  documents.forEach((document, index) => {
    const docId = document._id || `seed_${collectionName}_${index + 1}`;
    stores[collectionName][docId] = clone({ ...document, _id: docId });
  });
}

async function expectCode(promise, expectedCode, label) {
  const result = await promise;
  assert.strictEqual(result.code, expectedCode, `${label}: ${result.message || ''}`);
  return result;
}

async function seedFamilyContext() {
  await seed('families', [
    {
      _id: 'family-a',
      name: '测试家庭',
      creatorOpenid: 'user-a',
      inviteCode: 'ABC123',
      memberOpenids: ['user-a'],
      memberCount: 1,
      activeMealId: ''
    }
  ]);
  await seed('family_members', [
    {
      _id: 'member-a',
      familyId: 'family-a',
      openid: 'user-a',
      nickname: '晚云',
      avatar: ''
    }
  ]);
  await seed('meals', []);
  await seed('orders', []);
  await seed('operation_logs', []);
}

async function testInitDataProtection() {
  resetDatabase();
  const initData = loadFunction('initData');
  delete process.env.INIT_ADMIN_OPENIDS;
  await expectCode(initData({}), 403, '未配置管理员时拒绝初始化');

  process.env.INIT_ADMIN_OPENIDS = 'admin-a';
  currentOpenid = 'admin-a';
  await expectCode(initData({}), 0, '管理员可以初始化');

  await seed('baby_foods', [
    {
      _id: 'custom-food',
      name: '家庭自定义粥',
      category: '早餐',
      minMonth: 6,
      maxMonth: 24,
      isCustom: true,
      familyId: 'family-a'
    }
  ]);
  await expectCode(initData({ reset: true }), 0, '管理员可以重置内置数据');
  assert.ok(
    stores.baby_foods['custom-food'],
    '重置时不应删除家庭自定义辅食'
  );
}

async function testMealAndOrderRules() {
  resetDatabase();
  currentOpenid = 'user-a';
  process.env.INIT_ADMIN_OPENIDS = 'admin-a';
  await seedFamilyContext();
  await seed('dishes', [
    {
      _id: 'dish-a',
      name: '西红柿炒蛋',
      imageUrl: '/images/dishes/hot.png'
    }
  ]);

  const startMeal = loadFunction('startMeal');
  const firstMeal = await expectCode(
    startMeal({ familyId: 'family-a', label: '测试晚饭' }),
    0,
    '家庭可以开启当餐'
  );
  await expectCode(
    startMeal({ familyId: 'family-a', label: '重复开启' }),
    1,
    '同一家庭不能重复开启当餐'
  );

  const addOrder = loadFunction('addOrder');
  const added = await expectCode(
    addOrder({
      familyId: 'family-a',
      mealId: firstMeal.data._id,
      dishId: 'dish-a'
    }),
    0,
    '可以点菜'
  );
  await expectCode(
    addOrder({
      familyId: 'family-a',
      mealId: firstMeal.data._id,
      dishId: 'dish-a'
    }),
    2,
    '同一道菜不能重复点'
  );
  assert.strictEqual(
    Object.keys(stores.orders).length,
    1,
    '重复点菜不应产生第二条订单'
  );

  const closeMeal = loadFunction('closeMeal');
  await expectCode(
    closeMeal({
      familyId: 'family-a',
      mealId: firstMeal.data._id
    }),
    0,
    '家庭可以结束当餐'
  );
  assert.strictEqual(
    stores.families['family-a'].activeMealId,
    '',
    '结束当餐后应释放家庭级锁'
  );
  const deleteOrder = loadFunction('deleteOrder');
  await expectCode(
    deleteOrder({ familyId: 'family-a', orderId: added.data.orderId }),
    409,
    '结束后不能删除订单'
  );
  assert.ok(stores.orders[added.data.orderId], '被拒绝删除的订单仍然存在');

  await seed('meals', [
    {
      _id: 'meal-other-family',
      familyId: 'family-b',
      label: '别人家的饭',
      status: 'active'
    }
  ]);
  await expectCode(
    addOrder({
      familyId: 'family-a',
      mealId: 'meal-other-family',
      dishId: 'dish-a'
    }),
    403,
    '不能操作其他家庭的当餐'
  );
  await expectCode(
    closeMeal({
      familyId: 'family-a',
      mealId: 'meal-other-family'
    }),
    403,
    '不能结束其他家庭的当餐'
  );
}

async function testJoinAndProfileSync() {
  resetDatabase();
  currentOpenid = 'user-b';
  await seed('families', [
    {
      _id: 'family-a',
      name: '测试家庭',
      creatorOpenid: 'user-a',
      inviteCode: 'ABC123',
      memberOpenids: ['user-a'],
      memberCount: 1,
      activeMealId: ''
    }
  ]);
  await seed('family_members', [
    {
      _id: 'member-a',
      familyId: 'family-a',
      openid: 'user-a',
      nickname: '晚云'
    },
    {
      _id: 'member-b',
      familyId: 'family-b',
      openid: 'user-b',
      nickname: '旧昵称'
    }
  ]);

  const joinFamily = loadFunction('joinFamily');
  await expectCode(
    joinFamily({
      inviteCode: 'ABC123',
      nickname: '宝子',
      avatar: 'cloud://avatar'
    }),
    0,
    '可以通过邀请码加入'
  );
  await expectCode(
    joinFamily({
      inviteCode: 'ABC123',
      nickname: '宝子',
      avatar: 'cloud://avatar'
    }),
    2,
    '重复加入会被拦截'
  );

  currentOpenid = 'user-b';
  const updateProfile = loadFunction('updateProfile');
  const updated = await expectCode(
    updateProfile({ nickname: '新昵称', avatar: 'cloud://new-avatar' }),
    0,
    '可以同步成员资料'
  );
  assert.strictEqual(updated.data.updated, 2, '所有家庭的成员记录都应更新');
  const memberRecords = Object.values(stores.family_members).filter(
    (member) => member.openid === 'user-b'
  );
  assert.ok(
    memberRecords.every((member) => member.nickname === '新昵称'),
    '成员记录昵称已同步'
  );
}

function testHomeOrderState() {
  const originalGetApp = global.getApp;
  const originalPage = global.Page;
  let pageDefinition = null;
  global.getApp = () => ({ globalData: {} });
  global.Page = (definition) => {
    pageDefinition = definition;
  };

  try {
    const homePath = require.resolve(
      path.join(ROOT, 'pages/home/home.js')
    );
    delete require.cache[homePath];
    require(homePath);
    assert.ok(pageDefinition, '首页 Page 定义应被加载');

    const page = {
      ...pageDefinition,
      data: clone(pageDefinition.data),
      setData(patch) {
        Object.assign(this.data, patch);
      }
    };
    page.data.allDishes = [
      {
        _id: 'dish-a',
        name: '西红柿炒蛋',
        category: '热销',
        imageUrl: '/images/dishes/hot.png'
      }
    ];
    page.applyOrders([
      {
        dishId: 'dish-a',
        dishName: '西红柿炒蛋',
        status: 'pending',
        statusText: '待做'
      }
    ]);

    assert.strictEqual(page.data.orderedDishes[0].dishName, '西红柿炒蛋');
    assert.strictEqual(page.data.dishes[0].ordered, true);
    assert.strictEqual(page.data.dishes[0].orderStatusText, '待做');
  } finally {
    global.getApp = originalGetApp;
    global.Page = originalPage;
  }
}

async function run() {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await testInitDataProtection();
    console.log('  ok   初始化权限与自定义辅食保护');
    await testMealAndOrderRules();
    console.log('  ok   当餐隔离、重复点菜与结束冻结');
    await testJoinAndProfileSync();
    console.log('  ok   加入防重与成员资料同步');
    testHomeOrderState();
    console.log('  ok   首页已点菜名与菜品状态');
    console.log('\n✅ 云函数核心规则测试全部通过\n');
  } finally {
    console.error = originalConsoleError;
    Module._load = originalLoad;
    delete process.env.INIT_ADMIN_OPENIDS;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
