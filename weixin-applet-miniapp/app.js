// app.js
App({
  onLaunch() {
    console.log('变声器小程序启动');
  },

  globalData: {
    // API 基础地址（通过网关访问，部署后改为公网地址）
    apiBaseUrl: 'http://localhost:8080/api/voice',
    // 认证 Token（与 Gateway 的 AuthFilter 一致）
    authToken: 'wanyun-voice-2026'
  }
});
