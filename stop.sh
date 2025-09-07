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

# 1. 停止systemd服务
echo "1. 停止systemd服务..."
if systemctl is-active --quiet mahjong-server; then
    systemctl stop mahjong-server
    echo "✅ systemd服务已停止"
else
    echo "ℹ️  systemd服务未运行"
fi

# 2. 等待服务完全停止
echo "2. 等待服务完全停止..."
sleep 3

# 3. 检查并清理残留进程
echo "3. 清理残留进程..."
if pgrep -f mahjong-server > /dev/null; then
    echo "发现残留进程，正在清理..."
    pkill -f mahjong-server
    sleep 2
    
    # 强制清理（如果还有残留）
    if pgrep -f mahjong-server > /dev/null; then
        echo "强制清理残留进程..."
        pkill -9 -f mahjong-server || true
    fi
    echo "✅ 残留进程已清理"
else
    echo "✅ 无残留进程"
fi

# 4. 检查端口是否释放
echo "4. 检查端口释放..."
if netstat -tlnp | grep -q ":8080 "; then
    echo "⚠️  端口8080仍被占用，正在清理..."
    PID=$(netstat -tlnp | grep ":8080 " | awk '{print $7}' | cut -d'/' -f1)
    if [ ! -z "$PID" ]; then
        kill -9 $PID || true
        echo "✅ 端口8080已释放"
    fi
else
    echo "✅ 端口8080已释放"
fi

# 5. 显示最终状态
echo ""
echo "=== 停止完成 ==="
echo "✅ 麻将记分服务已完全停止"
echo ""
echo "服务状态检查:"
if systemctl is-active --quiet mahjong-server; then
    echo "❌ systemd服务仍在运行"
else
    echo "✅ systemd服务已停止"
fi

if pgrep -f mahjong-server > /dev/null; then
    echo "❌ 仍有进程在运行"
    echo "运行中的进程:"
    ps aux | grep mahjong-server | grep -v grep
else
    echo "✅ 所有进程已停止"
fi

if netstat -tlnp | grep -q ":8080 "; then
    echo "❌ 端口8080仍被占用"
else
    echo "✅ 端口8080已释放"
fi

echo ""
echo "🔧 管理命令:"
echo "   - 启动服务: ./start.sh"
echo "   - 重启服务: ./restart.sh"
echo "   - 查看日志: ./view-logs.sh"
