#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVICE_NAME="score-server"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  应用重新构建和重启脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 检查Go环境
echo -e "\n${YELLOW}--- 1. 检查Go环境 ---${NC}"
if command -v go &> /dev/null; then
    echo -e "${GREEN}Go已安装: $(go version)${NC}"
else
    echo -e "${RED}Go未安装${NC}"
    exit 1
fi

# 2. 进入server目录
echo -e "\n${YELLOW}--- 2. 进入server目录 ---${NC}"
cd server
echo -e "${GREEN}当前目录: $(pwd)${NC}"

# 3. 清理旧文件
echo -e "\n${YELLOW}--- 3. 清理旧文件 ---${NC}"
rm -f mahjong-server
echo -e "${GREEN}已删除旧的可执行文件${NC}"

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
go build -o mahjong-server main.go
if [ $? -eq 0 ]; then
    echo -e "${GREEN}应用构建成功${NC}"
    ls -la mahjong-server
    echo -e "${BLUE}文件架构:${NC}"
    file mahjong-server
else
    echo -e "${RED}应用构建失败${NC}"
    exit 1
fi

# 6. 返回项目根目录
cd ..

# 7. 重启服务
echo -e "\n${YELLOW}--- 6. 重启服务 ---${NC}"
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

# 8. 测试API
echo -e "\n${YELLOW}--- 7. 测试API ---${NC}"
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
echo -e "${GREEN}  应用重新构建和重启完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}数据库配置已硬编码在代码中:${NC}"
echo -e "  主机: localhost"
echo -e "  端口: 3306"
echo -e "  用户名: root"
echo -e "  密码: 123456"
echo -e "  数据库: mahjong_score"
