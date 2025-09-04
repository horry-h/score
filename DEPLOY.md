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

## 脚本说明

### deploy.sh - 一键部署脚本
- **功能**: 首次部署或重新部署整个应用
- **特点**: 
  - 智能检测已安装的依赖，避免重复安装
  - 检查数据库和表结构，只在需要时创建
  - 保护现有配置文件，避免覆盖
  - 支持多次运行，不会出现问题

### update.sh - 快速更新脚本
- **功能**: 更新代码并重启服务
- **特点**:
  - 检查是否有新代码，避免不必要的更新
  - 自动拉取最新代码并重新构建
  - 智能重启服务

### status.sh - 状态检查脚本
- **功能**: 检查部署状态和系统健康
- **特点**:
  - 全面检查所有组件状态
  - 显示详细的系统信息
  - 提供健康检查和故障诊断

### troubleshoot.sh - 故障排除脚本
- **功能**: 深度诊断系统问题
- **特点**:
  - 检查所有系统组件和依赖
  - 提供详细的错误诊断信息
  - 包含常见问题的解决建议
  - 监控系统资源使用情况

### fix-database.sh - 数据库修复脚本
- **功能**: 专门修复数据库连接和权限问题
- **特点**:
  - 设置MySQL root用户密码为123456
  - 自动创建数据库
  - 初始化数据库表结构
  - 验证数据库连接

### setup-mysql-root.sh - MySQL Root密码设置脚本
- **功能**: 设置MySQL root用户密码
- **特点**:
  - 设置root用户密码为123456
  - 使用mysql_native_password认证插件
  - 创建mahjong_score数据库
  - 验证连接和数据库创建

### rebuild-app.sh - 应用重新构建脚本
- **功能**: 在服务器上重新构建应用
- **特点**:
  - 检查Go环境和依赖
  - 清理旧的可执行文件
  - 重新构建Linux版本的应用
  - 验证可执行文件架构
  - 重启服务并测试API

### quick-fix.sh - 快速修复脚本
- **功能**: 一键修复常见问题
- **特点**:
  - 自动诊断和修复服务问题
  - 检查并构建可执行文件
  - 修复数据库连接问题
  - 重启服务并验证

### check-service.sh - 服务状态检查脚本
- **功能**: 快速检查服务状态
- **特点**:
  - 显示服务运行状态
  - 检查端口监听情况
  - 显示最近的服务日志
  - 验证可执行文件和数据库连接

## 常用命令总结

```bash
# 首次部署
./deploy.sh

# 检查部署状态
./status.sh

# 故障排除诊断
./troubleshoot.sh

# 快速检查服务状态
./check-service.sh

# 快速修复问题
./quick-fix.sh

# 重新构建应用（解决架构问题）
./rebuild-app.sh

# 设置MySQL root密码
./setup-mysql-root.sh

# 修复数据库问题
./fix-database.sh

# 更新代码
./update.sh

# 查看服务状态
systemctl status score-server

# 查看服务日志
journalctl -u score-server -f

# 重启服务
systemctl restart score-server
```

## 故障排除

### 常见问题及解决方案

#### 1. 服务启动失败
```bash
# 快速检查服务状态
./check-service.sh

# 一键修复问题（推荐）
./quick-fix.sh

# 如果遇到 "Exec format error" 错误，重新构建应用
./rebuild-app.sh

# 手动查看详细错误日志
journalctl -u score-server -n 50 --no-pager

# 检查可执行文件是否存在
ls -la /root/horry/score/server/mahjong-server

# 检查可执行文件架构
file /root/horry/score/server/mahjong-server

# 检查配置文件
cat /root/horry/score/.env
```

#### 2. 端口未监听
```bash
# 检查端口占用
ss -tuln | grep 8080

# 检查防火墙设置
ufw status
# 或
iptables -L INPUT | grep 8080
```

#### 3. 数据库连接失败
```bash
# 运行数据库修复脚本（推荐）
./fix-database.sh

# 手动检查MySQL服务
systemctl status mysql

# 测试数据库连接
mysql -u root -p123456 -e "SELECT 1"

# 检查数据库表
mysql -u root -p123456 -e "SHOW TABLES;" mahjong_score

# 如果遇到认证问题，使用sudo连接
sudo mysql -e "SELECT 1"
```

#### 4. API无法访问
```bash
# 本地测试
curl http://localhost:8080/api/v1/health

# 外部测试
curl http://124.156.196.117:8080/api/v1/health

# 检查网络连接
ping 124.156.196.117
```

#### 5. 使用故障排除脚本
```bash
# 运行全面的系统诊断
./troubleshoot.sh
```

### 日志查看
```bash
# 查看服务日志
journalctl -u score-server -f

# 查看系统日志
journalctl -xe

# 查看MySQL日志
journalctl -u mysql -f
```

## 注意事项

1. 确保服务器有足够的权限访问GitHub仓库
2. 首次部署前需要配置微信小程序的AppID和AppSecret
3. 建议定期备份数据库
4. 监控服务运行状态和日志
5. 遇到问题时先运行 `./troubleshoot.sh` 进行诊断