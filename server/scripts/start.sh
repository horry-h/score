#!/bin/bash

# 麻将记分服务启动脚本
# 快速启动已部署的服务

set -e

echo "=== 麻将记分服务启动 ==="

# 检查是否以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 1. 检查基础依赖
echo "1. 检查基础依赖..."
if ! command -v go &> /dev/null; then
    echo "❌ Go未安装，请先运行 ./deploy.sh 进行完整部署"
    exit 1
fi

if ! systemctl is-active --quiet mysql; then
    echo "❌ MySQL服务未运行，正在启动..."
    systemctl start mysql
    sleep 3
fi

if ! systemctl is-active --quiet nginx; then
    echo "❌ Nginx服务未运行，正在启动..."
    systemctl start nginx
    sleep 2
fi

echo "✅ 基础依赖检查完成"

# 2. 检查端口占用
echo "2. 检查端口占用..."
# 从环境变量文件读取配置
SERVICE_NAME=$(grep "^SERVICE_NAME=" ../server.env 2>/dev/null | cut -d'=' -f2 || echo "mahjong-server")
HTTP_PORT=$(grep "^HTTP_PORT=" ../server.env 2>/dev/null | cut -d'=' -f2 || echo "8080")

if netstat -tlnp | grep -q ":$HTTP_PORT "; then
    echo "⚠️  端口$HTTP_PORT已被占用，正在停止现有服务..."
    systemctl stop $SERVICE_NAME || true
    pkill -f $SERVICE_NAME || true
    sleep 2
fi

# 3. 构建并启动服务
echo "3. 构建并启动服务..."
cd ..
go mod tidy
go build -o mahjong-server .
cp mahjong-server /usr/local/bin/
chmod +x /usr/local/bin/mahjong-server

systemctl start $SERVICE_NAME
sleep 3

if systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ 服务启动成功"
else
    echo "❌ 服务启动失败"
    systemctl status $SERVICE_NAME --no-pager
    exit 1
fi

# 4. 测试服务
echo "4. 测试服务..."
sleep 2
if curl -s http://127.0.0.1:$HTTP_PORT/health > /dev/null; then
    echo "✅ 服务健康检查通过"
else
    echo "⚠️  服务健康检查失败，但服务可能仍在启动中"
fi

echo ""
echo "=== 启动完成 ==="
echo "✅ 麻将记分服务已成功启动"
echo "📊 服务地址: https://www.aipaint.cloud"
echo "📝 日志目录: /root/horry/score/server/logs"
echo "🔧 管理命令:"
echo "   - 重启服务: ./restart.sh"
echo "   - 停止服务: ./stop.sh"
