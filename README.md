# 麻将记分小程序 - 完整项目

一个完整的麻将记分微信小程序项目，包含前端小程序和后端服务，支持多人实时记分、分数转移、智能结算等功能。

## 🎯 项目概述

本项目是一个麻将记分小程序，旨在为麻将爱好者提供便捷的记分工具。用户可以通过小程序创建房间、邀请好友加入、实时记录分数、进行分数转移，最终智能结算输赢。

### 核心特性

- 🏠 **房间系统**: 创建房间、加入房间、房间分享
- 👥 **多人协作**: 支持多人同时记分，实时同步
- 💰 **分数管理**: 实时分数记录、转移、结算
- 🧮 **智能结算**: 自动计算最优转账方案
- 📱 **便捷操作**: 点击头像快速转移，一键分享
- 📊 **历史记录**: 完整的游戏历史和流水记录
- 🔄 **实时同步**: 所有操作实时同步到所有玩家

## 🏗️ 技术架构

### 前端 (微信小程序)
- **框架**: 微信小程序原生开发
- **样式**: WXSS + Flexbox/Grid布局
- **状态管理**: 本地存储 + 页面间传参
- **网络请求**: wx.request API

### 后端 (Go服务)
- **语言**: Go 1.21+
- **框架**: 原生HTTP服务
- **数据库**: MySQL 8.0+
- **API**: RESTful HTTP/JSON API

## 📁 项目结构

```
demo-figma/
├── miniprogram/              # 微信小程序前端
│   ├── app.js               # 小程序入口
│   ├── app.json             # 全局配置
│   ├── app.wxss             # 全局样式
│   ├── pages/               # 页面目录
│   │   ├── index/           # 主页面
│   │   ├── profile/         # 个人信息
│   │   ├── room/            # 房间页面
│   │   ├── transfer/        # 分数转移
│   │   ├── settlement/      # 结算页面
│   │   ├── create-room/     # 创建房间
│   │   ├── join-room/       # 加入房间
│   │   ├── history/         # 历史房间
│   │   └── room-detail/     # 房间详情
│   ├── utils/               # 工具函数
│   │   ├── api.js          # API服务
│   │   └── util.js         # 通用工具
│   └── README.md           # 小程序说明
├── server/                  # Go后端服务
│   ├── main.go             # 主程序入口
│   ├── internal/           # 内部包
│   │   ├── config/         # 配置管理
│   │   ├── database/       # 数据库连接
│   │   ├── handler/        # HTTP处理器
│   │   └── service/        # 业务逻辑
│   ├── database.sql        # 数据库表结构
│   ├── go.mod             # Go模块依赖
│   ├── Makefile           # 构建脚本
│   └── README.md          # 后端说明
├── prototype.html          # 原型设计文件
├── note.md                # 需求文档
├── detail.md              # 开发需求
└── README.md              # 项目总说明
```

## 🚀 快速开始

### 环境要求

- **Go**: 1.21+
- **MySQL**: 8.0+
- **微信开发者工具**: 最新版本

### 1. 后端服务启动

```bash
# 进入后端目录
cd server

# 安装依赖
make deps

# 设置数据库
mysql -u root -p -e "CREATE DATABASE mahjong_score DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
make migrate

# 配置环境变量
cp env.example .env
# 编辑.env文件，设置数据库连接信息

# 启动服务
make run

# 或者使用Docker Compose一键启动（包含MySQL）
make docker-compose-up
```

后端服务将在以下端口启动：
- HTTP API: `localhost:8080`

### 2. 小程序开发

```bash
# 进入小程序目录
cd miniprogram

# 使用微信开发者工具打开miniprogram目录
# 配置AppID（可使用测试号）
# 修改utils/api.js中的API_BASE_URL为后端服务地址
```

### 3. 数据库初始化

```sql
-- 创建数据库
CREATE DATABASE mahjong_score DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 导入表结构
USE mahjong_score;
SOURCE database.sql;
```

## 📱 功能演示

### 主要页面

