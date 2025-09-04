#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVICE_NAME="score-server"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  快速更新脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 进入server目录
echo -e "\n${YELLOW}--- 1. 进入server目录 ---${NC}"
cd server
echo -e "${GREEN}当前目录: $(pwd)${NC}"

# 2. 构建应用
echo -e "\n${YELLOW}--- 2. 构建应用 ---${NC}"
export PATH=$PATH:/usr/local/go/bin
go build -o mahjong-server main.go
if [ $? -eq 0 ]; then
    echo -e "${GREEN}应用构建成功${NC}"
else
    echo -e "${RED}应用构建失败${NC}"
    exit 1
fi

# 3. 返回项目根目录
cd ..

# 4. 重启服务
echo -e "\n${YELLOW}--- 3. 重启服务 ---${NC}"
systemctl restart ${SERVICE_NAME}
sleep 3

if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}服务重启成功${NC}"
else
    echo -e "${RED}服务重启失败${NC}"
    echo -e "${BLUE}查看错误日志:${NC}"
    journalctl -u ${SERVICE_NAME} -n 10 --no-pager
    exit 1
fi

# 5. 测试健康检查
echo -e "\n${YELLOW}--- 4. 测试健康检查 ---${NC}"
sleep 2
HEALTH_RESPONSE=$(curl -s http://localhost:8080/api/v1/health)
if echo "$HEALTH_RESPONSE" | grep -q "服务运行正常"; then
    echo -e "${GREEN}健康检查成功${NC}"
    echo -e "${BLUE}健康检查响应:${NC}"
    echo "$HEALTH_RESPONSE" | head -10
else
    echo -e "${RED}健康检查失败${NC}"
    echo -e "${BLUE}响应内容:${NC}"
    echo "$HEALTH_RESPONSE"
fi

# 6. 测试其他API端点
echo -e "\n${YELLOW}--- 5. 测试API端点 ---${NC}"
echo -e "${BLUE}测试根路径:${NC}"
curl -s http://localhost:8080/ | head -3

echo -e "\n${BLUE}测试API根路径:${NC}"
curl -s http://localhost:8080/api/ | head -3

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  快速更新完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}服务信息:${NC}"
echo -e "  健康检查: http://124.156.196.117:8080/api/v1/health"
echo -e "  服务状态: $(systemctl is-active ${SERVICE_NAME})"
echo -e "  端口监听: $(ss -tuln | grep ':8080' | wc -l) 个进程"
