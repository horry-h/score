#!/bin/bash

# 专门针对微信小程序的SSL修复脚本
echo "开始修复微信小程序SSL兼容性问题..."

# 1. 备份当前配置
echo "1. 备份当前配置..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# 2. 创建微信小程序兼容的Nginx配置
echo "2. 创建微信小程序兼容的Nginx配置..."
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
# Nginx HTTPS配置 - 微信小程序兼容版本
server {
    listen 80;
    server_name www.aipaint.cloud aipaint.cloud;
    
    # 重定向HTTP到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.aipaint.cloud aipaint.cloud;

    # SSL证书配置
    ssl_certificate /etc/ssl/certs/aipaint.cloud.crt;
    ssl_certificate_key /etc/ssl/private/aipaint.cloud.key;
    
    # 微信小程序兼容的SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # 微信小程序要求的SSL配置
    ssl_ecdh_curve secp384r1;
    ssl_dhparam /etc/ssl/certs/dhparam.pem;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
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

# 3. 生成DH参数文件（如果不存在）
echo "3. 生成DH参数文件..."
if [ ! -f "/etc/ssl/certs/dhparam.pem" ]; then
    echo "生成DH参数文件（这可能需要几分钟）..."
    sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
else
    echo "DH参数文件已存在"
fi

# 4. 测试Nginx配置
echo "4. 测试Nginx配置..."
if sudo nginx -t; then
    echo "Nginx配置测试通过"
else
    echo "Nginx配置测试失败，恢复备份"
    sudo cp /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/default
    exit 1
fi

# 5. 重新加载Nginx
echo "5. 重新加载Nginx..."
sudo systemctl reload nginx

# 6. 检查Nginx状态
echo "6. 检查Nginx状态..."
sudo systemctl status nginx --no-pager

# 7. 测试SSL连接
echo "7. 测试SSL连接..."
echo "测试TLS 1.2连接:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_2 2>/dev/null | grep -E "(Protocol|Cipher)"

echo "测试TLS 1.3连接:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_3 2>/dev/null | grep -E "(Protocol|Cipher)"

# 8. 使用SSL Labs测试
echo "8. SSL配置测试完成"
echo "建议访问 https://www.ssllabs.com/ssltest/analyze.html?d=www.aipaint.cloud 进行详细测试"

echo "微信小程序SSL兼容性修复完成！"
echo "请在微信小程序中重新测试连接。"
