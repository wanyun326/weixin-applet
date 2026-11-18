// 首页：我的家庭列表 + 用户资料设置
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

/** 仅在开发版显示初始化辅助信息，不会出现在正式版 */
function isDevelopVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo.miniProgram.envVersion === 'develop';
  } catch (err) {
    return false;
  }
}

Page({
  data: {
    loading: true,
    openid: '',
    profile: null,
    // 资料编辑草稿
    draftNickname: '',
    draftAvatar: '',
    editingProfile: false,
    saving: false,
    showOpenidDebug: false,
    initializingData: false,
    deletingFamilyId: '',
    families: []
  },

  onLoad(query) {
    // 通过分享卡片进入时携带邀请码，直接跳到加入页
    if (query && query.inviteCode) {
      wx.navigateTo({
        url: `/pages/family-edit/family-edit?inviteCode=${query.inviteCode}`
      });
    }
  },

  onShow() {
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh());
  },

  /** 登录（拿 openid）+ 拉取资料与家庭列表 */
  async refresh() {
    this.setData({ loading: true });
    try {
      const login = await this.ensureLogin();
      const openid = login.openid;
      const profile = store.getProfile();
      // 先展示调试信息，即使数据库集合尚未初始化也能复制 openid。
      this.setData({
        openid,
        showOpenidDebug: isDevelopVersion(),
        profile,
        editingProfile: !profile,
        draftNickname: profile ? profile.nickname : '',
        draftAvatar: profile ? profile.avatar : ''
      });
      const families = login.families || [];

      this.setData({
        openid,
        profile,
        editingProfile: !profile,
        draftNickname: profile ? profile.nickname : '',
        draftAvatar: profile ? profile.avatar : '',
        families: families.map((f) => ({
          _id: f._id,
          name: f.name,
          memberCount: f.memberCount || 1,
          babyFoodEnabled: !!f.babyFoodEnabled,
          isCreator: f.creatorOpenid === openid,
          createdAtText: util.mDweek(f.createdAt)
        })),
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async ensureLogin() {
    const res = await db.callFunction('login');
    app.globalData.openid = res.openid;
    return res;
  },

  copyOpenid() {
    if (!this.data.openid) return;
    wx.setClipboardData({
      data: this.data.openid,
      success: () => wx.showToast({ title: 'openid 已复制', icon: 'success' })
    });
  },

  async onInitData() {
    if (this.data.initializingData) return;
    this.setData({ initializingData: true });
    try {
      const result = await db.callFunction('initData', { reset: true });
      wx.showModal({
        title: '预设菜单已同步',
        content: `当前预设菜品 ${result.dishesInserted || 0} 道，辅食 ${
          result.foodsInserted || 0
        } 条。家庭自定义菜品不会被删除。`,
        showCancel: false
      });
      this.refresh();
    } catch (err) {
      wx.showModal({
        title: '初始化失败',
        content: err.message || '请检查 initData 是否已部署和配置管理员',
        showCancel: false
      });
    } finally {
      this.setData({ initializingData: false });
    }
  },

  // ---- 资料设置 ----
  onChooseAvatar(e) {
    this.setData({ draftAvatar: e.detail.avatarUrl });
  },

  onNicknameInput(e) {
    this.setData({ draftNickname: e.detail.value });
  },

  onEditProfile() {
    const profile = this.data.profile;
    this.setData({
      editingProfile: true,
      draftNickname: profile ? profile.nickname : '',
      draftAvatar: profile ? profile.avatar : ''
    });
  },

  async onSaveProfile() {
    const nickname = (this.data.draftNickname || '').trim();
    if (!nickname) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      let avatar = this.data.draftAvatar || '';
      // 新选择的头像为本地临时路径，需上传到云存储持久化
      if (avatar && !/^cloud:\/\//.test(avatar)) {
        avatar = await this.uploadAvatar(avatar);
      }
      const profile = { nickname, avatar };
      // 资料不只保存在本机，还要同步到所有家庭成员记录，避免成员页继续显示旧昵称。
      await db.callFunction('updateProfile', profile);
      store.setProfile(profile);
      app.globalData.userInfo = profile;
      this.setData({ profile, editingProfile: false, saving: false });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      this.setData({ saving: false });
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  uploadAvatar(tempFilePath) {
    const openid = this.data.openid || 'anonymous';
    const ext = (tempFilePath.match(/\.(\w+)$/) || [, 'png'])[1];
    const cloudPath = `avatars/${openid}_${Date.now()}.${ext}`;
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: (err) => reject(new Error(err.errMsg || '头像上传失败'))
      });
    });
  },

  // ---- 家庭操作 ----
  goFamilyEdit() {
    if (!this.data.profile) {
      wx.showToast({ title: '请先设置昵称', icon: 'none' });
      this.setData({ editingProfile: true });
      return;
    }
    wx.navigateTo({ url: '/pages/family-edit/family-edit' });
  },

  onDeleteFamily(e) {
    if (this.data.deletingFamilyId) return;
    const family = this.data.families[e.currentTarget.dataset.index];
    wx.showModal({
      title: '解散家庭',
      content: `确定永久解散「${family.name}」吗？该家庭的成员、当餐、订单、操作记录、宝宝和自定义辅食都会删除，无法恢复。`,
      confirmText: '解散',
      confirmColor: '#E4572E',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ deletingFamilyId: family._id });
        try {
          await db.callFunction('deleteFamily', { familyId: family._id });
          const currentFamily = store.getCurrentFamily();
          if (currentFamily && currentFamily._id === family._id) {
            store.clearCurrentFamily();
            app.globalData.currentFamilyId = '';
            app.globalData.currentFamilyName = '';
            app.globalData.babyFoodEnabled = false;
          }
          await this.refresh();
          wx.showToast({ title: '家庭已解散', icon: 'success' });
        } catch (err) {
          wx.showToast({ title: err.message || '解散失败', icon: 'none' });
        } finally {
          this.setData({ deletingFamilyId: '' });
        }
      }
    });
  },

  enterFamily(e) {
    if (!this.data.profile) {
      wx.showToast({ title: '请先设置昵称', icon: 'none' });
      this.setData({ editingProfile: true });
      return;
    }
    const family = this.data.families[e.currentTarget.dataset.index];
    app.globalData.currentFamilyId = family._id;
    app.globalData.currentFamilyName = family.name;
    app.globalData.babyFoodEnabled = family.babyFoodEnabled;
    store.setCurrentFamily({
      _id: family._id,
      name: family.name,
      babyFoodEnabled: family.babyFoodEnabled
    });
    wx.switchTab({ url: '/pages/home/home' });
  }
});
