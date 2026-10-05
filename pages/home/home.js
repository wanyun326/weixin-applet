// 家庭主页（点菜）
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

const CATEGORIES = ['热销', '荤菜', '素菜', '主食', '汤类'];

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
    loading: true,
    starting: false
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setActive('/pages/home/home');
    }
    this.loadContext();
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
      const allDishes = await this.loadDishes();
      this.setData({
        meal,
        mealLabel: meal ? meal.label : '',
        allDishes,
        loading: false
      });
      this.applyFilter(this.data.activeCategory);
      this.syncTabBar();
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
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

  syncTabBar() {
    const family = store.getCurrentFamily();
    app.globalData.babyFoodEnabled = family ? !!family.babyFoodEnabled : false;
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().refresh();
    }
  },

  applyFilter(category) {
    const dishes = this.data.allDishes.filter((d) => d.category === category);
    this.setData({ activeCategory: category, dishes });
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
            starting: false
          });
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
    try {
      await db.callFunction('addOrder', {
        familyId: this.data.familyId,
        mealId: this.data.meal._id,
        dishId
      });
      wx.showToast({ title: '已加入菜单', icon: 'success' });
    } catch (err) {
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
