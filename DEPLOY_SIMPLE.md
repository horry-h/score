# 麻将记分小程序 - 简化部署指南

## 项目概述

这是一个麻将记分小程序的后端服务，使用Go语言开发，MySQL数据库存储。

- **服务器**: 124.156.196.117
- **端口**: 8080
- **数据库**: MySQL (root/123456)
- **服务名**: score-server

## 核心脚本

### 1. deploy.sh - 一键部署脚本
```bash
./deploy.sh
```
- 首次部署整个应用
- 自动安装Go、MySQL等依赖
- 配置数据库和用户
- 构建并部署应用
- 配置systemd服务

### 2. update.sh - 代码更新脚本
```bash
./update.sh
```
- 重新构建应用
- 重启服务
- 测试健康检查API
- 验证服务状态

### 3. restart.sh - 服务重启脚本
```bash
./restart.sh
```
- 重新构建并重启服务
- 清理旧的可执行文件
- 测试API连接

## 常用命令

```bash
# 查看服务状态
systemctl status score-server

# 查看服务日志
journalctl -u score-server -f

# 重启服务
systemctl restart score-server

# 测试健康检查
curl http://124.156.196.117:8080/api/v1/health
```

## API端点

- **健康检查**: `GET /api/v1/health`
- **用户登录**: `POST /api/v1/login`
- **创建房间**: `POST /api/v1/createRoom`
- **加入房间**: `POST /api/v1/joinRoom`
- **转账分数**: `POST /api/v1/transferScore`
- **结算房间**: `POST /api/v1/settleRoom`

## 数据库配置

数据库配置已硬编码在代码中：
- **主机**: localhost
- **端口**: 3306
- **用户名**: root
- **密码**: 123456
- **数据库**: mahjong_score

## 故障排除

如果服务出现问题：

1. **检查服务状态**:
   ```bash
   systemctl status score-server
   ```

2. **查看错误日志**:
   ```bash
   journalctl -u score-server -n 20
   ```

3. **重新构建和重启**:
   ```bash
   ./restart.sh
   ```

4. **检查端口监听**:
   ```bash
   ss -tuln | grep :8080
   ```

## 项目结构

```
/root/horry/score/
├── deploy.sh          # 一键部署脚本
├── update.sh          # 代码更新脚本
├── restart.sh         # 服务重启脚本
├── server/            # 后端代码
│   ├── main.go        # 主程序
│   ├── go.mod         # Go模块文件
│   └── database.sql   # 数据库结构
└── miniprogram/       # 小程序代码
```

## 部署流程

1. **首次部署**:
   ```bash
   ./deploy.sh
   ```

2. **代码更新**:
   ```bash
   ./update.sh
   ```

3. **服务重启**:
   ```bash
   ./restart.sh
   ```

## 健康检查

服务正常运行后，可以通过以下方式验证：

```bash
# 本地测试
curl http://localhost:8080/api/v1/health

# 外部测试
curl http://124.156.196.117:8080/api/v1/health
```

正常响应：
```json
{
  "code": 200,
  "message": "服务运行正常",
  "data": {
    "service": "麻将记分小程序后端服务",
    "version": "1.0.0",
    "status": "healthy",
    "server_ip": "124.156.196.117"
  }
}
```
