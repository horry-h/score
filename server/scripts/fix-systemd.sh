#!/bin/bash

# 修复systemd服务配置脚本

echo "=== 修复systemd服务配置 ==="

# 检查是否以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 从环境变量文件读取服务配置
SERVICE_NAME=$(grep "^SERVICE_NAME=" env.conf 2>/dev/null | cut -d'=' -f2 || echo "mahjong-server")
SERVICE_USER=$(grep "^SERVICE_USER=" env.conf 2>/dev/null | cut -d'=' -f2 || echo "root")
SERVICE_WORK_DIR=$(grep "^SERVICE_WORK_DIR=" env.conf 2>/dev/null | cut -d'=' -f2 || echo "/root/horry/score/server")

echo "服务名: $SERVICE_NAME"
echo "工作目录: $SERVICE_WORK_DIR"

# 停止服务
echo "1. 停止现有服务..."
systemctl stop $SERVICE_NAME || true

# 重新创建systemd服务配置
echo "2. 重新创建systemd服务配置..."
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Mahjong Score Server
After=network.target mysql.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$SERVICE_WORK_DIR
ExecStart=/usr/local/bin/$SERVICE_NAME
Restart=always
RestartSec=5
Environment=GIN_MODE=release
EnvironmentFile=$SERVICE_WORK_DIR/env.conf

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd配置
echo "3. 重新加载systemd配置..."
systemctl daemon-reload

# 启用服务
echo "4. 启用服务..."
systemctl enable $SERVICE_NAME

# 启动服务
echo "5. 启动服务..."
systemctl start $SERVICE_NAME

# 等待服务启动
sleep 3

# 检查服务状态
echo "6. 检查服务状态..."
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ 服务启动成功"
    systemctl status $SERVICE_NAME --no-pager
else
    echo "❌ 服务启动失败"
    echo "查看详细日志:"
    journalctl -u $SERVICE_NAME --no-pager -n 10
fi

echo ""
echo "=== 修复完成 ==="
