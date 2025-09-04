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

# 检查是否有更新
echo -e "${YELLOW}检查代码更新...${NC}"
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}代码已是最新版本，无需更新${NC}"
    exit 0
fi

# 拉取最新代码
echo -e "${YELLOW}拉取最新代码...${NC}"
git pull origin main

# 重新构建
echo -e "${YELLOW}重新构建应用...${NC}"

# 进入server目录
cd server
export PATH=$PATH:/usr/local/go/bin
go mod tidy
go build -o mahjong-server main.go

# 返回项目根目录
cd ..

# 重启服务
echo -e "${YELLOW}重启服务...${NC}"
systemctl restart $SERVICE_NAME

if [ $? -eq 0 ]; then
    echo -e "${GREEN}服务重启成功${NC}"
else
    echo -e "${RED}服务重启失败${NC}"
    echo -e "${BLUE}查看错误日志:${NC}"
    journalctl -u $SERVICE_NAME -n 10 --no-pager
    exit 1
fi

# 等待服务启动
echo -e "${BLUE}等待服务启动...${NC}"
sleep 5

# 验证
echo -e "${BLUE}验证更新结果...${NC}"

# 检查服务状态
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✅ 服务运行状态正常${NC}"
else
    echo -e "${RED}❌ 服务未运行${NC}"
    echo -e "${BLUE}服务状态:${NC}"
    systemctl status $SERVICE_NAME --no-pager
    echo -e "${BLUE}查看详细日志:${NC}"
    journalctl -u $SERVICE_NAME -n 20 --no-pager
    exit 1
fi

# 检查端口监听
if ss -tuln | grep ":8080" &> /dev/null; then
    echo -e "${GREEN}✅ 端口8080正在监听${NC}"
else
    echo -e "${RED}❌ 端口8080未监听${NC}"
    echo -e "${BLUE}查看服务日志:${NC}"
    journalctl -u $SERVICE_NAME -n 10 --no-pager
    exit 1
fi

# 测试健康检查
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/health)
if [ "$HEALTH_RESPONSE" -eq 200 ]; then
    echo -e "${GREEN}✅ API健康检查通过 (HTTP $HEALTH_RESPONSE)${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  更新成功！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${BLUE}服务信息：${NC}"
    echo -e "  API地址: http://124.156.196.117:8080"
    echo -e "  健康检查: http://124.156.196.117:8080/api/v1/health"
    echo -e "  服务状态: $(systemctl is-active $SERVICE_NAME)"
    echo -e "  项目目录: $(pwd)"
else
    echo -e "${RED}❌ API健康检查失败 (HTTP $HEALTH_RESPONSE)${NC}"
    echo -e "${BLUE}查看服务日志:${NC}"
    journalctl -u $SERVICE_NAME -n 10 --no-pager
    exit 1
fi