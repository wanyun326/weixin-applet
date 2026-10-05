// 操作记录：当前/指定当餐的所有操作日志，按时间倒序，只读不可删
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

const ACTION_TEXT = {
  add: '点了菜',
  start: '开始做',
  done: '做好了',
  delete: '删除了待做'
};

const STATUS_TEXT = { pending: '待做', cooking: '正在做', done: '已完成' };

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
      const list = await db.getAll('operation_logs', {
        where: { familyId: this.data.familyId, mealId: this.data.mealId },
        orderBy: 'createdAt',
        order: 'desc'
      });
      this.setData({
        logs: list.map((log) => ({
          ...log,
          actionText: ACTION_TEXT[log.action] || log.action,
          statusText: STATUS_TEXT[log.orderStatusBefore] || log.orderStatusBefore,
          timeText: util.full(log.createdAt)
        })),
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  }
});
