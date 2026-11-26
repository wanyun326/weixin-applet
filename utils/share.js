/**
 * 小程序分享配置
 * 家庭邀请优先携带邀请码，普通页面分享小程序首页。
 */
const SHARE_IMAGE = '/images/dishes/presets/fanqie-chaodan.jpg';

function enableShareMenu() {
  if (!wx.showShareMenu) return;
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
}

function appShare() {
  return {
    title: '家里这一餐，一起安排',
    path: '/pages/index/index',
    imageUrl: SHARE_IMAGE
  };
}

function familyShare(familyName, inviteCode) {
  if (!inviteCode) return appShare();
  return {
    title: `来「${familyName || '我家'}」一起点菜`,
    path: `/pages/index/index?inviteCode=${encodeURIComponent(inviteCode)}`,
    imageUrl: SHARE_IMAGE
  };
}

function timelineShare(familyName, inviteCode) {
  return {
    title: inviteCode
      ? `来「${familyName || '我家'}」一起安排这一餐`
      : '家里这一餐，一起安排',
    query: inviteCode ? `inviteCode=${encodeURIComponent(inviteCode)}` : '',
    imageUrl: SHARE_IMAGE
  };
}

module.exports = {
  enableShareMenu,
  appShare,
  familyShare,
  timelineShare
};
