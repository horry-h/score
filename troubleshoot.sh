#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置
SERVER_IP="124.156.196.117"
PROJECT_DIR="/root/horry/score"
SERVICE_NAME="score-server"
DB_NAME="mahjong_score"
DB_USER="root"
DB_PASS="123456"
HTTP_PORT="8080"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Score项目故障排除工具${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 检查项目目录
echo -e "\n${YELLOW}--- 1. 项目目录检查 ---${NC}"
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${GREEN}项目目录 $PROJECT_DIR 存在。${NC}"
    echo -e "${BLUE}当前项目内容:${NC}"
    ls -F "$PROJECT_DIR"
else
    echo -e "${RED}项目目录 $PROJECT_DIR 不存在。${NC}"
    echo -e "${BLUE}建议: 运行 git clone 或检查路径配置${NC}"
fi

# 2. 检查Go环境
echo -e "\n${YELLOW}--- 2. Go环境检查 ---${NC}"
if command -v go &> /dev/null; then
    echo -e "${GREEN}Go已安装: $(go version)${NC}"
    echo -e "${BLUE}GOPATH: $GOPATH${NC}"
    echo -e "${BLUE}GOROOT: $GOROOT${NC}"
else
    echo -e "${RED}Go未安装。${NC}"
    echo -e "${BLUE}建议: 安装Go 1.21+${NC}"
fi

# 3. 检查MySQL服务
echo -e "\n${YELLOW}--- 3. MySQL服务检查 ---${NC}"
if systemctl is-active --quiet mysql; then
    echo -e "${GREEN}MySQL服务正在运行。${NC}"
    echo -e "${BLUE}数据库连接测试:${NC}"
    if mysql -u ${DB_USER} -p${DB_PASS} -h localhost -e "SELECT 1;" ${DB_NAME} &> /dev/null; then
        echo -e "${GREEN}成功连接到数据库 ${DB_NAME}。${NC}"
        echo -e "${BLUE}数据库表:${NC}"
        mysql -u ${DB_USER} -p${DB_PASS} -h localhost -e "SHOW TABLES;" ${DB_NAME} 2>/dev/null || echo "无法获取表信息"
    else
        echo -e "${RED}无法连接到数据库 ${DB_NAME} 或用户权限问题。${NC}"
        echo -e "${BLUE}建议: 检查数据库配置和用户权限${NC}"
    fi
else
    echo -e "${RED}MySQL服务未运行。${NC}"
    echo -e "${BLUE}建议: 启动MySQL服务${NC}"
fi

# 4. 检查应用服务
echo -e "\n${YELLOW}--- 4. 应用服务检查 (${SERVICE_NAME}) ---${NC}"
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}服务 ${SERVICE_NAME} 正在运行。${NC}"
    echo -e "${BLUE}服务状态:${NC}"
    systemctl status ${SERVICE_NAME} --no-pager
else
    echo -e "${RED}服务 ${SERVICE_NAME} 未运行。${NC}"
    echo -e "${BLUE}尝试查看日志以诊断问题:${NC}"
    journalctl -u ${SERVICE_NAME} -n 20 --no-pager
fi

# 5. 检查端口监听
echo -e "\n${YELLOW}--- 5. 端口监听检查 ---${NC}"
if ss -tuln | grep ":${HTTP_PORT}" &> /dev/null; then
    echo -e "${GREEN}端口 ${HTTP_PORT} 正在监听。${NC}"
    echo -e "${BLUE}监听详情:${NC}"
    ss -tuln | grep ":${HTTP_PORT}"
else
    echo -e "${RED}端口 ${HTTP_PORT} 未监听。${NC}"
    echo -e "${BLUE}当前所有监听的端口:${NC}"
    ss -tuln | grep LISTEN
fi

# 6. 检查防火墙
echo -e "\n${YELLOW}--- 6. 防火墙检查 ---${NC}"
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | grep "Status: active")
    if [ -n "$UFW_STATUS" ]; then
        echo -e "${GREEN}UFW防火墙已启用。${NC}"
        if ufw status | grep -q "${HTTP_PORT}"; then
            echo -e "${GREEN}端口 ${HTTP_PORT} 已在防火墙中允许。${NC}"
        else
            echo -e "${YELLOW}警告: 端口 ${HTTP_PORT} 可能未在防火墙中明确允许。${NC}"
        fi
    else
        echo -e "${YELLOW}UFW防火墙未启用。${NC}"
    fi
