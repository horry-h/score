# 麻将记分小程序

基于微信小程序开发的麻将记分应用，支持多人实时记分、分数转移、房间结算等功能。

## 功能特性

### 🎯 核心功能
- **用户管理**: 支持微信授权登录，自定义昵称和头像
- **房间系统**: 创建房间、加入房间、房间分享
- **实时记分**: 支持多人同时记分，实时同步
- **分数转移**: 点击头像快速转移分数，支持详细转移设置
- **智能结算**: 自动计算最优转账方案，最少转账次数
- **历史记录**: 查看所有历史房间的完整流水和结算信息

### 🚀 用户体验
- **最近房间**: 进入小程序后优先显示最近房间，方便续玩
- **快速操作**: 一键创建房间、扫码加入、快速转移
- **实时同步**: 所有操作实时同步到其他玩家
- **便捷分享**: 支持分享房间给好友，复制房间号

## 技术架构

### 前端技术栈
- **框架**: 微信小程序原生开发
- **样式**: WXSS + Flexbox/Grid布局
- **状态管理**: 本地存储 + 页面间传参
- **网络请求**: wx.request API

### 后端技术栈
- **语言**: Go 1.21+
- **框架**: gRPC + Protocol Buffers
- **数据库**: MySQL 8.0+
- **API网关**: gRPC-Gateway

## 项目结构

```
miniprogram/
├── app.js                 # 小程序入口文件
├── app.json              # 全局配置
├── app.wxss              # 全局样式
├── pages/                # 页面目录
│   ├── index/            # 主页面
│   ├── profile/          # 个人信息页面
│   ├── room/             # 房间页面
│   ├── transfer/         # 分数转移页面
│   ├── settlement/       # 结算页面
│   ├── create-room/      # 创建房间页面
│   ├── join-room/        # 加入房间页面
│   ├── history/          # 历史房间页面
│   └── room-detail/      # 房间详情页面
├── utils/                # 工具函数
│   ├── api.js           # API服务
│   └── util.js          # 通用工具
└── README.md            # 项目说明
```

## 页面功能

### 1. 主页面 (index)
- 显示最近房间信息
- 快速创建房间和加入房间
- 一键进入最近房间继续游戏

### 2. 个人信息页面 (profile)
- 设置用户昵称和头像
- 微信授权登录
- 保存用户信息

### 3. 房间页面 (room)
- 显示所有玩家当前分数
- 点击头像快速转移分数
- 查看房间流水记录
- 结算房间和分享房间

### 4. 分数转移页面 (transfer)
- 详细的分数转移设置
- 确认转移信息
- 支持取消操作

### 5. 结算页面 (settlement)
- 显示最终分数
- 展示最优转账方案
- 确认结算操作

### 6. 创建房间页面 (create-room)
- 设置房间名称
- 一键创建房间
- 自动跳转到房间页面

### 7. 加入房间页面 (join-room)
- 扫码加入房间
- 输入房间号加入
- 支持分享链接进入

### 8. 历史房间页面 (history)
- 显示所有历史房间
- 分页加载更多
- 点击查看房间详情

### 9. 房间详情页面 (room-detail)
- 完整的房间信息
- 最终结算结果
- 完整流水记录
- 转账方案详情

## 开发指南

### 环境准备

1. **微信开发者工具**: 下载并安装最新版本
2. **小程序账号**: 注册微信小程序账号
3. **后端服务**: 确保后端服务正常运行

### 本地开发

1. **克隆项目**
```bash
git clone <repository-url>
cd demo-figma/miniprogram
```

2. **配置API地址**
```javascript
// utils/api.js
const API_BASE_URL = 'http://localhost:8080'; // 修改为实际的后端地址
```

3. **导入项目**
- 打开微信开发者工具
- 选择"导入项目"
- 选择miniprogram目录
- 填写AppID（测试可使用测试号）

4. **运行项目**
- 点击"编译"按钮
- 在模拟器中查看效果
- 使用真机调试测试功能

### 配置说明

#### app.json 配置
```json
{
  "pages": [
    "pages/index/index",
    "pages/profile/profile",
    // ... 其他页面
  ],
  "window": {
    "navigationBarBackgroundColor": "#07c160",
    "navigationBarTitleText": "麻将记分",
    "navigationBarTextStyle": "white"
  }
}
```

#### 页面配置
每个页面都有对应的.json配置文件，可以设置：
- 页面标题
- 下拉刷新
- 上拉加载更多
- 自定义组件

### API接口

#### 用户相关
- `login(code, nickname, avatarUrl)` - 用户登录
- `updateUser(userId, nickname, avatarUrl)` - 更新用户信息
- `getUser(userId)` - 获取用户信息

#### 房间相关
- `createRoom(creatorId, roomName)` - 创建房间
- `joinRoom(userId, roomCode)` - 加入房间
- `getRoom(roomId, roomCode)` - 获取房间信息
- `getRoomPlayers(roomId)` - 获取房间玩家
- `getRoomTransfers(roomId)` - 获取转移记录

#### 分数转移
- `transferScore(roomId, fromUserId, toUserId, amount)` - 转移分数

#### 结算相关
- `settleRoom(roomId, userId)` - 结算房间

#### 历史记录
- `getUserRooms(userId, page, pageSize)` - 获取用户房间列表
- `getRoomDetail(roomId, userId)` - 获取房间详情
- `getRecentRoom(userId)` - 获取最近房间

## 部署发布

### 1. 代码审查
- 检查所有功能是否正常
- 测试各种边界情况
- 确保用户体验流畅

### 2. 上传代码
- 在微信开发者工具中点击"上传"
- 填写版本号和项目备注
- 上传到微信后台

### 3. 提交审核
- 登录微信公众平台
- 进入"版本管理"
- 提交审核并等待审核结果

### 4. 发布上线
- 审核通过后点击"发布"
- 小程序正式上线

## 注意事项

### 开发注意
1. **网络请求**: 所有网络请求都需要配置合法域名
2. **用户授权**: 获取用户信息需要用户主动授权
3. **数据存储**: 敏感数据不要存储在本地
4. **性能优化**: 合理使用setData，避免频繁更新

### 安全注意
1. **API安全**: 所有API请求都要验证用户身份
2. **数据验证**: 前端和后端都要进行数据验证
3. **权限控制**: 确保用户只能操作自己的数据

## 常见问题

### Q: 如何修改API地址？
A: 在 `utils/api.js` 文件中修改 `API_BASE_URL` 常量。

### Q: 如何添加新的页面？
A: 1. 在pages目录下创建新页面文件夹；2. 在app.json中添加页面路径；3. 实现页面逻辑。

### Q: 如何处理网络错误？
A: 在API请求中添加错误处理，使用 `showError` 显示错误信息。

### Q: 如何优化页面性能？
A: 1. 合理使用setData；2. 避免在onShow中执行重复操作；3. 使用分页加载大量数据。

## 许可证

MIT License
