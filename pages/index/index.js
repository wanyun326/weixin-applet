// 首页：我的家庭列表 + 用户资料设置
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

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
      const openid = await this.ensureOpenid();
      const profile = store.getProfile();
      const families = await db.getMyFamilies(openid);

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

  async ensureOpenid() {
    if (app.globalData.openid) return app.globalData.openid;
    const res = await db.callFunction('login');
    app.globalData.openid = res.openid;
    return res.openid;
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
