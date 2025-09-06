#!/bin/bash

# HTTPS测试脚本
# 用于测试HTTPS配置是否正常工作

set -e

echo "测试HTTPS配置..."

# 测试健康检查接口
echo "1. 测试健康检查接口..."
curl -k -s https://www.aipaint.cloud/health | jq . || echo "健康检查接口测试失败"

echo ""

# 测试API健康检查接口
echo "2. 测试API健康检查接口..."
curl -k -s https://www.aipaint.cloud/api/v1/health | jq . || echo "API健康检查接口测试失败"

echo ""

# 测试SSL证书
echo "3. 测试SSL证书..."
echo | openssl s_client -servername www.aipaint.cloud -connect www.aipaint.cloud:443 2>/dev/null | openssl x509 -noout -dates

echo ""

# 测试HTTP重定向
echo "4. 测试HTTP重定向..."
curl -I http://www.aipaint.cloud/health 2>/dev/null | grep -i location || echo "HTTP重定向测试失败"

echo ""

# 测试服务状态
echo "5. 检查服务状态..."
echo "Go服务状态:"
systemctl is-active mahjong-server
echo "Nginx服务状态:"
systemctl is-active nginx

echo ""
echo "HTTPS测试完成！"
