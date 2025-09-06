#!/bin/bash

# 自动化部署脚本
# 一键部署完整的HTTPS服务

set -e

echo "开始自动化部署HTTPS服务..."

# 检查是否以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 检查是否在正确的目录
if [ ! -f "main.go" ]; then
    echo "请在server目录下运行此脚本"
    exit 1
fi

# 1. 构建Go应用
echo "1. 构建Go应用..."
go build -o mahjong-server .

# 2. 停止现有服务
echo "2. 停止现有服务..."
systemctl stop mahjong-server || true
systemctl stop nginx || true

# 3. 安装Go应用
echo "3. 安装Go应用..."
cp mahjong-server /usr/local/bin/
chmod +x /usr/local/bin/mahjong-server

# 4. 配置systemd服务
echo "4. 配置systemd服务..."
cat > /etc/systemd/system/mahjong-server.service << 'EOF'
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
Environment=TENCENT_SECRET_ID=your_secret_id_here
Environment=TENCENT_SECRET_KEY=your_secret_key_here

[Install]
WantedBy=multi-user.target
EOF

# 5. 启动Go服务
echo "5. 启动Go服务..."
systemctl daemon-reload
systemctl enable mahjong-server
systemctl start mahjong-server

# 等待服务启动
sleep 3

# 6. 测试Go服务
echo "6. 测试Go服务..."
if curl -s http://127.0.0.1:8080/health > /dev/null; then
    echo "Go服务启动成功"
else
    echo "Go服务启动失败，请检查日志"
    systemctl status mahjong-server --no-pager
    exit 1
fi

# 7. 安装Nginx
echo "7. 安装Nginx..."
apt update
apt install -y nginx

# 8. 检查腾讯云SSL证书文件
echo "8. 检查腾讯云SSL证书文件..."
SSL_DIR="/root/horry/score/server/ssl"
CERT_FILE="$SSL_DIR/aipaint.cloud_bundle.crt"
KEY_FILE="$SSL_DIR/aipaint.cloud.key"

if [ ! -f "$CERT_FILE" ]; then
    echo "❌ 错误：找不到证书文件 $CERT_FILE"
    echo "请确保已将腾讯云SSL证书文件上传到 $SSL_DIR 目录"
    echo "需要的文件："
    echo "  - aipaint.cloud_bundle.crt (证书文件)"
    echo "  - aipaint.cloud.key (私钥文件)"
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ 错误：找不到私钥文件 $KEY_FILE"
    echo "请确保已将腾讯云SSL证书文件上传到 $SSL_DIR 目录"
    exit 1
fi

echo "✅ 找到腾讯云SSL证书文件"
echo "  证书文件: $CERT_FILE"
echo "  私钥文件: $KEY_FILE"

# 9. 复制SSL证书到Nginx目录
echo "9. 复制SSL证书到Nginx目录..."
mkdir -p /etc/nginx/ssl
cp "$CERT_FILE" /etc/nginx/ssl/
cp "$KEY_FILE" /etc/nginx/ssl/
chmod 600 /etc/nginx/ssl/aipaint.cloud.key
chmod 644 /etc/nginx/ssl/aipaint.cloud_bundle.crt

# 10. 配置Apple ATS合规的SSL
echo "10. 配置Apple ATS合规的SSL..."
echo "使用ECDHE加密套件，无需生成DH参数文件"

# 11. 配置正式Nginx（Apple ATS合规版本）
echo "11. 配置正式Nginx（Apple ATS合规版本）..."
cat > /etc/nginx/sites-available/aipaint.cloud << 'EOF'
server {
    listen 80;
    server_name www.aipaint.cloud aipaint.cloud;
    
    # 重定向HTTP到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.aipaint.cloud aipaint.cloud;

    # SSL证书配置（腾讯云SSL证书）
    ssl_certificate /etc/nginx/ssl/aipaint.cloud_bundle.crt;
    ssl_certificate_key /etc/nginx/ssl/aipaint.cloud.key;
    
    # Apple ATS规范要求的SSL配置
    # 1. 只支持TLS 1.2和TLS 1.3
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # 2. 使用强加密套件，符合ATS要求
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA256';
    ssl_prefer_server_ciphers off;
    
    # 3. 启用完美前向保密(PFS) - 使用ECDHE
    ssl_ecdh_curve secp384r1;
    
    # 4. 会话配置
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # 5. 安全头 - 符合ATS要求
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # 反向代理到Go应用
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
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

# 12. 更新站点配置
echo "12. 更新站点配置..."
ln -sf /etc/nginx/sites-available/aipaint.cloud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 13. 测试Nginx配置
echo "13. 测试Nginx配置..."
nginx -t

# 14. 重启Nginx
echo "14. 重启Nginx..."
systemctl restart nginx

# 15. 检查服务状态
echo "15. 检查服务状态..."
sleep 3
echo "Go服务状态:"
systemctl status mahjong-server --no-pager
echo ""
echo "Nginx服务状态:"
systemctl status nginx --no-pager

# 16. 测试HTTPS和Apple ATS合规性
echo "16. 测试HTTPS和Apple ATS合规性..."
sleep 2

# 测试HTTPS连接
if curl -k -s https://www.aipaint.cloud/health > /dev/null; then
    echo "✅ HTTPS服务测试成功！"
else
    echo "❌ HTTPS服务测试失败，请检查配置"
fi

# 测试TLS 1.2连接
echo "测试TLS 1.2连接:"
if echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_2 2>/dev/null | grep -q "Protocol.*TLSv1.2"; then
    echo "✅ TLS 1.2连接成功"
else
    echo "❌ TLS 1.2连接失败"
fi

# 测试TLS 1.3连接
echo "测试TLS 1.3连接:"
if echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_3 2>/dev/null | grep -q "Protocol.*TLSv1.3"; then
    echo "✅ TLS 1.3连接成功"
else
    echo "❌ TLS 1.3连接失败"
fi

# 检查HSTS头
echo "检查HSTS安全头:"
if curl -I https://www.aipaint.cloud/health 2>/dev/null | grep -q "Strict-Transport-Security"; then
    echo "✅ HSTS安全头已配置"
else
    echo "❌ HSTS安全头未配置"
fi

echo ""
echo "🎉 Apple ATS合规性配置完成！"
echo "📋 建议访问以下链接验证配置："
echo "   - MySSL检测: https://myssl.com/www.aipaint.cloud"
echo "   - SSL Labs检测: https://www.ssllabs.com/ssltest/analyze.html?d=www.aipaint.cloud"
echo ""

echo ""
echo "自动化部署完成！"
echo ""
echo "服务信息："
echo "  域名: https://www.aipaint.cloud"
echo "  Go服务: http://127.0.0.1:8080"
echo "  Nginx: 监听80和443端口"
echo ""
echo "测试命令:"
echo "  curl -k https://www.aipaint.cloud/health"
echo "  curl -k https://www.aipaint.cloud/api/v1/health"