else
    echo -e "${YELLOW}UFW未安装，检查iptables:${NC}"
    if iptables -L INPUT | grep -q "${HTTP_PORT}"; then
        echo -e "${GREEN}端口 ${HTTP_PORT} 在iptables中已允许。${NC}"
    else
        echo -e "${YELLOW}端口 ${HTTP_PORT} 可能未在iptables中明确允许。${NC}"
    fi
fi

# 7. API健康检查
echo -e "\n${YELLOW}--- 7. API健康检查 ---${NC}"
HEALTH_URL="http://${SERVER_IP}:${HTTP_PORT}/api/v1/health"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")
if [ "$HEALTH_RESPONSE" -eq 200 ]; then
    echo -e "${GREEN}API健康检查成功 (${HEALTH_URL})。${NC}"
    echo -e "${BLUE}API响应:${NC}"
    curl -s "$HEALTH_URL" | head -5
else
    echo -e "${RED}API健康检查失败 (${HEALTH_URL})。HTTP状态码: ${HEALTH_RESPONSE}${NC}"
    echo -e "${BLUE}尝试本地健康检查:${NC}"
    LOCAL_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HTTP_PORT}/api/v1/health")
    if [ "$LOCAL_HEALTH" -eq 200 ]; then
        echo -e "${GREEN}本地API健康检查成功，可能是网络或防火墙问题。${NC}"
    else
        echo -e "${RED}本地API健康检查也失败，服务可能有问题。${NC}"
    fi
fi

# 8. 环境变量检查
echo -e "\n${YELLOW}--- 8. 环境变量检查 (.env) ---${NC}"
if [ -f "$PROJECT_DIR/.env" ]; then
    echo -e "${GREEN}.env 文件存在。${NC}"
    echo -e "${BLUE}关键环境变量:${NC}"
    grep -E "DB_HOST|DB_PORT|HTTP_PORT|WECHAT_APPID|WECHAT_APPSECRET" "$PROJECT_DIR/.env" || echo "未找到关键环境变量"
else
    echo -e "${RED}.env 文件不存在。${NC}"
    echo -e "${BLUE}建议: 创建 .env 文件${NC}"
fi

# 9. 可执行文件检查
echo -e "\n${YELLOW}--- 9. 可执行文件检查 ---${NC}"
if [ -f "$PROJECT_DIR/server/mahjong-server" ]; then
    echo -e "${GREEN}可执行文件存在。${NC}"
    echo -e "${BLUE}文件信息:${NC}"
    ls -la "$PROJECT_DIR/server/mahjong-server"
    echo -e "${BLUE}文件类型:${NC}"
    file "$PROJECT_DIR/server/mahjong-server"
else
    echo -e "${RED}可执行文件不存在。${NC}"
    echo -e "${BLUE}建议: 运行 go build 构建应用${NC}"
fi

# 10. 系统资源检查
echo -e "\n${YELLOW}--- 10. 系统资源检查 ---${NC}"
echo -e "${BLUE}内存使用:${NC}"
free -h
echo -e "${BLUE}磁盘使用:${NC}"
df -h /
echo -e "${BLUE}CPU负载:${NC}"
uptime

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}故障排除完成。请根据以上信息诊断问题。${NC}"
echo -e "${BLUE}========================================${NC}"

# 提供常见问题的解决建议
echo -e "\n${YELLOW}--- 常见问题解决建议 ---${NC}"
echo -e "${BLUE}1. 如果服务未启动:${NC}"
echo -e "   systemctl start ${SERVICE_NAME}"
echo -e "   journalctl -u ${SERVICE_NAME} -f"
echo -e ""
echo -e "${BLUE}2. 如果端口未监听:${NC}"
echo -e "   检查服务是否正常启动"
echo -e "   检查配置文件中的端口设置"
echo -e ""
echo -e "${BLUE}3. 如果API无法访问:${NC}"
echo -e "   检查防火墙设置"
echo -e "   检查网络连接"
echo -e "   检查服务日志"
echo -e ""
echo -e "${BLUE}4. 如果数据库连接失败:${NC}"
echo -e "   运行数据库修复脚本: ./fix-database.sh"
echo -e "   检查MySQL服务状态: systemctl status mysql"
echo -e "   检查数据库用户权限"
echo -e "   检查.env文件中的数据库配置"
echo -e ""
echo -e "${BLUE}5. 如果遇到MySQL认证问题:${NC}"
echo -e "   使用 sudo mysql 连接数据库"
echo -e "   检查用户认证插件设置"
echo -e "   重新创建数据库用户"
