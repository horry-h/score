#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVER_IP="124.156.196.117"
SERVER_USER="root"
SERVER_PATH="/root/horry/score"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  部署修复到服务器${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}--- 1. 上传修复后的代码 ---${NC}"
echo "请确保已经通过git push将修复后的代码推送到服务器"

echo -e "\n${YELLOW}--- 2. 在服务器上重新构建 ---${NC}"
echo "在服务器上运行以下命令："
echo "cd ${SERVER_PATH}"
echo "git pull"
echo "cd server"
echo "go mod tidy"
echo "go build -o mahjong-server ."
echo "sudo systemctl restart score-server"

echo -e "\n${YELLOW}--- 3. 测试API ---${NC}"
echo "测试登录API："
echo "curl -X POST http://${SERVER_IP}:8080/api/v1/login -H \"Content-Type: application/json\" -d '{\"code\":\"test_code\",\"nickname\":\"测试用户\",\"avatar_url\":\"https://example.com/avatar.jpg\"}'"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  部署说明完成${NC}"
echo -e "${GREEN}========================================${NC}"
