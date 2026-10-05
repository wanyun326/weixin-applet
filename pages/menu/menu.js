// 菜单（做菜协作）：实时同步订单状态，pending -> cooking -> done 单向流转
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

const STATUS_TEXT = { pending: '待做', cooking: '正在做', done: '已完成' };

Page({
  data: {
    familyId: '',
    familyName: '',
    hasMeal: false,
    mealId: '',
    mealLabel: '',
    pending: [],
    cooking: [],
    done: [],
    showDone: true,
    loading: true
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setActive('/pages/menu/menu');
    }
    this.loadContext();
  },

  onHide() {
    this.closeWatch();
  },

  onUnload() {
    this.closeWatch();
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
      if (!meal) {
        this.closeWatch();
        this.setData({
          hasMeal: false,
          mealId: '',
          mealLabel: '',
          pending: [],
          cooking: [],
          done: [],
          loading: false
        });
        return;
      }
      this.setData({
        hasMeal: true,
        mealId: meal._id,
        mealLabel: meal.label,
        loading: false
      });
      this.setupWatch(family._id, meal._id);
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  resolveFamily() {
    const family =
      (app.globalData.currentFamilyId && {
        _id: app.globalData.currentFamilyId,
        name: app.globalData.currentFamilyName
      }) ||
      store.getCurrentFamily();
    return family && family._id ? family : null;
  },

  /** 建立实时监听 */
  setupWatch(familyId, mealId) {
    this.closeWatch();
    this._watcher = db
      .db()
      .collection('orders')
      .where({ familyId, mealId })
      .watch({
        onChange: (snapshot) => this.renderOrders(snapshot.docs || []),
        onError: (err) => {
          console.error('订单实时监听失败', err);
        }
      });
  },

  closeWatch() {
    if (this._watcher) {
      try {
        this._watcher.close();
      } catch (e) {
        // ignore
      }
      this._watcher = null;
    }
  },

  renderOrders(docs) {
    const decorate = (o) => ({
      ...o,
      statusText: STATUS_TEXT[o.status],
      createdAtText: util.mdhm(o.createdAt)
    });
    const byTimeAsc = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
    const byTimeDesc = (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);

    this.setData({
      pending: docs.filter((o) => o.status === 'pending').map(decorate).sort(byTimeAsc),
      cooking: docs.filter((o) => o.status === 'cooking').map(decorate).sort(byTimeAsc),
      done: docs.filter((o) => o.status === 'done').map(decorate).sort(byTimeDesc)
    });
  },

  toggleDone() {
    this.setData({ showDone: !this.data.showDone });
  },

  onStart(e) {
    this.updateStatus(e.currentTarget.dataset.id, 'start');
  },

  onFinish(e) {
    this.updateStatus(e.currentTarget.dataset.id, 'done');
  },

  async updateStatus(orderId, action) {
    try {
      await db.callFunction('updateOrderStatus', {
        familyId: this.data.familyId,
        orderId,
        action
      });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  onDelete(e) {
    const orderId = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: '删除这道菜',
      content: `确定删除「${name}」吗？删除后不可恢复。`,
      confirmText: '删除',
      confirmColor: '#E4572E',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await db.callFunction('deleteOrder', {
            familyId: this.data.familyId,
            orderId
          });
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  onCloseMeal() {
    wx.showModal({
      title: '结束这一餐',
      content: '结束后所有订单将被冻结，不能再修改。确定结束吗？',
      confirmText: '结束',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await db.callFunction('closeMeal', {
            familyId: this.data.familyId,
            mealId: this.data.mealId
          });
          wx.showToast({ title: '这一餐已结束', icon: 'success' });
          this.closeWatch();
          this.setData({ hasMeal: false, mealId: '', mealLabel: '', pending: [], cooking: [], done: [] });
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  goOrder() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goLogs() {
    wx.navigateTo({
      url: `/pages/operation-logs/operation-logs?mealId=${this.data.mealId}&mealLabel=${encodeURIComponent(
        this.data.mealLabel
      )}`
    });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/meal-history/meal-history' });
  }
});
