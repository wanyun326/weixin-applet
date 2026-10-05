// 云函数：登录，返回当前用户 openid
const { cloud, ok, handler } = require('./common');

exports.main = handler(async (event, openid, wxContext) => {
  return ok({
    openid,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID || ''
  });
});
