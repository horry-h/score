# 小程序API通信修改说明

## 修改概述

本次修改主要解决了小程序与后台服务的通信问题，确保双方能够正常交互。

## 主要修改内容

### 1. API服务模块 (`utils/api.js`)

- **修正服务器地址**: 将API_BASE_URL从 `http://124.156.196.11:8080` 修正为 `http://124.156.196.117:8080`
- **优化请求方法**: 将async/await改为Promise模式，使用wx.request的success/fail回调
- **修正请求头**: 将`headers`改为`header`（微信小程序API要求）

### 2. 应用入口 (`app.js`)

- **完善用户登录逻辑**: 添加完整的微信登录流程
- **用户信息管理**: 实现用户信息的获取、存储和更新
- **全局数据管理**: 统一管理用户信息在全局状态中

### 3. 首页 (`pages/index/index.js`)

- **用户登录检查**: 在关键操作前检查用户是否已登录
- **最近房间加载**: 从后台API获取最近房间信息
- **错误处理**: 添加完善的错误提示和加载状态

### 4. 创建房间页面 (`pages/create-room/create-room.js`)

- **API调用优化**: 使用正确的API接口创建房间
- **用户验证**: 确保用户已登录才能创建房间
- **状态管理**: 添加加载状态和错误处理

### 5. 加入房间页面 (`pages/join-room/join-room.js`)

- **房间加入逻辑**: 实现通过房间号加入房间
- **数据验证**: 验证房间号格式和用户登录状态
- **成功处理**: 加入成功后保存最近房间信息

### 6. 房间页面 (`pages/room/room.js`)

- **数据加载**: 并行加载房间信息、玩家信息和转移记录
- **分数转移**: 实现快速分数转移功能
- **房间结算**: 实现房间结算功能
- **分享功能**: 实现房间分享和房间号复制

### 7. 历史房间页面 (`pages/history/history.js`)

- **房间列表**: 从后台获取用户的历史房间列表
- **分页加载**: 实现上拉加载更多功能
- **房间状态**: 根据房间状态跳转到不同页面

### 8. 个人信息页面 (`pages/profile/profile.js`)

- **用户信息编辑**: 支持昵称和头像修改
- **微信授权**: 支持微信信息授权
- **信息保存**: 将用户信息保存到后台

## API接口对应关系

| 小程序功能 | API端点 | 方法 | 说明 |
|-----------|---------|------|------|
| 健康检查 | `/api/v1/health` | GET | 检查服务状态 |
| 用户登录 | `/api/v1/login` | POST | 用户登录/注册 |
| 更新用户 | `/api/v1/updateUser` | POST | 更新用户信息 |
| 获取用户 | `/api/v1/getUser` | GET | 获取用户信息 |
| 创建房间 | `/api/v1/createRoom` | POST | 创建新房间 |
| 加入房间 | `/api/v1/joinRoom` | POST | 加入现有房间 |
| 获取房间 | `/api/v1/getRoom` | GET | 获取房间信息 |
| 获取玩家 | `/api/v1/getRoomPlayers` | GET | 获取房间玩家列表 |
| 获取转移记录 | `/api/v1/getRoomTransfers` | GET | 获取分数转移记录 |
| 转移分数 | `/api/v1/transferScore` | POST | 转移分数 |
| 结算房间 | `/api/v1/settleRoom` | POST | 结算房间 |
| 获取用户房间 | `/api/v1/getUserRooms` | GET | 获取用户房间列表 |
| 获取房间详情 | `/api/v1/getRoomDetail` | GET | 获取房间详细信息 |
| 获取最近房间 | `/api/v1/getRecentRoom` | GET | 获取最近进入的房间 |

## 数据格式

### 用户信息
```javascript
{
  user_id: 1,
  nickname: "用户昵称",
  avatar_url: "头像URL",
  openid: "微信openid"
}
```

### 房间信息
```javascript
{
  room_id: 1,
  room_code: "123456",
  room_name: "房间名称",
  creator_id: 1,
  status: 0, // 0:进行中 1:已结算
  created_at: "2024-01-01T00:00:00Z"
}
```

### 玩家信息
```javascript
{
  user_id: 1,
  user: {
    nickname: "玩家昵称",
    avatar_url: "头像URL"
  },
  current_score: 100,
  joined_at: "2024-01-01T00:00:00Z"
}
```

## 错误处理

所有API调用都包含完善的错误处理：
- 网络错误提示
- 服务器错误提示
- 用户输入验证
- 加载状态显示

## 测试

可以使用 `test-api.js` 文件测试API连接：
```javascript
const { runTests } = require('./test-api');
runTests();
```

## 注意事项

1. **网络请求**: 小程序需要在微信开发者工具中配置合法域名
2. **用户授权**: 需要用户授权才能获取微信信息
3. **数据存储**: 用户信息存储在本地storage中
4. **错误处理**: 所有API调用都有错误处理和用户提示

## 部署说明

1. 确保后台服务正常运行在 `124.156.196.117:8080`
2. 在微信开发者工具中导入小程序代码
3. 配置合法域名（如果需要）
4. 测试各个功能模块
5. 发布小程序
