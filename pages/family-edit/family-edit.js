// 创建 / 加入家庭
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');

Page({
  data: {
    tab: 'create',
    name: '',
    inviteCode: '',
    // 资料
    profile: null,
    draftNickname: '',
    draftAvatar: '',
    needProfile: false,
    submitting: false
  },

  onLoad(query) {
    if (query && query.inviteCode) {
      this.setData({ tab: 'join', inviteCode: query.inviteCode });
    }
  },

  onShow() {
    const profile = store.getProfile();
    this.setData({
      profile,
      draftNickname: profile ? profile.nickname : '',
      draftAvatar: profile ? profile.avatar : '',
      needProfile: !profile
    });
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onCodeInput(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase() });
  },

  onNicknameInput(e) {
    this.setData({ draftNickname: e.detail.value });
  },

  onChooseAvatar(e) {
    this.setData({ draftAvatar: e.detail.avatarUrl });
  },

  /** 保存资料（若需要），返回可用于云函数的资料对象 */
  async ensureProfile() {
    const stored = store.getProfile();
    const nickname = (this.data.draftNickname || '').trim();
    if (!nickname) {
      throw new Error('请填写昵称');
    }
    let avatar = this.data.draftAvatar || '';
    // 与已保存资料一致则直接复用，避免重复上传
    if (stored && stored.nickname === nickname && stored.avatar === avatar) {
      return stored;
    }
    if (avatar && !/^cloud:\/\//.test(avatar)) {
      avatar = await this.uploadAvatar(avatar);
    }
    const profile = { nickname, avatar };
    store.setProfile(profile);
    app.globalData.userInfo = profile;
    return profile;
  },

  uploadAvatar(tempFilePath) {
    const openid = app.globalData.openid || 'anonymous';
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

  async onSubmit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const profile = await this.ensureProfile();
      let family;
      if (this.data.tab === 'create') {
        const name = (this.data.name || '').trim();
        if (!name) throw new Error('请输入家庭名称');
        family = await db.callFunction('createFamily', {
          name,
          nickname: profile.nickname,
          avatar: profile.avatar
        });
      } else {
        const inviteCode = (this.data.inviteCode || '').trim();
        if (!inviteCode) throw new Error('请输入邀请码');
        family = await db.callFunction('joinFamily', {
          inviteCode,
          nickname: profile.nickname,
          avatar: profile.avatar
        });
      }

      // 进入新家庭
      app.globalData.currentFamilyId = family._id;
      app.globalData.currentFamilyName = family.name;
      app.globalData.babyFoodEnabled = !!family.babyFoodEnabled;
      store.setCurrentFamily({
        _id: family._id,
        name: family.name,
        babyFoodEnabled: !!family.babyFoodEnabled
      });
      wx.showToast({ title: '成功', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 400);
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
