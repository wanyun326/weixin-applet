/**
 * 小程序邀请配置
 * 仅允许通过微信好友发送家庭邀请，不开放朋友圈等公开分享入口。
 */
const SHARE_IMAGE = '/images/dishes/presets/fanqie-chaodan.jpg';

function enableShareMenu() {
  if (!wx.showShareMenu) return;
  wx.showShareMenu({
    menus: ['shareAppMessage']
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
    title: `邀请你加入「${familyName || '我家'}」私密家庭`,
    path: `/pages/index/index?inviteCode=${encodeURIComponent(inviteCode)}`,
    imageUrl: SHARE_IMAGE
  };
}

module.exports = {
  enableShareMenu,
  appShare,
  familyShare
};
