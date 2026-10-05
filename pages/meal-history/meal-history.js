// 历史当餐：查看已结束的餐次及其订单（只读）
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

Page({
  data: {
    familyId: '',
    meals: [],
    loading: true,
    openMealId: '',
    orders: [],
    ordersLoading: false
  },

  onShow() {
    const family = store.getCurrentFamily();
    if (!family || !family._id) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    this.setData({ familyId: family._id });
    this.loadMeals();
  },

  async loadMeals() {
    this.setData({ loading: true });
    try {
      const list = await db.getAll('meals', {
        where: { familyId: this.data.familyId, status: 'closed' },
        orderBy: 'createdAt',
        order: 'desc'
      });
      this.setData({
        meals: list.map((m) => ({
          ...m,
          createdAtText: util.mDweek(m.createdAt),
          closedAtText: util.mdhm(m.closedAt)
        })),
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async onTapMeal(e) {
    const meal = this.data.meals[e.currentTarget.dataset.index];
    if (this.data.openMealId === meal._id) {
      this.setData({ openMealId: '', orders: [] });
      return;
    }
    this.setData({ openMealId: meal._id, ordersLoading: true, orders: [] });
    try {
      const list = await db.getAll('orders', {
        where: { familyId: this.data.familyId, mealId: meal._id },
        orderBy: 'createdAt',
        order: 'asc'
      });
      this.setData({
        orders: list.map((o) => ({
          ...o,
          statusText: { pending: '待做', cooking: '正在做', done: '已完成' }[o.status]
        })),
        ordersLoading: false
      });
    } catch (err) {
      this.setData({ ordersLoading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  goLogs(e) {
    const meal = this.data.meals[e.currentTarget.dataset.index];
    wx.navigateTo({
      url: `/pages/operation-logs/operation-logs?mealId=${meal._id}&mealLabel=${encodeURIComponent(
        meal.label
      )}`
    });
  }
});
