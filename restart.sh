#!/bin/bash

# 麻将记分服务重启脚本
# 快速重启服务

set -e

echo "=== 麻将记分服务重启 ==="

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 1. 停止服务
echo "1. 停止服务..."
systemctl stop mahjong-server || true
sleep 2

# 2. 确保进程完全停止
echo "2. 确保进程完全停止..."
pkill -f mahjong-server || true
sleep 1

# 3. 检查端口是否释放
if netstat -tlnp | grep -q ":8080 "; then
    echo "⚠️  端口8080仍被占用，强制清理..."
    PID=$(netstat -tlnp | grep ":8080 " | awk '{print $7}' | cut -d'/' -f1)
    if [ ! -z "$PID" ]; then
        kill -9 $PID || true
    fi
    sleep 1
fi

# 4. 重新构建应用（可选，如果需要更新代码）
echo "3. 检查代码更新..."
cd server
if [ "server/main.go" -nt "/usr/local/bin/mahjong-server" ] || [ "server/go.mod" -nt "/usr/local/bin/mahjong-server" ]; then
    echo "检测到代码更新，重新构建..."
    go mod tidy
    go build -o mahjong-server .
    cp mahjong-server /usr/local/bin/
    chmod +x /usr/local/bin/mahjong-server
    echo "✅ 应用重新构建完成"
else
    echo "✅ 代码无更新，跳过构建"
fi

# 5. 启动服务
echo "4. 启动服务..."
systemctl start mahjong-server
sleep 3

# 6. 检查服务状态
if systemctl is-active --quiet mahjong-server; then
    echo "✅ 服务重启成功"
else
    echo "❌ 服务重启失败"
    echo "查看服务状态:"
    systemctl status mahjong-server --no-pager
    echo ""
    echo "查看最新日志:"
    if [ -d "logs" ] && [ "$(ls -A logs)" ]; then
        LATEST_LOG=$(ls -t logs/log_*.log | head -1)
        echo "=== 最新日志 ==="
        tail -20 "$LATEST_LOG"
    fi
    exit 1
fi

# 7. 测试服务
echo "5. 测试服务..."
sleep 2
if curl -s http://127.0.0.1:8080/health > /dev/null; then
    echo "✅ 服务健康检查通过"
else
    echo "⚠️  服务健康检查失败，但服务可能仍在启动中"
fi

echo ""
echo "=== 重启完成 ==="
echo "✅ 麻将记分服务已成功重启"
echo "📊 服务地址: https://www.aipaint.cloud"
echo "📝 查看日志: ./view-logs.sh"