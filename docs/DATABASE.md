# 云数据库设计

本项目使用微信云开发 NoSQL 数据库，共 9 个集合。

## 集合总览

| 集合 | 说明 | 写入方 |
| --- | --- | --- |
| `families` | 家庭 | 云函数 |
| `family_members` | 家庭成员 | 云函数 |
| `meals` | 当餐 | 云函数 |
| `dishes` | 内置 + 家庭自定义菜品库 | `initData`（管理员）+ `manageDish` 云函数 |
| `dish_overrides` | 家庭对内置菜图片的覆盖 | `manageDish` 云函数 |
| `orders` | 点菜记录 | 云函数 |
| `operation_logs` | 操作记录 | 云函数（只增不删） |
| `babies` | 宝宝档案 | 小程序端（成员） |
| `baby_foods` | 辅食库 | `initData` + `addBabyFood` 云函数 |

## 字段说明

### families（家庭）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 家庭 ID |
| `name` | string | 家庭名称 |
| `creatorOpenid` | string | 创建人 openid |
| `inviteCode` | string | 邀请码（唯一，6 位） |
| `babyFoodEnabled` | boolean | 是否开启辅食推荐 |
| `memberOpenids` | array | 成员 openid 数组（**安全规则用**） |
| `memberCount` | number | 成员数（列表展示用） |
| `activeMealId` | string | 当前进行中的当餐 ID（家庭级并发锁，空闲时为空） |
| `activeMealLabel` | string | 当前进行中的当餐名称（快捷展示用） |
| `createdAt` | date | 创建时间 |

> `memberOpenids` 与 `memberCount` 是为了让数据库安全规则能够判断「是否为该家庭成员」，由 `createFamily` / `joinFamily` / `leaveFamily` / `removeMember` 云函数维护；`activeMealId` 由 `startMeal` / `closeMeal` 维护。

### family_members（家庭成员）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 记录 ID |
| `familyId` | string | 所属家庭 ID |
| `openid` | string | 成员 openid |
| `nickname` | string | 昵称 |
| `avatar` | string | 头像 URL / fileID |
| `joinedAt` | date | 加入时间 |

### meals（当餐）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 餐次 ID |
| `familyId` | string | 所属家庭 |
| `label` | string | 餐次名称，如「1月15日 晚饭」 |
| `status` | string | `active` / `closed` |
| `createdBy` / `createdByName` | string | 开启人 |
| `createdAt` | date | 开启时间 |
| `closedBy` / `closedByName` | string | 结束人 |
| `closedAt` | date | 结束时间 |
| `postNote` | string | 餐后记录文字，最多 500 字 |
| `photoFileIDs` | array | 餐后留影的云存储 fileID，最多 9 张 |
| `recordedBy` / `recordedByName` | string | 餐后记录提交人 |
| `recordedAt` | date | 餐后记录时间 |

### dishes（菜品库）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 菜品 ID |
| `name` / `desc` | string | 名称 / 描述 |
| `category` | string | 热销 / 荤菜 / 素菜 / 主食 / 汤类 / 宝妈专属 |
| `imageUrl` | string | 图片（占位图或云存储 fileID） |
| `price` | number | 价格（界面不显示） |
| `sort` | number | 排序权重 |
| `isCustom` | boolean | 是否为家庭自定义菜品；内置菜为 `false` 或未设置 |
| `familyId` | string | 自定义菜所属家庭；内置菜为空 |
| `postpartumFriendly` | boolean | 是否同时在「宝妈专属」分类中推荐 |
| `createdBy` | string | 自定义菜创建人 openid |
| `createdAt` / `updatedAt` | date | 创建 / 更新时间 |

### dish_overrides（默认菜图片覆盖）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 由 `familyId + dishId` 稳定生成 |
| `familyId` / `dishId` | string | 所属家庭 / 内置菜品 |
| `imageUrl` | string | 家庭上传的云存储图片 fileID |
| `updatedBy` / `updatedAt` | string / date | 更新人 / 更新时间 |

### orders（点菜记录）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 订单 ID；新订单由 `familyId + mealId + dishId` 稳定生成，防止并发重复 |
| `familyId` / `mealId` | string | 所属家庭 / 当餐 |
| `dishId` / `dishName` / `dishImage` | string | 菜品信息（后两者冗余） |
| `orderedBy` / `orderedByName` | string | 点菜人 |
| `quantity` | number | 数量（当前固定为 1，保留字段兼容） |
| `status` | string | `pending` / `cooking` / `done` |
| `cookingBy` / `cookingByName` | string | 开始做的人 |
| `doneBy` / `doneByName` | string | 完成的人 |
| `createdAt` / `updatedAt` | date | 时间 |

