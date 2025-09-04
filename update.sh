#!/bin/bash

# 快速更新脚本 - 拉取最新代码并重启服务
# 使用方法: ./update.sh

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="score-server"

echo -e "${BLUE}更新服务...${NC}"

# 拉取最新代码
echo -e "${YELLOW}拉取最新代码...${NC}"
git pull origin main

# 重新构建
echo -e "${YELLOW}重新构建应用...${NC}"
cd server
export PATH=$PATH:/usr/local/go/bin
go build -o mahjong-server main.go

# 重启服务
echo -e "${YELLOW}重启服务...${NC}"
systemctl restart $SERVICE_NAME

# 等待服务启动
sleep 3

# 验证
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✅ 更新成功！${NC}"
    echo -e "${BLUE}服务地址: http://124.156.196.117:8080${NC}"
else
    echo -e "${RED}❌ 更新失败，查看日志: journalctl -u $SERVICE_NAME -f${NC}"
    exit 1
fi