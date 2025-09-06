#!/bin/bash

# 完整HTTPS部署脚本
# 包含Nginx反向代理和SSL证书配置

set -e

echo "开始完整HTTPS部署..."

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 检查是否在正确的目录
if [ ! -f "main.go" ]; then
    echo "请在server目录下运行此脚本"
    exit 1
fi

# 1. 安装Nginx
echo "安装Nginx..."
apt update
apt install -y nginx

# 2. 安装certbot
echo "安装certbot..."
apt install -y certbot python3-certbot-nginx

# 3. 构建Go应用
echo "构建Go应用..."
go build -o mahjong-server .

# 4. 停止现有服务
echo "停止现有服务..."
systemctl stop mahjong-server || true
systemctl stop nginx || true

# 5. 部署Go应用
echo "部署Go应用..."
cp mahjong-server /usr/local/bin/
chmod +x /usr/local/bin/mahjong-server

# 6. 更新systemd服务配置
echo "配置systemd服务..."
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

# 7. 配置Nginx
echo "配置Nginx..."
cp nginx-https.conf /etc/nginx/sites-available/aipaint.cloud
ln -sf /etc/nginx/sites-available/aipaint.cloud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 8. 测试Nginx配置
echo "测试Nginx配置..."
nginx -t

# 9. 启动Go服务
echo "启动Go服务..."
systemctl daemon-reload
systemctl enable mahjong-server
systemctl start mahjong-server

# 10. 启动Nginx
echo "启动Nginx..."
systemctl enable nginx
systemctl start nginx

# 11. 获取SSL证书
echo "获取SSL证书..."
echo "请确保域名 www.aipaint.cloud 已解析到服务器IP: 124.156.196.117"
echo "按Enter继续获取SSL证书..."
read

certbot --nginx -d www.aipaint.cloud -d aipaint.cloud --non-interactive --agree-tos --email admin@aipaint.cloud

# 12. 配置防火墙
echo "配置防火墙..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 13. 检查服务状态
echo "检查服务状态..."
sleep 3
echo "Go服务状态:"
systemctl status mahjong-server --no-pager
echo ""
echo "Nginx服务状态:"
systemctl status nginx --no-pager

echo ""
echo "HTTPS部署完成！"
echo ""
echo "服务信息："
echo "  域名: https://www.aipaint.cloud"
echo "  Go服务: http://127.0.0.1:8080"
echo "  Nginx: 监听80和443端口"
echo ""
echo "测试命令："
echo "  curl -k https://www.aipaint.cloud/health"
echo "  curl -k https://www.aipaint.cloud/api/v1/health"
