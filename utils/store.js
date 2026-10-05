/**
 * 本地存储封装：用户资料、当前家庭、辅食换菜记录
 */

const KEY_PROFILE = 'fc_profile';
const KEY_FAMILY = 'fc_current_family';
const KEY_SWAP = 'fc_food_swap';

/** 用户资料（昵称 / 头像） */
function getProfile() {
  return wx.getStorageSync(KEY_PROFILE) || null;
}

function setProfile(profile) {
  wx.setStorageSync(KEY_PROFILE, profile);
}

/** 当前进入的家庭 { _id, name, babyFoodEnabled } */
function getCurrentFamily() {
  return wx.getStorageSync(KEY_FAMILY) || null;
}

function setCurrentFamily(family) {
  wx.setStorageSync(KEY_FAMILY, family);
}

function clearCurrentFamily() {
  wx.removeStorageSync(KEY_FAMILY);
}

/**
 * 辅食「换一道」记录
 * 结构：{ [babyId|date]: { 早餐: salt, 午餐: salt, 晚餐: salt, 加餐: salt } }
 * salt 越大表示换过越多次，用于在候选池里换到不同的菜
 */
function getSwapMap() {
  return wx.getStorageSync(KEY_SWAP) || {};
}

function getSwapSalt(babyId, date, category) {
  const map = getSwapMap();
  const key = `${babyId}|${date}`;
  return (map[key] && map[key][category]) || 0;
}

function bumpSwapSalt(babyId, date, category) {
  const map = getSwapMap();
  const key = `${babyId}|${date}`;
  if (!map[key]) map[key] = {};
  map[key][category] = (map[key][category] || 0) + 1;
  wx.setStorageSync(KEY_SWAP, map);
  return map[key][category];
}

module.exports = {
  getProfile,
  setProfile,
  getCurrentFamily,
  setCurrentFamily,
  clearCurrentFamily,
  getSwapSalt,
  bumpSwapSalt
};
