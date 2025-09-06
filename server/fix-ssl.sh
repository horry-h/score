#!/bin/bash

# SSL修复脚本
# 用于修复SSL证书配置问题

set -e

echo "开始修复SSL证书配置..."

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 1. 停止服务
echo "1. 停止现有服务..."
systemctl stop nginx || true
systemctl stop mahjong-server || true

# 2. 安装必要软件
echo "2. 安装必要软件..."
apt update
apt install -y nginx certbot python3-certbot-nginx

# 3. 检查域名解析
echo "3. 检查域名解析..."
echo "当前域名解析结果:"
nslookup www.aipaint.cloud || echo "域名解析失败，请确保域名已正确解析到服务器IP"

# 4. 临时启动Nginx用于证书验证
echo "4. 配置临时Nginx..."
cat > /etc/nginx/sites-available/temp << EOF
server {
    listen 80;
    server_name www.aipaint.cloud aipaint.cloud;
    
    location / {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF

ln -sf /etc/nginx/sites-available/temp /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 启动Nginx
systemctl start nginx

# 5. 获取SSL证书
echo "5. 获取SSL证书..."
echo "请确保域名 www.aipaint.cloud 已解析到服务器IP: 124.156.196.117"
echo "按Enter继续获取SSL证书..."
read -r

# 使用certbot获取证书
certbot certonly --nginx -d www.aipaint.cloud -d aipaint.cloud --non-interactive --agree-tos --email admin@aipaint.cloud

# 6. 配置正式的Nginx
echo "6. 配置正式Nginx..."
cat > /etc/nginx/sites-available/aipaint.cloud << EOF
server {
    listen 80;
    server_name www.aipaint.cloud aipaint.cloud;
    
    # 重定向HTTP到HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.aipaint.cloud aipaint.cloud;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/www.aipaint.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.aipaint.cloud/privkey.pem;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 反向代理到Go应用
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # 缓冲设置
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# 更新站点配置
ln -sf /etc/nginx/sites-available/aipaint.cloud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/temp

# 7. 测试Nginx配置
echo "7. 测试Nginx配置..."
nginx -t

# 8. 启动Go服务
echo "8. 启动Go服务..."
systemctl start mahjong-server

# 9. 重启Nginx
echo "9. 重启Nginx..."
systemctl restart nginx

# 10. 检查服务状态
echo "10. 检查服务状态..."
sleep 3
echo "Go服务状态:"
systemctl status mahjong-server --no-pager
echo ""
echo "Nginx服务状态:"
systemctl status nginx --no-pager

echo ""
echo "SSL修复完成！"
echo ""
echo "测试命令:"
echo "  curl -k https://www.aipaint.cloud/health"
echo "  curl -k https://www.aipaint.cloud/api/v1/health"
