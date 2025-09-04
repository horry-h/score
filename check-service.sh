#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVICE_NAME="score-server"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  服务状态检查${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 服务状态
echo -e "\n${YELLOW}--- 服务状态 ---${NC}"
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ 服务正在运行${NC}"
else
    echo -e "${RED}❌ 服务未运行${NC}"
fi

systemctl status ${SERVICE_NAME} --no-pager

# 2. 端口监听
echo -e "\n${YELLOW}--- 端口监听 ---${NC}"
if ss -tuln | grep ":8080" &> /dev/null; then
    echo -e "${GREEN}✅ 端口8080正在监听${NC}"
    ss -tuln | grep ":8080"
else
    echo -e "${RED}❌ 端口8080未监听${NC}"
fi

# 3. 最近日志
echo -e "\n${YELLOW}--- 最近日志 ---${NC}"
journalctl -u ${SERVICE_NAME} -n 10 --no-pager

# 4. 可执行文件
echo -e "\n${YELLOW}--- 可执行文件 ---${NC}"
if [ -f "server/mahjong-server" ]; then
    echo -e "${GREEN}✅ 可执行文件存在${NC}"
    ls -la server/mahjong-server
else
    echo -e "${RED}❌ 可执行文件不存在${NC}"
fi

# 5. 数据库连接测试
echo -e "\n${YELLOW}--- 数据库连接 ---${NC}"
if mysql -u mahjong_user -pMahjong2024! -e "SELECT 1;" mahjong_score &> /dev/null; then
    echo -e "${GREEN}✅ 数据库连接正常${NC}"
else
    echo -e "${RED}❌ 数据库连接失败${NC}"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  检查完成${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}如果服务未运行，请尝试:${NC}"
echo -e "1. 运行快速修复: ./quick-fix.sh"
echo -e "2. 运行数据库修复: ./fix-database.sh"
echo -e "3. 手动重启服务: systemctl restart ${SERVICE_NAME}"
echo -e "4. 查看详细日志: journalctl -u ${SERVICE_NAME} -f"
