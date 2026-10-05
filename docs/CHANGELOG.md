# 更新记录

## 2026-10-05

- 项目转型：由「变声器」全栈项目（Spring Cloud Gateway + Spring Boot + FFmpeg）整体替换为「家庭点菜」微信小程序，采用原生小程序 + 微信云开发，无自建后端。
- 新增 9 个页面：我的家庭、创建/加入家庭、点菜、菜单（做菜协作）、宝宝辅食、宝宝管理、成员、历史当餐、操作记录。
- 新增 13 个云函数：login、createFamily、joinFamily、leaveFamily、removeMember、startMeal、closeMeal、addOrder、deleteOrder、updateOrderStatus、toggleBabyFood、addBabyFood、initData。
- 新增 8 个云数据库集合与初始化数据（30 道预设菜品 + 16 条辅食）。
- 新增开发脚本：`scripts/gen-images.js`（纯 Node 生成占位图）、`scripts/verify.js`（项目结构自检）。
- 新增文档：`README.md`、`docs/DEPLOY.md`、`docs/DATABASE.md`。
