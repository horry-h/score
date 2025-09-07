#!/bin/bash

# 麻将记分服务重启脚本
# 快速重启服务

set -e

echo "=== 麻将记分服务重启 ==="

# 检查是否以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 1. 停止服务
echo "1. 停止服务..."
# 从环境变量文件读取服务名
SERVICE_NAME=$(grep "^SERVICE_NAME=" ../server.env 2>/dev/null | cut -d'=' -f2 || echo "mahjong-server")
systemctl stop $SERVICE_NAME || true
pkill -f $SERVICE_NAME || true
sleep 2

# 2. 重新构建并启动
echo "2. 重新构建并启动..."
cd ..
go mod tidy
go build -o mahjong-server .
cp mahjong-server /usr/local/bin/
chmod +x /usr/local/bin/mahjong-server

systemctl start $SERVICE_NAME
sleep 3

# 3. 检查服务状态
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ 服务重启成功"
else
    echo "❌ 服务重启失败"
    systemctl status $SERVICE_NAME --no-pager
    exit 1
fi

# 4. 测试服务
echo "3. 测试服务..."
sleep 2
HTTP_PORT=$(grep "^HTTP_PORT=" ../server.env 2>/dev/null | cut -d'=' -f2 || echo "8080")
if curl -s http://127.0.0.1:$HTTP_PORT/health > /dev/null; then
    echo "✅ 服务健康检查通过"
else
    echo "⚠️  服务健康检查失败，但服务可能仍在启动中"
fi

echo ""
echo "=== 重启完成 ==="
echo "✅ 麻将记分服务已成功重启"
echo "📊 服务地址: https://www.aipaint.cloud"