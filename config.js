/**
 * 全局配置
 * 部署前把 cloudEnvId 改成你自己的云开发环境 ID。
 */
module.exports = {
  // 云开发环境 ID。留空字符串时使用当前账号的默认环境。
  // 在「微信开发者工具 -> 云开发 -> 设置 -> 环境 ID」中查看。
  cloudEnvId: '',

  // 业务常量
  ORDER_STATUS: {
    PENDING: 'pending',
    COOKING: 'cooking',
    DONE: 'done'
  },
  MEAL_STATUS: {
    ACTIVE: 'active',
    CLOSED: 'closed'
  },
  FOOD_CATEGORIES: ['早餐', '午餐', '晚餐', '加餐']
};
