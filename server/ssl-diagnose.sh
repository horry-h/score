#!/bin/bash

# SSL诊断脚本 - 检查iOS兼容性
echo "=== SSL诊断报告 ==="
echo "时间: $(date)"
echo "域名: www.aipaint.cloud"
echo ""

# 1. 检查证书信息
echo "1. 证书信息:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud 2>/dev/null | openssl x509 -noout -text | grep -A 3 "Subject:"
echo ""

# 2. 检查支持的TLS版本
echo "2. TLS版本支持测试:"
echo "TLS 1.0:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1 2>/dev/null | grep -E "(Protocol|Cipher)" || echo "不支持TLS 1.0"

echo "TLS 1.1:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_1 2>/dev/null | grep -E "(Protocol|Cipher)" || echo "不支持TLS 1.1"

echo "TLS 1.2:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_2 2>/dev/null | grep -E "(Protocol|Cipher)" || echo "不支持TLS 1.2"

echo "TLS 1.3:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud -tls1_3 2>/dev/null | grep -E "(Protocol|Cipher)" || echo "不支持TLS 1.3"
echo ""

# 3. 检查加密套件
echo "3. 支持的加密套件:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud 2>/dev/null | grep -A 50 "Cipher Suites" | head -20
echo ""

# 4. 检查证书链
echo "4. 证书链:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud 2>/dev/null | openssl x509 -noout -text | grep -A 10 "Issuer:"
echo ""

# 5. 检查证书有效期
echo "5. 证书有效期:"
echo | openssl s_client -connect www.aipaint.cloud:443 -servername www.aipaint.cloud 2>/dev/null | openssl x509 -noout -dates
echo ""

# 6. 使用nmap检查SSL配置
echo "6. 使用nmap检查SSL配置:"
if command -v nmap &> /dev/null; then
    nmap --script ssl-enum-ciphers -p 443 www.aipaint.cloud 2>/dev/null | grep -A 20 "TLSv1.2" || echo "nmap未找到或无法检查"
else
    echo "nmap未安装，跳过此检查"
fi
echo ""

# 7. 检查HTTP/2支持
echo "7. HTTP/2支持:"
curl -I --http2 -s https://www.aipaint.cloud/health | grep -i "HTTP/2" || echo "不支持HTTP/2"
echo ""

echo "=== 诊断完成 ==="
echo "如果发现TLS 1.2支持有问题，请运行 ./fix-ssl-ios.sh 修复配置"
