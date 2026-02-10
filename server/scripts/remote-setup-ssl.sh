#!/bin/bash

# 远程服务器SSL自动化部署脚本
# 用于从本地一键部署到远程服务器

set -e

SERVER_IP="124.156.196.117"
SERVER_USER="root"
SERVER_PATH="~/horry/score"

echo "=== 远程服务器SSL自动化部署 ==="
echo "目标服务器: $SERVER_USER@$SERVER_IP"
echo "目标路径: $SERVER_PATH"
echo ""

# 1. 上传setup-certbot.sh脚本到服务器
echo "1. 上传SSL自动化脚本到服务器..."
scp -r ../scripts/setup-certbot.sh $SERVER_USER@$SERVER_IP:$SERVER_PATH/server/scripts/
echo "✅ 脚本上传完成"

# 2. 远程执行脚本
echo ""
echo "2. 在远程服务器上执行SSL配置..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
cd ~/horry/score/server/scripts
chmod +x setup-certbot.sh
./setup-certbot.sh
ENDSSH

echo ""
echo "=== 部署完成 ==="
echo "✅ SSL证书已在远程服务器上配置完成"
echo ""
echo "🌐 访问地址:"
echo "   - https://aipaint.cloud"
echo "   - https://www.aipaint.cloud"
