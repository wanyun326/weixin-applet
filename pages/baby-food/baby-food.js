// 宝宝辅食：按宝宝月龄推荐今日 4 餐，支持换一道与家庭自定义辅食
const config = require('../../config');
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');
const recommend = require('../../utils/recommend');

const CATEGORIES = config.FOOD_CATEGORIES;

Page({
  data: {
    familyId: '',
    enabled: false,
    loading: true,
    babies: [],
    babyNames: [],
    babyIndex: 0,
    currentBaby: null,
    dateText: '',
    recommendations: [],
    customFoods: [],
    categories: CATEGORIES,
    // 添加表单
    showForm: false,
    submitting: false,
    form: {
      name: '',
      category: '早餐',
      minMonth: '6',
      maxMonth: '24',
      ingredientsText: '',
      stepsText: '',
      nutrition: ''
    }
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setActive('/pages/baby-food/baby-food');
    }
    this.loadContext();
  },

  async loadContext() {
    const family = store.getCurrentFamily();
    if (!family || !family._id) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    const enabled = !!family.babyFoodEnabled;
    this.setData({ familyId: family._id, enabled, loading: true });

    if (!enabled) {
      this.setData({ loading: false });
      return;
    }

    try {
      const babies = await this.loadBabies();
      const allFoods = await this.loadFoods();
      this._allFoods = allFoods;

      if (!babies.length) {
        this.setData({ babies: [], babyNames: [], currentBaby: null, recommendations: [], loading: false });
        return;
      }

      const babyIndex = Math.min(this.data.babyIndex, babies.length - 1);
      const currentBaby = babies[babyIndex];
      this.setData({
        babies,
        babyNames: babies.map((b) => `${b.nickname}（${b.ageMonths} 个月）`),
        babyIndex,
        currentBaby,
        loading: false
      });
      this.refreshRecommendations();
      this.setData({
        customFoods: allFoods.filter((f) => f.isCustom).map((f) => ({
          ...f,
          monthText: `${f.minMonth}-${f.maxMonth} 月`
        }))
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async loadBabies() {
    const res = await db
      .db()
      .collection('babies')
      .where({ familyId: this.data.familyId })
      .orderBy('createdAt', 'asc')
      .get();
    return res.data.map((b) => ({ ...b, ageMonths: util.monthAge(b.birthday) }));
  },

  async loadFoods() {
    // 内置辅食对所有人生效，自定义辅食由数据库权限限制为仅本家庭可见
    return db.getAll('baby_foods', { max: 1000 });
  },

  /** 用「宝宝ID + 日期」做种子生成今日推荐（含换一道偏移） */
  refreshRecommendations() {
    const baby = this.data.currentBaby;
    if (!baby) return;
    const date = util.ymd(new Date());
    const saltMap = {};
    CATEGORIES.forEach((c) => {
      saltMap[c] = store.getSwapSalt(baby._id, date, c);
    });

    const list = recommend.recommendDaily(this._allFoods || [], {
      babyId: baby._id,
      date,
      ageMonths: baby.ageMonths,
      categories: CATEGORIES,
      saltMap
    });

    this.setData({
      dateText: date,
      recommendations: list.map((item) => ({
        category: item.category,
        food: item.food
          ? {
              ...item.food,
              monthText: `${item.food.minMonth}-${item.food.maxMonth} 月`
            }
          : null
      }))
    });
  },

  onSelectBaby(e) {
    const babyIndex = Number(e.detail.value);
    this.setData({ babyIndex, currentBaby: this.data.babies[babyIndex] });
    this.refreshRecommendations();
  },

  onChangeFood(e) {
    const category = e.currentTarget.dataset.category;
    const baby = this.data.currentBaby;
    if (!baby) return;
    const date = util.ymd(new Date());
    store.bumpSwapSalt(baby._id, date, category);
    this.refreshRecommendations();
  },

  goBabyManage() {
    wx.navigateTo({ url: '/pages/baby-manage/baby-manage' });
  },

  // ---- 自定义辅食 ----
  openForm() {
    this.setData({
      showForm: true,
      form: {
        name: '',
        category: '早餐',
        minMonth: '6',
        maxMonth: '24',
        ingredientsText: '',
        stepsText: '',
        nutrition: ''
      }
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onFormCategory(e) {
    this.setData({ 'form.category': CATEGORIES[e.detail.value] });
  },

  async onSubmit() {
    const f = this.data.form;
    if (!f.name.trim()) {
      wx.showToast({ title: '请填写辅食名称', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await db.callFunction('addBabyFood', {
        familyId: this.data.familyId,
        action: 'add',
        food: {
          name: f.name.trim(),
          category: f.category,
          minMonth: Number(f.minMonth) || 0,
          maxMonth: Number(f.maxMonth) || 36,
          ingredients: f.ingredientsText
            .split(/[,，、\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          steps: f.stepsText
            .split(/\n/)
            .map((s) => s.trim())
            .filter(Boolean),
          nutrition: f.nutrition.trim()
        }
      });
      this.setData({ showForm: false, submitting: false });
      wx.showToast({ title: '已添加', icon: 'success' });
      this.loadContext();
    } catch (err) {
      this.setData({ submitting: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  onDeleteFood(e) {
    const food = this.data.customFoods[e.currentTarget.dataset.index];
    wx.showModal({
      title: '删除辅食',
      content: `确定删除自定义辅食「${food.name}」吗？`,
      confirmText: '删除',
      confirmColor: '#E4572E',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await db.callFunction('addBabyFood', {
            familyId: this.data.familyId,
            action: 'delete',
            foodId: food._id
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadContext();
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  noop() {}
});
