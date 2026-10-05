// app.js
const config = require('./config');
const store = require('./utils/store');

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库版本过低，请使用 2.2.3 或以上版本以使用云能力');
      return;
    }
    // 初始化云开发环境；envId 为空时使用账号默认环境
    wx.cloud.init({
      env: config.cloudEnvId || undefined,
      traceUser: true
    });

    // 恢复上次进入的家庭与用户资料
    const profile = store.getProfile();
    const family = store.getCurrentFamily();
    if (profile) this.globalData.userInfo = profile;
    if (family) {
      this.globalData.currentFamilyId = family._id;
      this.globalData.currentFamilyName = family.name;
      this.globalData.babyFoodEnabled = !!family.babyFoodEnabled;
    }
  },

  globalData: {
    // 登录后拿到的 openid
    openid: '',
    // 当前用户资料（昵称 / 头像），用于写入成员记录
    userInfo: null,
    // 当前进入的家庭
    currentFamilyId: '',
    currentFamilyName: '',
    // 当前家庭是否开启辅食推荐（决定底部导航是否显示「辅食」）
    babyFoodEnabled: false
  }
});
