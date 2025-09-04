# Score - 麻将记分小程序

一个基于微信小程序的麻将记分应用，支持实时记分、房间管理、历史记录等功能。

## 项目结构

```
score/
├── deploy.sh              # 一键部署脚本
├── update.sh              # 快速更新脚本
├── DEPLOY.md              # 部署说明文档
├── server/                # 后端服务 (Go)
│   ├── main.go           # 主程序入口
│   ├── database.sql      # 数据库表结构
│   ├── go.mod            # Go模块依赖
│   ├── internal/         # 内部包
│   │   ├── config/       # 配置管理
│   │   ├── database/     # 数据库连接
│   │   ├── handler/      # HTTP处理器
│   │   └── service/      # 业务逻辑
│   └── README.md         # 后端说明文档
├── miniprogram/          # 微信小程序前端
│   ├── app.json         # 小程序配置
│   ├── app.wxss         # 全局样式
│   ├── utils/           # 工具函数
│   │   ├── api.js       # API接口
│   │   └── util.js      # 通用工具
│   └── pages/           # 页面文件
│       ├── index/       # 首页
│       ├── profile/     # 个人信息
│       ├── room/        # 房间页面
│       ├── transfer/    # 分数转移
│       ├── settlement/  # 结算页面
│       ├── create-room/ # 创建房间
│       ├── join-room/   # 加入房间
│       ├── history/     # 历史记录
│       └── room-detail/ # 房间详情
└── README.md            # 项目说明文档
```

## 技术栈

### 后端
- **语言**: Go 1.21+
- **框架**: 原生HTTP服务
- **数据库**: MySQL 8.0+
- **API**: RESTful HTTP/JSON API

### 前端
- **平台**: 微信小程序
- **语言**: JavaScript + WXML + WXSS
- **UI**: 原生小程序组件

## 快速开始

### 本地开发

1. **后端开发**
```bash
cd server
go mod tidy
go run main.go
```

2. **小程序开发**
- 使用微信开发者工具打开 `miniprogram` 目录
- 配置AppID和服务器域名

### 生产部署

1. **服务器部署**
```bash
# 连接服务器
ssh root@124.156.196.117

# 克隆项目
mkdir -p /root/horry
cd /root/horry
git clone <your-repo-url> score
cd score

# 一键部署
./deploy.sh
```

2. **后续更新**
```bash
cd /root/horry/score
./update.sh
```

## 服务信息

- **服务器**: 124.156.196.117
- **API地址**: http://124.156.196.117:8080
- **健康检查**: http://124.156.196.117:8080/api/v1/health
- **项目目录**: /root/horry/score

## 主要功能

- ✅ 用户管理（昵称、头像、微信授权）
- ✅ 房间管理（创建、加入、分享）
- ✅ 实时记分（分数转移、流水记录）
- ✅ 房间结算（自动计算、转账方案）
- ✅ 历史记录（房间历史、详细流水）
- ✅ 最近房间（快速续玩）

## API接口

### 用户相关
- `POST /api/v1/login` - 用户登录
- `POST /api/v1/updateUser` - 更新用户信息
- `GET /api/v1/getUser` - 获取用户信息

### 房间相关
- `POST /api/v1/createRoom` - 创建房间
- `POST /api/v1/joinRoom` - 加入房间
- `GET /api/v1/getRoom` - 获取房间信息
- `GET /api/v1/getRoomPlayers` - 获取房间玩家
- `GET /api/v1/getRoomTransfers` - 获取房间流水

### 分数转移
- `POST /api/v1/transferScore` - 转移分数

### 结算相关
- `POST /api/v1/settleRoom` - 结算房间

### 历史记录
- `GET /api/v1/getUserRooms` - 获取用户房间列表
- `GET /api/v1/getRoomDetail` - 获取房间详情
- `GET /api/v1/getRecentRoom` - 获取最近房间

### 系统
- `GET /api/v1/health` - 健康检查

## 数据库设计

- `users` - 用户表
- `rooms` - 房间表
- `room_players` - 房间玩家表
- `transfers` - 分数转移表
- `settlements` - 结算表
- `user_recent_rooms` - 用户最近房间表

## 部署说明

详细的部署说明请参考 [DEPLOY.md](./DEPLOY.md)

## 开发说明

### 后端开发
详细的开发说明请参考 [server/README.md](./server/README.md)

### 前端开发
小程序开发请参考微信官方文档，主要页面包括：
- 首页：最近房间、快速操作
- 个人信息：昵称、头像设置
- 房间页面：玩家列表、分数转移、流水记录
- 分数转移：详细的转移设置
- 结算页面：最终分数、转账方案
- 历史记录：所有历史房间列表
- 房间详情：完整的房间信息和流水

## 许可证

MIT License