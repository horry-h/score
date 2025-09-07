#!/bin/bash

# 麻将记分服务停止脚本
# 优雅停止服务

set -e

echo "=== 麻将记分服务停止 ==="

# 检查是否以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 1. 停止服务
echo "1. 停止服务..."
# 从环境变量文件读取配置
SERVICE_NAME=$(grep "^SERVICE_NAME=" ../server.env 2>/dev/null | cut -d'=' -f2 || echo "mahjong-server")
HTTP_PORT=$(grep "^HTTP_PORT=" ../server.env 2>/dev/null | cut -d'=' -f2 || echo "8080")

systemctl stop $SERVICE_NAME || true
pkill -f $SERVICE_NAME || true
sleep 2

# 2. 检查停止状态
echo "2. 检查停止状态..."
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "❌ systemd服务仍在运行"
else
    echo "✅ systemd服务已停止"
fi

if pgrep -f $SERVICE_NAME > /dev/null; then
    echo "❌ 仍有进程在运行"
    pkill -9 -f $SERVICE_NAME || true
    sleep 1
else
    echo "✅ 所有进程已停止"
fi

if netstat -tlnp | grep -q ":$HTTP_PORT "; then
    echo "❌ 端口$HTTP_PORT仍被占用"
else
    echo "✅ 端口$HTTP_PORT已释放"
fi

echo ""
echo "=== 停止完成 ==="
echo "✅ 麻将记分服务已完全停止"
echo ""
echo "🔧 管理命令:"
echo "   - 启动服务: ./start.sh"
echo "   - 重启服务: ./restart.sh"
