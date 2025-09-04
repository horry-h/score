#!/bin/bash

# 快速更新脚本 - 拉取最新代码并重启服务
# 使用方法: ./update.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="score-server"

echo -e "${BLUE}更新服务...${NC}"

# 检查是否在正确的项目目录
if [ ! -f "update.sh" ] || [ ! -d "server" ]; then
    echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
    echo -e "${YELLOW}当前目录: $(pwd)${NC}"
    echo -e "${YELLOW}请确保目录包含 update.sh 和 server/ 目录${NC}"
    exit 1
fi

echo -e "${GREEN}检测到项目目录: $(pwd)${NC}"

# 拉取最新代码
echo -e "${YELLOW}拉取最新代码...${NC}"
git pull origin main

# 重新构建
echo -e "${YELLOW}重新构建应用...${NC}"

# 进入server目录
cd server
export PATH=$PATH:/usr/local/go/bin
go build -o mahjong-server main.go

# 返回项目根目录
cd ..

# 重启服务
echo -e "${YELLOW}重启服务...${NC}"
systemctl restart $SERVICE_NAME

# 等待服务启动
sleep 3

# 验证
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✅ 更新成功！${NC}"
    echo -e "${BLUE}服务地址: http://124.156.196.117:8080${NC}"
    echo -e "${BLUE}项目目录: $(pwd)${NC}"
else
    echo -e "${RED}❌ 更新失败，查看日志: journalctl -u $SERVICE_NAME -f${NC}"
    exit 1
fi