// app.js
App({
  onLaunch() {
    console.log('变声器小程序启动');
  },

  globalData: {
    // API 基础地址（通过网关访问）
    apiBaseUrl: 'http://localhost:8080/api/voice'
  }
});