1. **主页面**: 显示最近房间，快速创建/加入房间
2. **个人信息**: 设置昵称头像，微信授权登录
3. **房间页面**: 实时显示玩家分数，快速转移，查看流水
4. **分数转移**: 详细的转移设置和确认
5. **结算页面**: 显示最终分数和转账方案
6. **历史房间**: 查看所有历史房间记录
7. **房间详情**: 完整的房间信息和流水记录

### 核心流程

1. **用户登录** → 设置个人信息 → 进入主页面
2. **创建房间** → 分享给好友 → 开始记分
3. **分数转移** → 点击头像快速转移 → 实时同步
4. **房间结算** → 智能计算转账方案 → 完成结算
5. **查看历史** → 回顾游戏记录 → 对账确认

## 🔧 开发指南

### 后端开发

1. **添加新接口**:
   - 在 `internal/service/types.go` 中定义请求和响应结构体
   - 在 `internal/service/mahjong.go` 中实现业务逻辑
   - 在 `internal/handler/http.go` 中添加HTTP路由处理

2. **数据库操作**:
   - 修改 `database.sql` 添加新表或字段
   - 运行 `make migrate` 更新数据库

3. **配置管理**:
   - 在 `internal/config/config.go` 中添加新配置
   - 在 `.env` 文件中设置环境变量

### 前端开发

1. **添加新页面**:
   - 在 `pages/` 目录下创建新页面
   - 在 `app.json` 中添加页面路径
   - 实现页面逻辑和样式

2. **API调用**:
   - 在 `utils/api.js` 中添加新的API方法
   - 在页面中调用API服务

3. **样式开发**:
   - 使用全局样式 `app.wxss`
   - 页面特定样式写在对应的 `.wxss` 文件中

## 📊 数据库设计

### 主要表结构

- **users**: 用户信息表
- **rooms**: 房间信息表
- **room_players**: 房间玩家关系表
- **score_transfers**: 分数转移记录表
- **settlements**: 结算记录表
- **user_recent_rooms**: 用户最近房间表

### 核心关系

- 用户 ↔ 房间: 多对多关系（通过room_players表）
- 房间 ↔ 转移记录: 一对多关系
- 房间 ↔ 结算记录: 一对多关系

## 🚀 部署指南

### 后端部署

1. **生产环境配置**:
   ```bash
   # 设置生产环境变量
   export DB_HOST=your_db_host
   export DB_PASSWORD=your_db_password
   export HTTP_PORT=8080
   ```

2. **构建和运行**:
   ```bash
   make build
   ./bin/mahjong-server
   ```

3. **Docker部署**:
   ```bash
   # 使用Docker Compose一键部署（推荐）
   make docker-compose-up
   
   # 或者手动构建和运行
   make docker-build
   make docker-run
   ```

### 小程序部署

1. **代码审查**: 确保所有功能正常
2. **上传代码**: 使用微信开发者工具上传
3. **提交审核**: 在微信公众平台提交审核
4. **发布上线**: 审核通过后发布

## 🔍 测试指南

### 后端测试

```bash
# 运行单元测试
make test

# 测试API接口
curl -X POST http://localhost:8080/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code","nickname":"测试用户"}'
```

### 前端测试

1. **模拟器测试**: 在微信开发者工具中测试
2. **真机调试**: 使用真机调试功能
3. **功能测试**: 测试所有核心功能流程

## 📝 API文档

### 主要接口

- `POST /api/v1/login` - 用户登录
- `POST /api/v1/createRoom` - 创建房间
- `POST /api/v1/joinRoom` - 加入房间
- `GET /api/v1/getRoom` - 获取房间信息
- `POST /api/v1/transferScore` - 转移分数
- `POST /api/v1/settleRoom` - 结算房间
- `GET /api/v1/getUserRooms` - 获取用户房间列表

详细的API文档请参考 `server/README.md`。

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 微信联系

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！

---

**注意**: 这是一个完整的麻将记分小程序项目，包含了前端小程序和后端服务的完整实现。请按照文档说明进行环境配置和部署。
