#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVICE_NAME="score-server"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  应用重新构建脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 检查Go环境
echo -e "\n${YELLOW}--- 1. 检查Go环境 ---${NC}"
if command -v go &> /dev/null; then
    echo -e "${GREEN}Go已安装: $(go version)${NC}"
else
    echo -e "${RED}Go未安装，请先安装Go${NC}"
    exit 1
fi

# 2. 进入server目录
echo -e "\n${YELLOW}--- 2. 进入server目录 ---${NC}"
if [ -d "server" ]; then
    cd server
    echo -e "${GREEN}已进入server目录: $(pwd)${NC}"
else
    echo -e "${RED}server目录不存在${NC}"
    exit 1
fi

# 3. 清理旧的可执行文件
echo -e "\n${YELLOW}--- 3. 清理旧文件 ---${NC}"
if [ -f "mahjong-server" ]; then
    rm -f mahjong-server
    echo -e "${GREEN}已删除旧的可执行文件${NC}"
fi

# 4. 下载依赖
echo -e "\n${YELLOW}--- 4. 下载依赖 ---${NC}"
export PATH=$PATH:/usr/local/go/bin
go mod tidy
if [ $? -eq 0 ]; then
    echo -e "${GREEN}依赖下载成功${NC}"
else
    echo -e "${RED}依赖下载失败${NC}"
    exit 1
fi

# 5. 构建应用
echo -e "\n${YELLOW}--- 5. 构建应用 ---${NC}"
echo -e "${BLUE}正在构建应用...${NC}"
go build -o mahjong-server main.go
if [ $? -eq 0 ]; then
    echo -e "${GREEN}应用构建成功${NC}"
    ls -la mahjong-server
else
    echo -e "${RED}应用构建失败${NC}"
    exit 1
fi

# 6. 检查可执行文件
echo -e "\n${YELLOW}--- 6. 检查可执行文件 ---${NC}"
if [ -f "mahjong-server" ]; then
    echo -e "${GREEN}可执行文件存在${NC}"
    echo -e "${BLUE}文件信息:${NC}"
    ls -la mahjong-server
    echo -e "${BLUE}文件类型:${NC}"
    file mahjong-server
    echo -e "${BLUE}文件权限:${NC}"
    ls -la mahjong-server | awk '{print $1, $3, $4}'
else
    echo -e "${RED}可执行文件不存在${NC}"
    exit 1
fi

# 7. 返回项目根目录
cd ..

# 8. 重启服务
echo -e "\n${YELLOW}--- 7. 重启服务 ---${NC}"
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

# 9. 测试API
echo -e "\n${YELLOW}--- 8. 测试API ---${NC}"
sleep 2
if curl -s http://localhost:8080/api/v1/health > /dev/null; then
    echo -e "${GREEN}API测试成功${NC}"
    echo -e "${BLUE}API响应:${NC}"
    curl -s http://localhost:8080/api/v1/health | head -3
else
    echo -e "${RED}API测试失败${NC}"
    echo -e "${BLUE}检查端口监听:${NC}"
    ss -tuln | grep ":8080"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  应用重新构建完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}如果问题仍然存在，请运行:${NC}"
echo -e "./troubleshoot.sh"
