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

推荐先完成第 4 步部署云函数，再运行 `initData` 自动创建缺失集合。若不想使用云函数自动创建，也可以在「云开发控制台 → 数据库」中手动新建以下 9 个集合：

```
families  family_members  meals  dishes  dish_overrides  orders  operation_logs  babies  baby_foods
```

然后为每个集合配置权限（安全规则），见 [DATABASE.md](DATABASE.md#安全规则在云开发控制台逐集合配置)。

按 [DATABASE.md](DATABASE.md#建议索引) 添加建议索引，其中 `families.inviteCode` 建议设为**唯一索引**。

## 4. 部署云函数

1. 在开发者工具中展开 `cloudfunctions/` 目录。
2. 右键每个云函数目录 → 「上传并部署：云端安装依赖」。
3. 需要部署的云函数共 16 个：

```
login  createFamily  joinFamily  leaveFamily  removeMember  deleteFamily
startMeal  closeMeal  addOrder  deleteOrder  updateOrderStatus
toggleBabyFood  addBabyFood  updateProfile  manageDish  initData
```

> 每个云函数目录内含独立 `package.json` 与 `common.js`，无需额外配置。

## 5. 初始化数据

> 云开发控制台的「测试」没有真实的小程序用户上下文，`wxContext.OPENID` 会为空，因此不能用来获取 openid 或执行受管理员保护的 `initData`。开发版首页已经提供复制 openid 和初始化基础数据的调试卡片。

1. 先点击开发者工具顶部「编译」，让小程序正常进入首页。
2. 在首页「开发调试信息」卡片中点击「复制 openid」。
3. 如果调试卡片没有出现，可打开「调试器 → Console」，执行：

```js
wx.cloud.callFunction({ name: 'login' }).then((res) => {
  console.log('OPENID=', res.result.data.openid);
});
```

4. 在「云开发 → 云函数 → initData → 函数配置 → 环境变量」添加：

```
INIT_ADMIN_OPENIDS=管理员openid1,管理员openid2
```

5. 保存环境变量后，回到开发版首页，点击「同步预设菜单」。该操作会重建内置菜和内置辅食，但保留家庭自定义内容。
6. 如果按钮调用失败，可在小程序 Console 中执行：

```js
wx.cloud.callFunction({ name: 'initData', data: {} }).then((res) => {
  console.log('INIT_RESULT=', JSON.stringify(res.result));
});
```

7. 首次初始化会自动创建缺失集合，并写入 21 道预设菜品与 16 条辅食。
8. 开发版按钮会以 `{ reset: true }` 调用；家庭自定义菜品、默认菜家庭图片和自定义辅食均不会被删除。

> `initData` 未配置管理员或调用人不在白名单时会返回 403，这是安全保护，不是部署故障。

返回示例：

```json
{
  "code": 0,
  "data": {
    "createdCollections": [
      "families",
      "family_members",
      "meals",
      "dishes",
      "dish_overrides",
      "orders",
      "operation_logs",
      "babies",
      "baby_foods"
    ],
    "dishesInserted": 21,
    "foodsInserted": 16
  }
}
```

`createdCollections` 只包含本次新建的集合；重复运行会自动跳过已存在的集合。

> 如果首次运行仍提示 `Invoking task timed out after 3 seconds`，在「云开发 → 云函数 → initData → 函数配置」中把超时时间临时调整为 20 秒后重试。

## 6. 运行

1. 编译运行小程序。
2. 首页完善昵称与头像。
3. 点击「创建 / 加入家庭」，创建家庭或输入邀请码加入。
4. 进入家庭 → 「开始新的一餐」→ 浏览菜品「加一道」。
5. 切到「菜单」查看状态流转，用另一台设备 / 另一个账号体验实时同步。
6. 菜品完成后点击「结束这一餐」，填写餐后记录并上传照片；保存后可在「历史当餐」查看菜品和留影。

## 7. 上线前检查

- [ ] `config.js` 已填写正式环境 ID；
- [ ] 所有集合安全规则已按文档配置；
- [ ] `families.inviteCode` 唯一索引已建立；
- [ ] `orders.familyId + mealId + dishId` 唯一索引已建立；
- [ ] `initData` 已配置 `INIT_ADMIN_OPENIDS` 环境变量；
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
