# 更新记录

## 2026-11-18

- 修正初始化步骤：获取 openid 与调用受管理员保护的 `initData` 必须从模拟器 Console 发起，云开发控制台测试没有用户上下文。
- 开发版首页新增 openid 复制与基础数据初始化卡片，正式版不显示。
- 「我的家庭」改由 `login` 云函数依据 `families.memberOpenids/creatorOpenid` 服务端查询，避免客户端权限或历史成员记录缺失导致家庭列表为空。
- 首页新增“本餐已点”菜名与状态清单，整张菜卡展示“已点”，并实时同步其他成员的点菜变化。
- 点菜、状态流转、删除待做与操作日志改为事务写入；同一家庭同一餐同一道菜使用确定性 ID 防并发重复。
- 开启当餐使用家庭级 `activeMealId` 锁；结束当餐、订单状态和删除操作统一校验家庭归属与当餐状态。
- 加入家庭使用事务与稳定成员 ID，家庭创建改为家庭和成员原子写入。
- `initData` 增加 `INIT_ADMIN_OPENIDS` 管理员白名单；重置时保留家庭自定义辅食。
- 新增 `updateProfile` 云函数，昵称和头像会同步到所有家庭成员记录。

## 2026-10-05

- 项目转型：由「变声器」全栈项目（Spring Cloud Gateway + Spring Boot + FFmpeg）整体替换为「家庭点菜」微信小程序，采用原生小程序 + 微信云开发，无自建后端。
- 新增 9 个页面：我的家庭、创建/加入家庭、点菜、菜单（做菜协作）、宝宝辅食、宝宝管理、成员、历史当餐、操作记录。
- 新增 13 个云函数：login、createFamily、joinFamily、leaveFamily、removeMember、startMeal、closeMeal、addOrder、deleteOrder、updateOrderStatus、toggleBabyFood、addBabyFood、initData。
- 新增 8 个云数据库集合与初始化数据（30 道预设菜品 + 16 条辅食）。
- 新增开发脚本：`scripts/gen-images.js`（纯 Node 生成占位图）、`scripts/verify.js`（项目结构自检）。
- 新增文档：`README.md`、`docs/DEPLOY.md`、`docs/DATABASE.md`。
- `initData` 支持自动创建缺失的 8 个云数据库集合，再写入预设菜品与辅食。
- 点菜改为每餐每道菜只能点一次：首页已点菜品自动置灰，删除待做订单后恢复可点。
