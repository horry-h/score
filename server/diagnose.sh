#!/bin/bash

# 诊断脚本
# 用于检查服务状态和配置问题

set -e

echo "=== 麻将记分服务诊断 ==="
echo ""

# 1. 检查服务状态
echo "1. 检查服务状态:"
echo "Go服务状态:"
systemctl status mahjong-server --no-pager -l || echo "Go服务未运行"
echo ""
echo "Nginx服务状态:"
systemctl status nginx --no-pager -l || echo "Nginx服务未运行"
echo ""

# 2. 检查端口监听
echo "2. 检查端口监听:"
netstat -tlnp | grep -E ":(80|443|8080)" || echo "没有发现相关端口监听"
echo ""

# 3. 检查域名解析
echo "3. 检查域名解析:"
nslookup www.aipaint.cloud || echo "域名解析失败"
echo ""

# 4. 检查SSL证书文件
echo "4. 检查SSL证书文件:"
if [ -f "/etc/ssl/certs/aipaint.cloud.crt" ]; then
    echo "证书文件存在: /etc/ssl/certs/aipaint.cloud.crt"
    ls -la /etc/ssl/certs/aipaint.cloud.crt
else
    echo "证书文件不存在: /etc/ssl/certs/aipaint.cloud.crt"
fi

if [ -f "/etc/ssl/private/aipaint.cloud.key" ]; then
    echo "私钥文件存在: /etc/ssl/private/aipaint.cloud.key"
    ls -la /etc/ssl/private/aipaint.cloud.key
else
    echo "私钥文件不存在: /etc/ssl/private/aipaint.cloud.key"
fi
echo ""

# 5. 检查Let's Encrypt证书
echo "5. 检查Let's Encrypt证书:"
if [ -d "/etc/letsencrypt/live/www.aipaint.cloud" ]; then
    echo "Let's Encrypt证书目录存在"
    ls -la /etc/letsencrypt/live/www.aipaint.cloud/
else
    echo "Let's Encrypt证书目录不存在"
fi
echo ""

# 6. 检查Nginx配置
echo "6. 检查Nginx配置:"
if [ -f "/etc/nginx/sites-enabled/aipaint.cloud" ]; then
    echo "Nginx配置文件存在"
    echo "配置文件内容:"
    cat /etc/nginx/sites-enabled/aipaint.cloud
else
    echo "Nginx配置文件不存在"
fi
echo ""

# 7. 测试本地连接
echo "7. 测试本地连接:"
echo "测试Go服务 (8080端口):"
curl -s http://127.0.0.1:8080/health || echo "Go服务连接失败"
echo ""
echo "测试Nginx (80端口):"
curl -s http://127.0.0.1/health || echo "Nginx HTTP连接失败"
echo ""

echo "=== 诊断完成 ==="
