# 家庭点菜微信小程序

面向家庭成员内部协作的微信小程序，解决三件事：

1. **今天吃什么** —— 家庭成员一起点菜，按「当餐」组织
2. **做到哪一步了** —— 实时同步、标记进度、操作留痕
3. **宝宝吃什么** —— 按月龄推荐每日辅食

不涉及支付、桌号、库存、打印，是纯家庭协作工具。

## 技术栈

- **小程序**：微信小程序原生开发（WXML / WXSS / JS）
- **后端**：微信云开发（云数据库 + 云函数 + 云存储）
- **实时同步**：云数据库 `watch()`
- **无第三方后端**：所有服务端逻辑都在云函数中

## 目录结构

```
.
├── app.js / app.json / app.wxss     # 全局配置与样式
├── config.js                        # 云环境 ID 等配置
├── project.config.json              # 开发者工具项目配置
├── custom-tab-bar/                  # 自定义底部导航（可隐藏「辅食」）
├── utils/
│   ├── db.js                        # 数据库 / 云函数调用封装
│   ├── store.js                     # 本地存储（资料、当前家庭、换菜记录）
│   ├── util.js                      # 日期、月龄等工具
│   └── recommend.js                 # 辅食推荐种子算法
├── pages/                           # 9 个页面
│   ├── index/                       # 我的家庭列表
│   ├── family-edit/                 # 创建 / 加入家庭
│   ├── home/                        # 家庭主页（点菜）
│   ├── menu/                        # 菜单（做菜协作）
│   ├── baby-food/                   # 宝宝辅食推荐
│   ├── baby-manage/                 # 宝宝管理
│   ├── members/                     # 成员与设置
│   ├── meal-history/                # 历史当餐
│   └── operation-logs/              # 操作记录
├── cloudfunctions/                  # 云函数
├── images/                          # 占位图片
├── scripts/gen-images.js            # 占位图生成脚本
└── docs/                            # 数据库与部署文档
```

## 快速开始

> 完整步骤见 [docs/DEPLOY.md](docs/DEPLOY.md)，数据库结构见 [docs/DATABASE.md](docs/DATABASE.md)。

1. 用微信开发者工具打开本目录，填入自己的 AppID。
2. 开通云开发，把环境 ID 填进 `config.js` 的 `cloudEnvId`。
3. 在云开发控制台创建 8 个集合（见 DATABASE 文档），并配置权限。
4. 上传部署 `cloudfunctions/` 下的全部云函数。
5. 云端测试运行一次 `initData`，写入预设菜品与辅食。
6. 编译运行，首页完善资料 → 创建家庭 → 开始点菜。

## 云函数一览

| 云函数 | 作用 |
| --- | --- |
| `login` | 获取当前用户 openid |
| `createFamily` | 创建家庭，创建人自动成为成员 |
| `joinFamily` | 通过邀请码加入家庭 |
| `leaveFamily` | 退出家庭（创建人不可退出） |
| `removeMember` | 创建人移出成员 |
| `startMeal` | 开启当餐（同时只允许一个进行中） |
| `closeMeal` | 结束当餐 |
| `addOrder` | 点菜（同一人重复点同一道菜合并数量）+ 写日志 |
| `deleteOrder` | 删除待做订单（仅 pending）+ 写日志 |
| `updateOrderStatus` | 状态流转 pending → cooking → done + 写日志 |
| `toggleBabyFood` | 开关家庭辅食推荐 |
| `addBabyFood` | 家庭自定义辅食的增 / 改 / 删 |
| `initData` | 初始化预设菜品库与辅食库 |

> 每个云函数目录内都有一份 `common.js`（公共工具）。修改公共逻辑时请同步到所有目录，或在部署脚本中统一复制。

## 核心业务规则

### 订单状态机（单向不可逆）

```
pending（待做）── 开始做 ──▶ cooking（正在做）── 好了 ──▶ done（已完成）
```

- 只有 `pending` 可删除，且所有人可删；
- `cooking` / `done` 不可删除、不可回退，前端不渲染按钮，云函数二次拦截；
- 每次点菜 / 开始做 / 完成 / 删除待做都会写入 `operation_logs`，日志只增不删。

### 当餐

- 同一家庭同时只允许一个进行中的当餐；
- 结束后所有订单冻结，历史当餐永久保留、只读。

### 辅食推荐

- 根据宝宝出生日期计算月龄（向下取整）；
- 从 `baby_foods` 按 `minMonth ≤ 月龄 ≤ maxMonth` 筛选；
- 用「宝宝 ID + 日期」做随机种子，保证当天结果稳定，第二天自动更换；
- 「换一道」按同分类候选池重新偏移选取，当天生效。

## 图片说明

`images/` 下是脚本生成的**占位图**，开箱即可运行。正式上线建议：

1. 准备真实菜品 / 辅食照片；
2. 上传到云存储，拿到 `cloud://...` 形式的 fileID；
3. 替换 `cloudfunctions/initData/data/*.js` 里的 `imageUrl`，或直接在数据库里改；
4. 重新运行 `initData`。

## 授权与资料

首次进入会引导填写昵称与头像（使用微信「头像昵称填写能力」，符合当前平台规范）。头像会上传到云存储持久化，昵称与头像会写入成员记录。
