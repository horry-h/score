#!/bin/bash

# 修复Apple ATS规范兼容性问题
echo "开始修复Apple ATS规范兼容性问题..."

# 1. 备份当前配置
echo "1. 备份当前配置..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# 2. 创建符合Apple ATS规范的Nginx配置
echo "2. 创建符合Apple ATS规范的Nginx配置..."
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
# Nginx HTTPS配置 - Apple ATS规范兼容版本
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
    
    # Apple ATS规范要求的SSL配置
    # 1. 只支持TLS 1.2和TLS 1.3
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # 2. 使用强加密套件，符合ATS要求
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA256';
    ssl_prefer_server_ciphers off;
    
    # 3. 启用完美前向保密(PFS)
    ssl_ecdh_curve secp384r1;
    ssl_dhparam /etc/ssl/certs/dhparam.pem;
    
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
    
    # 6. 禁用不安全的协议和套件
    ssl_protocols TLSv1.2 TLSv1.3;
    
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

# 3. 生成更强的DH参数文件（如果不存在或需要更新）
echo "3. 生成更强的DH参数文件..."
if [ ! -f "/etc/ssl/certs/dhparam.pem" ]; then
    echo "生成2048位DH参数文件（这可能需要几分钟）..."
    sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
else
    echo "检查现有DH参数文件强度..."
    DH_BITS=$(openssl dhparam -in /etc/ssl/certs/dhparam.pem -text -noout 2>/dev/null | grep "DH Parameters" | grep -o '[0-9]*' | head -1)
    if [ "$DH_BITS" -lt 2048 ]; then
        echo "当前DH参数文件强度不足，重新生成2048位..."
        sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
    else
        echo "DH参数文件强度足够（$DH_BITS位）"
    fi
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

# 7. 测试Apple ATS兼容性
echo "7. 测试Apple ATS兼容性..."
echo "测试TLS 1.2连接:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_2 2>/dev/null | grep -E "(Protocol|Cipher)"

echo "测试TLS 1.3连接:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_3 2>/dev/null | grep -E "(Protocol|Cipher)"

# 8. 检查支持的加密套件
echo "8. 检查支持的加密套件:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud 2>/dev/null | grep -A 20 "Cipher Suites"

# 9. 验证HSTS头
echo "9. 验证HSTS头:"
curl -I https://www.aipaint.cloud/health 2>/dev/null | grep -i "strict-transport-security"

echo "Apple ATS规范修复完成！"
echo "建议："
echo "1. 访问 https://www.ssllabs.com/ssltest/analyze.html?d=www.aipaint.cloud 进行详细测试"
echo "2. 访问 https://myssl.com/www.aipaint.cloud 重新检测ATS合规性"
echo "3. 在iOS设备上重新测试微信小程序连接"
