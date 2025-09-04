# 麻将记分小程序后端服务

基于Go语言开发的麻将记分小程序后端服务。

## 技术栈

- **语言**: Go 1.21+
- **框架**: 原生HTTP服务
- **数据库**: MySQL 8.0+
- **API**: RESTful HTTP/JSON API

## 项目结构

```
server/
├── main.go                 # 主程序入口
├── internal/              # 内部包
│   ├── config/           # 配置管理
│   ├── database/         # 数据库连接
│   ├── handler/          # HTTP处理器
│   └── service/          # 业务逻辑
├── database.sql          # 数据库表结构
├── go.mod               # Go模块依赖
├── Makefile            # 构建脚本
└── README.md           # 项目说明
```

## 快速开始

### 1. 环境准备

- Go 1.21+
- MySQL 8.0+

### 2. 安装依赖

```bash
# 安装Go依赖
make deps
```

### 3. 数据库设置

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE mahjong_score DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 导入表结构
make migrate
```

### 4. 配置环境变量

```bash
# 复制环境变量模板
cp env.example .env

# 编辑配置文件
vim .env
```

### 5. 运行服务

```bash
# 开发模式运行
make run

# 或者构建后运行
make build
./bin/mahjong-server

# 或者使用Docker Compose一键启动（包含MySQL）
make docker-compose-up
```

## API接口

服务提供HTTP/JSON接口 (端口: 8080)：

- RESTful API
- 适合前端调用
- 支持CORS

### 主要接口

- `POST /api/v1/login` - 用户登录
- `POST /api/v1/createRoom` - 创建房间
- `POST /api/v1/joinRoom` - 加入房间
- `GET /api/v1/getRoom` - 获取房间信息
- `POST /api/v1/transferScore` - 转移分数
- `POST /api/v1/settleRoom` - 结算房间
- `GET /api/v1/getUserRooms` - 获取用户房间列表

## 数据库设计

### 主要表结构

- `users` - 用户表
- `rooms` - 房间表
- `room_players` - 房间玩家表
- `score_transfers` - 分数转移记录表
- `settlements` - 结算记录表
- `user_recent_rooms` - 用户最近房间表

## 开发指南

### 添加新的API接口

1. 在 `internal/service/types.go` 中定义新的请求和响应结构体
2. 在 `internal/service/mahjong.go` 中实现业务逻辑
3. 在 `internal/handler/http.go` 中添加HTTP路由处理
4. 更新API文档

### 数据库迁移

```bash
# 修改database.sql文件
vim database.sql

# 重新导入数据库
make migrate
```

## 部署

### Docker部署

```bash
# 使用Docker Compose一键部署（推荐）
make docker-compose-up

# 或者手动构建和运行
make docker-build
make docker-run

# 停止服务
make docker-compose-down
```

### 生产环境配置

1. 设置环境变量
2. 配置数据库连接池
3. 启用日志记录
4. 配置监控和告警

## 监控和日志

- 使用结构化日志记录
- 支持Prometheus指标收集
- 健康检查接口: `/health`

## 许可证

MIT License
