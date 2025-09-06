#!/bin/bash

# 快速修复脚本
# 用于快速修复当前的服务问题

set -e

echo "开始快速修复..."

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 1. 检查当前目录
if [ ! -f "main.go" ]; then
    echo "请在server目录下运行此脚本"
    exit 1
fi

# 2. 构建应用
echo "构建Go应用..."
go build -o mahjong-server .

# 3. 停止现有服务
echo "停止现有服务..."
systemctl stop mahjong-server || true
systemctl stop nginx || true

# 4. 安装Go应用
echo "安装Go应用..."
cp mahjong-server /usr/local/bin/
chmod +x /usr/local/bin/mahjong-server

# 5. 启动Go服务
echo "启动Go服务..."
systemctl start mahjong-server

# 6. 检查Go服务状态
echo "检查Go服务状态..."
sleep 2
systemctl status mahjong-server --no-pager

# 7. 测试Go服务
echo "测试Go服务..."
curl -s http://127.0.0.1:8080/health || echo "Go服务测试失败"

echo ""
echo "快速修复完成！"
echo "Go服务现在运行在: http://127.0.0.1:8080"
echo ""
echo "下一步需要配置SSL证书和Nginx，请运行:"
echo "  chmod +x fix-ssl.sh"
echo "  ./fix-ssl.sh"
