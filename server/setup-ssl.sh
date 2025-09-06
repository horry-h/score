#!/bin/bash

# SSL证书配置脚本
# 用于为 www.aipaint.cloud 域名配置HTTPS

set -e

echo "开始配置SSL证书..."

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 安装certbot
echo "安装certbot..."
apt update
apt install -y certbot

# 创建SSL证书目录
mkdir -p /etc/ssl/certs
mkdir -p /etc/ssl/private

# 使用Let's Encrypt获取SSL证书
echo "获取SSL证书..."
certbot certonly --standalone -d www.aipaint.cloud --non-interactive --agree-tos --email admin@aipaint.cloud

# 复制证书到指定位置
echo "复制证书文件..."
cp /etc/letsencrypt/live/www.aipaint.cloud/fullchain.pem /etc/ssl/certs/aipaint.cloud.crt
cp /etc/letsencrypt/live/www.aipaint.cloud/privkey.pem /etc/ssl/private/aipaint.cloud.key

# 设置正确的权限
chmod 644 /etc/ssl/certs/aipaint.cloud.crt
chmod 600 /etc/ssl/private/aipaint.cloud.key

# 创建自动续期脚本
echo "创建证书自动续期脚本..."
cat > /etc/cron.d/certbot-renew << EOF
0 12 * * * root certbot renew --quiet --post-hook "systemctl reload mahjong-server"
EOF

# 设置防火墙规则
echo "配置防火墙..."
ufw allow 443/tcp
ufw allow 80/tcp

echo "SSL证书配置完成！"
echo "证书文件位置："
echo "  证书: /etc/ssl/certs/aipaint.cloud.crt"
echo "  私钥: /etc/ssl/private/aipaint.cloud.key"
echo ""
echo "请确保域名 www.aipaint.cloud 已正确解析到服务器IP: 124.156.196.117"
