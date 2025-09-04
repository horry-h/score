# Score项目部署指南

## 服务器信息
- **IP地址**: 124.156.196.117
- **服务端口**: 8080
- **API地址**: http://124.156.196.117:8080
- **项目目录**: /root/horry/score

## 部署步骤

### 1. 首次部署

```bash
# 1. 连接服务器
ssh root@124.156.196.117

# 2. 创建项目目录并克隆代码
mkdir -p /root/horry
cd /root/horry
git clone <your-github-repo-url> score
cd score

# 3. 运行一键部署脚本
./deploy.sh
```

### 2. 后续更新

```bash
# 连接服务器
ssh root@124.156.196.117

# 进入项目目录
cd /root/horry/score

# 运行更新脚本
./update.sh
```

## 项目结构

部署后的目录结构：
```
/root/horry/score/
├── deploy.sh          # 一键部署脚本
├── update.sh          # 快速更新脚本
├── .env               # 环境配置文件
├── server/            # 后端代码
│   ├── main.go
│   ├── database.sql
│   ├── go.mod
│   └── ...
├── miniprogram/       # 小程序代码
│   ├── app.json
│   ├── pages/
│   └── ...
└── README.md
```

## 服务管理

```bash
# 查看服务状态
systemctl status score-server

# 查看服务日志
journalctl -u score-server -f

# 重启服务
systemctl restart score-server

# 停止服务
systemctl stop score-server
```

## 验证部署

```bash
# 健康检查
curl http://124.156.196.117:8080/api/v1/health

# 检查端口监听
netstat -tlnp | grep 8080
```

## 配置说明

### 数据库配置
- 数据库名: mahjong_score
- 用户名: mahjong_user
- 密码: Mahjong2024!

### 环境变量
配置文件位置: `/root/horry/score/.env`

需要修改的配置项：
- `WECHAT_APPID`: 微信小程序AppID
- `WECHAT_APPSECRET`: 微信小程序AppSecret

## 部署脚本说明

### deploy.sh (首次部署)
- 安装Go 1.21.5
- 安装MySQL 8.0
- 创建数据库和用户
- 配置环境变量
- 构建Go应用
- 创建systemd服务
- 配置防火墙
- 启动服务并验证

### update.sh (快速更新)
- 拉取最新代码
- 重新构建应用
- 重启服务
- 验证更新结果

## 故障排除

### 服务无法启动
```bash
# 查看详细日志
journalctl -u score-server --no-pager

# 检查配置文件
cat /root/horry/score/.env
```

### 端口被占用
```bash
# 查看端口占用
lsof -i :8080

# 杀死占用进程
kill -9 <PID>
```

### 数据库连接失败
```bash
# 检查MySQL服务
systemctl status mysql

# 测试数据库连接
mysql -u mahjong_user -pMahjong2024! -e "SELECT 1"
```

## 常用命令总结

```bash
# 首次部署
./deploy.sh

# 更新代码
./update.sh

# 查看状态
systemctl status score-server

# 查看日志
journalctl -u score-server -f

# 重启服务
systemctl restart score-server
```

## 注意事项

1. 确保服务器有足够的权限访问GitHub仓库
2. 首次部署前需要配置微信小程序的AppID和AppSecret
3. 建议定期备份数据库
4. 监控服务运行状态和日志