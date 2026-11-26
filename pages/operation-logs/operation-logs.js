// 操作记录：通过云函数读取当前餐次日志，避免客户端数据库权限导致空列表
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

const ACTION_TEXT = {
  add: '点了菜',
  prepare: '标记为已准备',
  start: '开始准备',
  done: '标记为已准备',
  delete: '撤下待准备'
};

const STATUS_TEXT = {
  pending: '待准备',
  prepared: '已准备',
  cooking: '已准备',
  done: '已准备'
};

Page({
  data: {
    familyId: '',
    mealId: '',
    mealLabel: '',
    logs: [],
    loading: true
  },

  onLoad(query) {
    const family = store.getCurrentFamily();
    if (!family || !family._id) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    let mealLabel = '';
    try {
      mealLabel = query.mealLabel ? decodeURIComponent(query.mealLabel) : '';
    } catch (e) {
      mealLabel = query.mealLabel || '';
    }
    this.setData({
      familyId: family._id,
      mealId: query.mealId || '',
      mealLabel
    });
    this.loadLogs();
  },

  async loadLogs() {
    this.setData({ loading: true });
    try {
      const data = await db.callFunction('addOrder', {
        action: 'logs',
        familyId: this.data.familyId,
        mealId: this.data.mealId
      });
      const list = (data && data.logs) || [];
      this.setData({
        logs: list
          .map((log) => ({
            ...log,
            actionText: ACTION_TEXT[log.action] || log.action,
            statusText: STATUS_TEXT[log.orderStatusBefore] || log.orderStatusBefore,
            timeText: util.full(log.createdAt)
          }))
          .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)),
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  }
});
