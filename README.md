# 麻将记分小程序

一个基于微信小程序的麻将记分应用，支持房间创建、玩家管理、分数转移和结算功能。

## 项目结构

```
├── miniprogram/          # 微信小程序前端
│   ├── pages/           # 页面文件
│   ├── components/      # 组件
│   ├── utils/          # 工具函数
│   └── images/         # 图片资源
├── server/             # Go后端服务
│   ├── internal/       # 内部包
│   ├── main.go        # 主程序入口
│   └── database.sql   # 数据库结构
├── deploy.sh          # 部署脚本
├── update.sh          # 更新脚本
└── restart.sh         # 重启脚本
```

## 功能特性

- **用户管理**: 微信授权登录，用户信息管理
- **房间管理**: 创建房间、加入房间、房间分享
- **记分功能**: 实时分数记录、分数转移
- **结算功能**: 自动计算最优结算方案
- **历史记录**: 查看历史房间和交易记录

## 技术栈

### 前端
- 微信小程序原生开发
- WXSS样式
- 微信API集成

### 后端
- Go 1.21+
- MySQL 8.0+
- HTTP/JSON API
- 微信登录集成

## 快速开始

### 1. 部署后端服务

```bash
# 在腾讯云服务器上执行
./deploy.sh
```

### 2. 配置小程序

1. 在微信开发者工具中导入 `miniprogram` 目录
2. 配置服务器域名白名单
3. 配置微信登录参数

### 3. 数据库配置

数据库配置已硬编码在 `server/internal/config/config.go` 中：
- 用户名: `root`
- 密码: `123456`
- 数据库: `mahjong_score`

## API接口

### 用户相关
- `POST /api/v1/login` - 用户登录
- `GET /api/v1/getUser` - 获取用户信息
- `POST /api/v1/validateSession` - 验证会话

### 房间相关
- `POST /api/v1/createRoom` - 创建房间
- `POST /api/v1/joinRoom` - 加入房间
- `GET /api/v1/getRoom` - 获取房间信息
- `GET /api/v1/getRecentRoom` - 获取最近房间

### 游戏相关
- `POST /api/v1/transferScore` - 转移分数
- `POST /api/v1/settleRoom` - 结算房间
- `GET /api/v1/getRoomPlayers` - 获取房间玩家
- `GET /api/v1/getRoomTransfers` - 获取转移记录

## 部署说明

### 服务器要求
- Ubuntu 20.04+
- Go 1.21+
- MySQL 8.0+
- 公网IP: 124.156.196.117

### 部署命令
```bash
# 一键部署
./deploy.sh

# 更新代码
./update.sh

# 重启服务
./restart.sh
```

## 开发说明

### 房间ID生成
- 使用时间戳+随机数生成唯一的 `room_code`
- 数据库主键 `id` 保持自增
- 前端使用 `room_code` 进行房间跳转

### 微信登录流程
1. 前端调用 `wx.login()` 获取临时登录凭证
2. 后端调用微信 `jscode2session` API 获取 `openid`
3. 生成自定义会话ID并返回给前端
4. 前端使用会话ID进行后续API调用

## 许可证

MIT License