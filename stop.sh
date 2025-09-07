#!/bin/bash

# 麻将记分服务停止脚本
# 优雅停止服务

set -e

echo "=== 麻将记分服务停止 ==="

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 1. 停止服务
echo "1. 停止服务..."
systemctl stop mahjong-server || true
pkill -f mahjong-server || true
sleep 2

# 2. 检查停止状态
echo "2. 检查停止状态..."
if systemctl is-active --quiet mahjong-server; then
    echo "❌ systemd服务仍在运行"
else
    echo "✅ systemd服务已停止"
fi

if pgrep -f mahjong-server > /dev/null; then
    echo "❌ 仍有进程在运行"
    pkill -9 -f mahjong-server || true
    sleep 1
else
    echo "✅ 所有进程已停止"
fi

if netstat -tlnp | grep -q ":8080 "; then
    echo "❌ 端口8080仍被占用"
else
    echo "✅ 端口8080已释放"
fi

echo ""
echo "=== 停止完成 ==="
echo "✅ 麻将记分服务已完全停止"
echo ""
echo "🔧 管理命令:"
echo "   - 启动服务: ./start.sh"
echo "   - 重启服务: ./restart.sh"
