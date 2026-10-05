# 部署指南

按顺序完成以下步骤，即可在微信开发者工具中运行本项目。

## 1. 准备小程序

1. 在[微信公众平台](https://mp.weixin.qq.com/)注册小程序，获取 **AppID**。
2. 用微信开发者工具「导入项目」，目录选择本仓库根目录。
3. 在 `project.config.json` 中把 `appid` 换成你自己的 AppID（或用工具界面修改）。

## 2. 开通云开发

1. 开发者工具顶部点击「云开发」，按引导开通，创建一个环境。
2. 复制**环境 ID**，填入 `config.js`：

```js
module.exports = {
  cloudEnvId: '你的环境ID',
  // ...
};
```

> 留空则使用当前账号默认环境，多环境时建议显式填写。

## 3. 创建数据库集合

在「云开发控制台 → 数据库」中新建以下 8 个集合：

```
families  family_members  meals  dishes  orders  operation_logs  babies  baby_foods
```

然后为每个集合配置权限（安全规则），见 [DATABASE.md](DATABASE.md#安全规则在云开发控制台逐集合配置)。

按 [DATABASE.md](DATABASE.md#建议索引) 添加建议索引，其中 `families.inviteCode` 建议设为**唯一索引**。

## 4. 部署云函数

1. 在开发者工具中展开 `cloudfunctions/` 目录。
2. 右键每个云函数目录 → 「上传并部署：云端安装依赖」。
3. 需要部署的云函数共 13 个：

```
login  createFamily  joinFamily  leaveFamily  removeMember
startMeal  closeMeal  addOrder  deleteOrder  updateOrderStatus
toggleBabyFood  addBabyFood  initData
```

> 每个云函数目录内含独立 `package.json` 与 `common.js`，无需额外配置。

## 5. 初始化数据

1. 右键 `cloudfunctions/initData` → 「云端测试」。
2. 测试参数传入 `{}`（首次写入预设菜品与辅食）。
3. 如需**重置**，传 `{ "reset": true }`（会先清空 `dishes` 与 `baby_foods` 再写入）。

返回示例：

```json
{ "code": 0, "data": { "dishesInserted": 30, "foodsInserted": 16 } }
```

## 6. 运行

1. 编译运行小程序。
2. 首页完善昵称与头像。
3. 点击「创建 / 加入家庭」，创建家庭或输入邀请码加入。
4. 进入家庭 → 「开始新的一餐」→ 浏览菜品「加一道」。
5. 切到「菜单」查看状态流转，用另一台设备 / 另一个账号体验实时同步。

## 7. 上线前检查

- [ ] `config.js` 已填写正式环境 ID；
- [ ] 所有集合安全规则已按文档配置；
- [ ] `families.inviteCode` 唯一索引已建立；
- [ ] 占位图已替换为真实照片（上传云存储并更新 `imageUrl`）；
- [ ] 在「开发设置 → 服务器域名」无需配置（本项目不含外部请求）；
- [ ] 已在小程序后台补充隐私协议（涉及头像、昵称、相册等）。

## 常见问题

**Q：首页一直提示「加载中」或云函数报错？**
检查 `config.js` 的环境 ID 是否正确、云函数是否已全部部署。

**Q：实时同步不生效？**
确认 `orders` 集合的 `read` 安全规则允许家庭成员读取，并检查 `memberOpenids` 是否正确维护（加入 / 退出后应同步更新）。

**Q：辅食 tab 不显示？**
「辅食」入口仅在家庭开启辅食推荐后显示；添加宝宝会自动开启（见「成员 → 宝宝管理」）。

**Q：菜品图片是纯色块？**
这是内置占位图。替换为真实图片的流程见 [README](../README.md#图片说明)。
