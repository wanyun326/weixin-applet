// 成员页：成员列表、邀请码分享、退出 / 移出、辅食设置入口
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

Page({
  data: {
    familyId: '',
    familyName: '',
    inviteCode: '',
    creatorOpenid: '',
    babyFoodEnabled: false,
    openid: '',
    isCreator: false,
    members: [],
    loading: true
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) {
      this.getTabBar().setActive('/pages/members/members');
    }
    this.loadContext();
  },

  async loadContext() {
    const family = store.getCurrentFamily();
    if (!family || !family._id) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    this.setData({ familyId: family._id, familyName: family.name, loading: true });

    try {
      await this.ensureOpenid();
      const openid = app.globalData.openid;

      const familyDoc = await db.db().collection('families').doc(family._id).get();
      const fam = familyDoc.data;

      const memberList = await db.getAll('family_members', {
        where: { familyId: family._id },
        orderBy: 'joinedAt',
        order: 'asc'
      });

      const members = memberList.map((m) => ({
        ...m,
        joinedAtText: util.mdhm(m.joinedAt),
        isCreator: m.openid === fam.creatorOpenid,
        isSelf: m.openid === openid
      }));

      const babyFoodEnabled = !!fam.babyFoodEnabled;
      // 同步家庭设置到本地与全局（影响底部导航）
      const localFamily = store.getCurrentFamily();
      localFamily.name = fam.name;
      localFamily.babyFoodEnabled = babyFoodEnabled;
      store.setCurrentFamily(localFamily);
      app.globalData.babyFoodEnabled = babyFoodEnabled;
      if (this.getTabBar && this.getTabBar()) this.getTabBar().refresh();

      this.setData({
        inviteCode: fam.inviteCode,
        creatorOpenid: fam.creatorOpenid,
        isCreator: fam.creatorOpenid === openid,
        babyFoodEnabled,
        openid,
        members,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async ensureOpenid() {
    if (app.globalData.openid) return app.globalData.openid;
    const res = await db.callFunction('login');
    app.globalData.openid = res.openid;
    return res.openid;
  },

  copyCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    });
  },

  onShareAppMessage() {
    return {
      title: `邀请你加入「${this.data.familyName}」一起点菜`,
      path: `/pages/index/index?inviteCode=${this.data.inviteCode}`
    };
  },

  onRemove(e) {
    const member = this.data.members[e.currentTarget.dataset.index];
    wx.showModal({
      title: '移出成员',
      content: `确定将「${member.nickname}」移出家庭吗？对方已点的菜会保留。`,
      confirmText: '移出',
      confirmColor: '#E4572E',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await db.callFunction('removeMember', {
            familyId: this.data.familyId,
            memberOpenid: member.openid
          });
          wx.showToast({ title: '已移出', icon: 'success' });
          this.loadContext();
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  onLeave() {
    wx.showModal({
      title: '退出家庭',
      content: `确定退出「${this.data.familyName}」吗？退出后将看不到该家庭的数据。`,
      confirmText: '退出',
      confirmColor: '#E4572E',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await db.callFunction('leaveFamily', { familyId: this.data.familyId });
          store.clearCurrentFamily();
          app.globalData.currentFamilyId = '';
          app.globalData.currentFamilyName = '';
          app.globalData.babyFoodEnabled = false;
          wx.reLaunch({ url: '/pages/index/index' });
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  async onToggleBabyFood(e) {
    const enabled = e.detail.value;
    try {
      await db.callFunction('toggleBabyFood', {
        familyId: this.data.familyId,
        enabled
      });
      const localFamily = store.getCurrentFamily();
      localFamily.babyFoodEnabled = enabled;
      store.setCurrentFamily(localFamily);
      app.globalData.babyFoodEnabled = enabled;
      this.setData({ babyFoodEnabled: enabled });
      if (this.getTabBar && this.getTabBar()) this.getTabBar().refresh();
      wx.showToast({ title: enabled ? '已开启辅食推荐' : '已关闭辅食推荐', icon: 'none' });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  goBabyManage() {
    wx.navigateTo({ url: '/pages/baby-manage/baby-manage' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/meal-history/meal-history' });
  }
});
