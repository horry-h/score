#!/bin/bash

# 修复Let's Encrypt证书链问题
echo "开始修复Let's Encrypt证书链..."

# 1. 检查当前证书
echo "1. 检查当前证书配置..."
if [ -f "/etc/ssl/certs/aipaint.cloud.crt" ]; then
    echo "当前证书文件存在"
    openssl x509 -in /etc/ssl/certs/aipaint.cloud.crt -text -noout | grep -A 3 "Subject:"
else
    echo "错误：证书文件不存在"
    exit 1
fi

# 2. 下载Let's Encrypt中间证书
echo "2. 下载Let's Encrypt中间证书..."
cd /tmp
curl -s https://letsencrypt.org/certs/lets-encrypt-e7.pem -o lets-encrypt-e7.pem
curl -s https://letsencrypt.org/certs/lets-encrypt-r3.pem -o lets-encrypt-r3.pem
curl -s https://letsencrypt.org/certs/isrgrootx1.pem -o isrgrootx1.pem

# 3. 创建完整的证书链
echo "3. 创建完整的证书链..."
sudo cp /etc/ssl/certs/aipaint.cloud.crt /etc/ssl/certs/aipaint.cloud.crt.backup.$(date +%Y%m%d_%H%M%S)
sudo cat /etc/ssl/certs/aipaint.cloud.crt lets-encrypt-e7.pem lets-encrypt-r3.pem > /tmp/aipaint.cloud-fullchain.crt

# 4. 验证证书链
echo "4. 验证证书链..."
openssl verify -CAfile isrgrootx1.pem -untrusted lets-encrypt-r3.pem -untrusted lets-encrypt-e7.pem /etc/ssl/certs/aipaint.cloud.crt

# 5. 更新证书文件
echo "5. 更新证书文件..."
sudo cp /tmp/aipaint.cloud-fullchain.crt /etc/ssl/certs/aipaint.cloud.crt

# 6. 更新Nginx配置以使用完整证书链
echo "6. 更新Nginx配置..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# 7. 测试Nginx配置
echo "7. 测试Nginx配置..."
if sudo nginx -t; then
    echo "Nginx配置测试通过"
else
    echo "Nginx配置测试失败，恢复备份"
    sudo cp /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/default
    sudo cp /etc/ssl/certs/aipaint.cloud.crt.backup.$(date +%Y%m%d_%H%M%S) /etc/ssl/certs/aipaint.cloud.crt
    exit 1
fi

# 8. 重新加载Nginx
echo "8. 重新加载Nginx..."
sudo systemctl reload nginx

# 9. 测试SSL连接
echo "9. 测试SSL连接..."
echo "测试证书链完整性:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -showcerts 2>/dev/null | grep -c "BEGIN CERTIFICATE"

echo "测试TLS 1.2连接:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_2 2>/dev/null | grep -E "(Protocol|Cipher)"

# 10. 清理临时文件
echo "10. 清理临时文件..."
rm -f /tmp/lets-encrypt-*.pem /tmp/isrgrootx1.pem /tmp/aipaint.cloud-fullchain.crt

echo "证书链修复完成！"
echo "建议在微信小程序中重新测试连接。"
