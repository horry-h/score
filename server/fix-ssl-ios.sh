#!/bin/bash

# 修复SSL配置以兼容iOS设备
echo "开始修复SSL配置以兼容iOS设备..."

# 1. 备份当前配置
echo "1. 备份当前Nginx配置..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# 2. 更新Nginx配置
echo "2. 更新Nginx配置..."
sudo cp nginx-https.conf /etc/nginx/sites-available/default

# 3. 测试Nginx配置
echo "3. 测试Nginx配置..."
if sudo nginx -t; then
    echo "Nginx配置测试通过"
else
    echo "Nginx配置测试失败，恢复备份"
    sudo cp /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/default
    exit 1
fi

# 4. 重新加载Nginx
echo "4. 重新加载Nginx..."
sudo systemctl reload nginx

# 5. 检查Nginx状态
echo "5. 检查Nginx状态..."
sudo systemctl status nginx --no-pager

# 6. 测试SSL连接
echo "6. 测试SSL连接..."
echo "测试TLS 1.2连接:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_2 2>/dev/null | grep -E "(Protocol|Cipher)"

echo "测试TLS 1.3连接:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_3 2>/dev/null | grep -E "(Protocol|Cipher)"

echo "SSL配置修复完成！"
echo "建议在iOS设备上重新测试小程序连接。"