### operation_logs（操作记录）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 日志 ID |
| `familyId` / `mealId` / `orderId` | string | 关联信息 |
| `action` | string | `add` / `start` / `done` / `delete` |
| `dishId` / `dishName` | string | 目标菜品 |
| `orderedBy` / `orderedByName` | string | 原点菜人 |
| `orderStatusBefore` | string | 操作前状态 |
| `operatorOpenid` / `operatorName` / `operatorAvatar` | string | 操作人 |
| `createdAt` | date | 操作时间 |

### babies（宝宝档案）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 宝宝 ID |
| `familyId` | string | 所属家庭 |
| `nickname` / `gender` / `birthday` | string | 昵称 / 性别 / 出生日期 |
| `createdAt` | date | 添加时间 |

### baby_foods（辅食库）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 辅食 ID |
| `name` / `imageUrl` | string | 名称 / 图片 |
| `minMonth` / `maxMonth` | number | 适合月龄区间 |
| `category` | string | 早餐 / 午餐 / 晚餐 / 加餐 |
| `ingredients` / `steps` | array | 食材 / 步骤 |
| `nutrition` | string | 营养说明 |
| `isCustom` | boolean | 是否家庭自定义 |
| `familyId` | string | 自定义时所属家庭，内置为空 |
| `createdAt` | date | 创建时间 |

## 安全规则（在云开发控制台逐集合配置）

> 规则语法以控制台为准。下面按「家庭成员可读写家庭数据、写入主要走云函数」的思路设计。写入（新增 / 修改 / 删除）绝大多数交给云函数（以管理员身份运行，不受规则限制），因此大多数集合客户端 `write` 设为 `false`。

**families**

```json
{
  "read": "auth.openid in doc.memberOpenids",
  "write": false
}
```

**family_members**

```json
{
  "read": "doc.openid == auth.openid || auth.openid in get(`database.families.${doc.familyId}`).memberOpenids",
  "write": false
}
```

**meals**

```json
{
  "read": "auth.openid in get(`database.families.${doc.familyId}`).memberOpenids",
  "write": false
}
```

**dishes**

```json
{
  "read": false,
  "write": false
}
```

> 菜品列表统一由 `manageDish` 云函数返回：内置菜 + 当前家庭自定义菜。客户端无需直接读取 `dishes`。

**dish_overrides**

```json
{
  "read": false,
  "write": false
}
```

**orders**

```json
{
  "read": "auth.openid in get(`database.families.${doc.familyId}`).memberOpenids",
  "write": false
}
```

> `orders` 的实时监听依赖 `read` 规则；请确认 `memberOpenids` 已正确维护。

**operation_logs**

```json
{
  "read": "auth.openid in get(`database.families.${doc.familyId}`).memberOpenids",
  "write": false
}
```

**babies**（成员可在小程序端直接增删改）

```json
{
  "read": "auth.openid in get(`database.families.${doc.familyId}`).memberOpenids",
  "write": "auth.openid in get(`database.families.${doc.familyId}`).memberOpenids"
}
```

**baby_foods**

```json
{
  "read": "doc.isCustom == false || auth.openid in get(`database.families.${doc.familyId}`).memberOpenids",
  "write": false
}
```

## 建议索引

| 集合 | 索引字段 | 用途 |
| --- | --- | --- |
| `families` | `inviteCode`（唯一） | 邀请码查询 |
| `family_members` | `familyId` + `openid` | 成员校验 / 我的家庭 |
| `family_members` | `familyId` + `joinedAt` | 成员列表排序 |
| `meals` | `familyId` + `status` | 进行中当餐 / 历史当餐 |
| `orders` | `familyId` + `mealId` | 当餐订单 / 实时监听 |
| `orders` | `familyId` + `mealId` + `status` | 状态分组 |
| `orders` | `familyId` + `mealId` + `dishId`（唯一） | 历史数据兜底，禁止同餐重复菜品 |
| `dish_overrides` | `familyId` + `dishId` | 家庭默认菜图片覆盖 |
| `operation_logs` | `familyId` + `mealId` + `createdAt` | 操作记录 |
| `babies` | `familyId` | 宝宝列表 |
| `baby_foods` | `familyId` + `isCustom` | 自定义辅食 |
