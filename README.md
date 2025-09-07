# 麻将记分小程序

一个基于微信小程序的麻将记分系统，支持实时记分、房间管理、历史记录等功能。

## 项目结构

```
├── miniprogram/          # 微信小程序前端代码
│   ├── pages/           # 页面文件
│   ├── components/      # 组件文件
│   ├── utils/           # 工具函数
│   └── lib/             # 第三方库
├── server/              # 后端服务代码
│   ├── internal/        # 内部包
│   ├── scripts/         # 服务器管理脚本
│   ├── server.env       # 服务器配置文件
│   └── database.sql     # 数据库结构
└── README.md           # 项目说明
```

## 快速开始

### 前端开发

1. 使用微信开发者工具打开 `miniprogram` 目录
2. 配置小程序 AppID
3. 开始开发

### 后端部署

1. 进入 `server` 目录
2. 配置 `server.env` 文件
3. 运行部署脚本：

```bash
cd server/scripts
./deploy.sh    # 一键部署
./start.sh     # 启动服务
./restart.sh   # 重启服务
./stop.sh      # 停止服务
```

## 配置说明

所有服务器配置都在 `server/server.env` 文件中，包括：

- 数据库配置
- 微信小程序配置
- 腾讯云COS配置
- 服务配置

## 注意事项

- `server.env` 文件包含敏感信息，不会上传到GitHub
- 服务器脚本位于 `server/scripts/` 目录
- 所有服务端相关文件都在 `server/` 目录下