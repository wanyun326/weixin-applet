// 菜单（备餐协作）：待准备 -> 已准备；历史 cooking/done 统一视为已准备
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');
const share = require('../../utils/share');

const STATUS_TEXT = {
  pending: '待准备',
  prepared: '已准备',
  cooking: '已准备',
  done: '已准备'
};

Page({
  data: {
    familyId: '',
    familyName: '',
    hasMeal: false,
    mealId: '',
    mealLabel: '',
    pending: [],
    prepared: [],
    inviteCode: '',
    loading: true
  },

  onShow() {
    share.enableShareMenu();
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
    this.loadFamilyInvite(family._id);

    try {
      const meal = await db.getActiveMeal(family._id);
      if (!meal) {
        this.closeWatch();
        this.setData({
          hasMeal: false,
          mealId: '',
          mealLabel: '',
          pending: [],
          prepared: [],
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
      this.startOrderSync(family._id, meal._id);
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async loadFamilyInvite(familyId) {
    try {
      const detail = await db.callFunction('login', { familyId });
      this.setData({
        inviteCode: (detail.family && detail.family.inviteCode) || ''
      });
    } catch (err) {
      console.error('分享邀请码加载失败', err);
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

  /** 通过云函数轮询，避免客户端数据库权限导致订单列表为空 */
  startOrderSync(familyId, mealId) {
    this.closeWatch();
    this.refreshOrders(familyId, mealId);
    this._pollTimer = setInterval(() => {
      this.refreshOrders(familyId, mealId);
    }, 3000);
  },

  async refreshOrders(familyId, mealId) {
    if (this._orderSyncing) return;
    this._orderSyncing = true;
    try {
      const data = await db.callFunction('addOrder', {
        action: 'list',
        familyId: familyId || this.data.familyId,
        mealId: mealId || this.data.mealId
      });
      this.renderOrders((data && data.orders) || []);
    } catch (err) {
      console.error('订单同步失败', err);
    } finally {
      this._orderSyncing = false;
    }
  },

  closeWatch() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  renderOrders(docs) {
    const decorate = (o) => ({
      ...o,
      statusText: STATUS_TEXT[o.status],
      createdAtText: util.mdhm(o.createdAt)
    });
    const byTimeAsc = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
    const byPreparedDesc = (a, b) =>
      new Date(b.preparedAt || b.updatedAt || b.createdAt) -
      new Date(a.preparedAt || a.updatedAt || a.createdAt);

    this.setData({
      pending: docs.filter((o) => o.status === 'pending').map(decorate).sort(byTimeAsc),
      prepared: docs
        .filter((o) => o.status !== 'pending')
        .map(decorate)
        .sort(byPreparedDesc)
    });
  },

  onPrepare(e) {
    this.updateStatus(e.currentTarget.dataset.id, 'prepare');
  },

  async updateStatus(orderId, action) {
    try {
      await db.callFunction('updateOrderStatus', {
        familyId: this.data.familyId,
        orderId,
        action
      });
      await this.refreshOrders();
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
          await this.refreshOrders();
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  onCloseMeal() {
    wx.navigateTo({
      url: `/pages/meal-record/meal-record?mealId=${this.data.mealId}&mealLabel=${encodeURIComponent(
        this.data.mealLabel
      )}`
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
  },

  onShareAppMessage() {
    return share.familyShare(this.data.familyName, this.data.inviteCode);
  },

  onShareTimeline() {
    return share.timelineShare(this.data.familyName, this.data.inviteCode);
  }
});
