// 家庭主页（点菜）
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

const CATEGORIES = ['热销', '荤菜', '素菜', '主食', '汤类'];
const ORDER_STATUS_TEXT = {
  pending: '待做',
  cooking: '正在做',
  done: '已完成'
};

/** 按菜品去重，保留最新一条订单 */
function mergeOrders(current, incoming) {
  const byDish = {};
  (current || []).concat(incoming || []).forEach((order) => {
    if (order && order.dishId) byDish[order.dishId] = order;
  });
  return Object.keys(byDish).map((dishId) => byDish[dishId]);
}

function decorateOrder(order) {
  return {
    ...order,
    statusText: ORDER_STATUS_TEXT[order.status] || order.status
  };
}

function sortOrders(orders) {
  return (orders || []).slice().sort(
    (left, right) =>
      new Date(left.createdAt || 0) - new Date(right.createdAt || 0)
  );
}

Page({
  data: {
    familyId: '',
    familyName: '',
    meal: null,
    mealLabel: '',
    categories: CATEGORIES,
    activeCategory: '热销',
    allDishes: [],
    dishes: [],
    orderedDishIds: [],
    orderedDishes: [],
    loading: true,
    starting: false
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setActive('/pages/home/home');
    }
    this.loadContext();
  },

  onHide() {
    this.closeOrderWatch();
  },

  onUnload() {
    this.closeOrderWatch();
  },

  async loadContext() {
    const family = this.resolveFamily();
    if (!family) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    this.setData({
      familyId: family._id,
      familyName: family.name,
      loading: true
    });

    try {
      const meal = await db.getActiveMeal(family._id);
      let orderedDishes = [];
      if (meal) {
        try {
          orderedDishes = await this.loadOrderedDishes(meal, family._id);
        } catch (err) {
          console.error('订单状态加载失败', err);
        }
        this.setupOrderWatch(family._id, meal._id);
      } else {
        this.closeOrderWatch();
      }
      const orderedDishIds = orderedDishes.map((order) => order.dishId);
      this.setData({
        meal,
        mealLabel: meal ? meal.label : '',
        orderedDishIds,
        orderedDishes,
        loading: false
      });
      this.syncTabBar();
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '当餐加载失败', icon: 'none' });
      return;
    }

    try {
      const allDishes = await this.loadDishes();
      this.setData({ allDishes });
      this.applyFilter(this.data.activeCategory);
    } catch (err) {
      this.setData({ allDishes: [], dishes: [] });
      wx.showToast({ title: err.message || '菜品加载失败', icon: 'none' });
    }
  },

  resolveFamily() {
    const family =
      (app.globalData.currentFamilyId && {
        _id: app.globalData.currentFamilyId,
        name: app.globalData.currentFamilyName,
        babyFoodEnabled: app.globalData.babyFoodEnabled
      }) ||
      store.getCurrentFamily();
    return family && family._id ? family : null;
  },

  async loadDishes() {
    if (this._dishesCache) return this._dishesCache;
    const dishes = await db.getAll('dishes', { orderBy: 'sort', order: 'desc' });
    this._dishesCache = dishes;
    return dishes;
  },

  async loadOrderedDishes(meal, familyId) {
    if (!meal) return [];
    let orders = [];

    try {
      const directOrders = await db.getAll('orders', {
        where: {
          familyId: familyId || this.data.familyId,
          mealId: meal._id
        },
        max: 500
      });
      orders = mergeOrders(orders, directOrders);
    } catch (err) {
      console.error('客户端订单读取失败', err);
    }

    try {
      const data = await db.callFunction('addOrder', {
        action: 'list',
        familyId: familyId || this.data.familyId,
        mealId: meal._id
      });
      orders = mergeOrders(orders, (data && data.orders) || []);
    } catch (err) {
      console.error('云函数订单读取失败', err);
    }

    return sortOrders(orders.map(decorateOrder));
  },

  /** 监听当前当餐订单，其他家庭成员点菜后首页状态也会自动刷新 */
  setupOrderWatch(familyId, mealId) {
    this.closeOrderWatch();
    this._orderWatcher = db
      .db()
      .collection('orders')
      .where({ familyId, mealId })
      .watch({
        onChange: (snapshot) => {
          const orders = sortOrders(
            (snapshot.docs || []).map(decorateOrder)
          );
          this.applyOrders(orders);
        },
        onError: (err) => {
          console.error('点菜状态实时监听失败', err);
        }
      });
  },

  closeOrderWatch() {
    if (this._orderWatcher) {
      try {
        this._orderWatcher.close();
      } catch (err) {
        console.warn('关闭点菜状态监听失败', err);
      }
      this._orderWatcher = null;
    }
  },

  syncTabBar() {
    const family = store.getCurrentFamily();
    app.globalData.babyFoodEnabled = family ? !!family.babyFoodEnabled : false;
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().refresh();
    }
  },

  buildDishes(category, orderedDishes) {
    const orderByDish = {};
    (orderedDishes || []).forEach((order) => {
      orderByDish[order.dishId] = order;
    });
    return this.data.allDishes
      .filter((d) => d.category === category)
      .map((dish) => {
        const order = orderByDish[dish._id];
        return {
          ...dish,
          ordered: !!order,
          orderStatusText: order ? order.statusText : ''
        };
      });
  },

  applyFilter(category) {
    const dishes = this.buildDishes(category, this.data.orderedDishes);
    this.setData({ activeCategory: category, dishes });
  },

  applyOrders(orders) {
    const orderedDishes = sortOrders(orders);
    const orderedDishIds = orderedDishes.map((order) => order.dishId);
    this.setData({
      orderedDishes,
      orderedDishIds,
      dishes: this.buildDishes(this.data.activeCategory, orderedDishes)
    });
  },

  onSelectCategory(e) {
    this.applyFilter(e.currentTarget.dataset.category);
  },

  /** 开启新的一餐（名称可编辑） */
  onStartMeal() {
    if (this.data.starting) return;
    const defaultLabel = util.defaultMealLabel();
    wx.showModal({
      title: '开始新的一餐',
      editable: true,
      placeholderText: '餐次名称',
      content: defaultLabel,
      success: async (res) => {
        if (!res.confirm) return;
        const label = (res.content || '').trim() || defaultLabel;
        this.setData({ starting: true });
        try {
          const meal = await db.callFunction('startMeal', {
            familyId: this.data.familyId,
            label
          });
          this.setData({
            meal: { _id: meal._id, label: meal.label, status: 'active' },
            mealLabel: meal.label,
            orderedDishIds: [],
            orderedDishes: [],
            dishes: this.buildDishes(this.data.activeCategory, []),
            starting: false
          });
          this.setupOrderWatch(this.data.familyId, meal._id);
          wx.showToast({ title: '已开启', icon: 'success' });
        } catch (err) {
          this.setData({ starting: false });
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  async onAddDish(e) {
    if (!this.data.meal) {
      wx.showToast({ title: '请先开启一餐', icon: 'none' });
      return;
    }
    const dishId = e.currentTarget.dataset.id;
    if ((this.data.orderedDishIds || []).indexOf(dishId) !== -1) {
      wx.showToast({ title: '这道菜已经点过了', icon: 'none' });
      return;
    }
    try {
      const added = await db.callFunction('addOrder', {
        familyId: this.data.familyId,
        mealId: this.data.meal._id,
        dishId
      });
      const order = decorateOrder({
        ...added,
        _id: added.orderId,
        createdAt: new Date()
      });
      this.applyOrders(mergeOrders(this.data.orderedDishes, [order]));
      wx.showToast({ title: `${added.dishName} 已点`, icon: 'success' });
    } catch (err) {
      if (
        err &&
        (err.code === 2 || /已经点过|已经点过了/.test(err.message || ''))
      ) {
        try {
          const orders = await this.loadOrderedDishes(
            this.data.meal,
            this.data.familyId
          );
          this.applyOrders(orders);
        } catch (loadErr) {
          console.error('刷新已点菜品失败', loadErr);
        }
      }
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  goMenu() {
    wx.switchTab({ url: '/pages/menu/menu' });
  },

  goSwitchFamily() {
    wx.navigateTo({ url: '/pages/index/index' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/meal-history/meal-history' });
  }
});
