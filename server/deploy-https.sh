#!/bin/bash

# HTTPS部署脚本
# 用于部署支持HTTPS的麻将记分服务

set -e

echo "开始部署HTTPS版本的麻将记分服务..."

# 检查是否在正确的目录
if [ ! -f "main.go" ]; then
    echo "请在server目录下运行此脚本"
    exit 1
fi

# 构建应用
echo "构建应用..."
go build -o mahjong-server .

# 停止现有服务
echo "停止现有服务..."
systemctl stop mahjong-server || true

# 备份现有二进制文件
if [ -f "/usr/local/bin/mahjong-server" ]; then
    echo "备份现有二进制文件..."
    cp /usr/local/bin/mahjong-server /usr/local/bin/mahjong-server.backup.$(date +%Y%m%d_%H%M%S)
fi

# 复制新的二进制文件
echo "安装新的二进制文件..."
cp mahjong-server /usr/local/bin/

# 设置权限
chmod +x /usr/local/bin/mahjong-server

# 更新systemd服务配置
echo "更新systemd服务配置..."
cat > /etc/systemd/system/mahjong-server.service << EOF
[Unit]
Description=Mahjong Score Server
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/usr/local/bin
ExecStart=/usr/local/bin/mahjong-server
Restart=always
RestartSec=5
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd配置
systemctl daemon-reload

# 启动服务
echo "启动服务..."
systemctl enable mahjong-server
systemctl start mahjong-server

# 检查服务状态
echo "检查服务状态..."
sleep 3
systemctl status mahjong-server --no-pager

echo "HTTPS部署完成！"
echo ""
echo "服务信息："
echo "  域名: https://www.aipaint.cloud"
echo "  端口: 443 (HTTPS)"
echo "  状态: $(systemctl is-active mahjong-server)"
echo ""
echo "请确保："
echo "1. 域名 www.aipaint.cloud 已解析到服务器IP"
echo "2. SSL证书已正确配置"
