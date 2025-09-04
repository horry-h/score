#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVICE_NAME="score-server"
PROJECT_DIR="/root/horry/score"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Systemd服务配置修复脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 检查当前目录
echo -e "\n${YELLOW}--- 1. 检查当前目录 ---${NC}"
echo -e "${BLUE}当前目录: $(pwd)${NC}"
echo -e "${BLUE}项目目录: ${PROJECT_DIR}${NC}"

# 2. 检查.env文件位置
echo -e "\n${YELLOW}--- 2. 检查.env文件位置 ---${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}当前目录的.env文件存在${NC}"
    ls -la .env
else
    echo -e "${RED}当前目录的.env文件不存在${NC}"
fi

if [ -f "${PROJECT_DIR}/.env" ]; then
    echo -e "${GREEN}项目目录的.env文件存在${NC}"
    ls -la ${PROJECT_DIR}/.env
else
    echo -e "${RED}项目目录的.env文件不存在${NC}"
fi

# 3. 创建.env文件到正确位置
echo -e "\n${YELLOW}--- 3. 创建.env文件到正确位置 ---${NC}"
cat > .env << 'EOF'
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=123456
DB_DATABASE=mahjong_score

# 服务端口配置
HTTP_PORT=8080
SERVER_HOST=0.0.0.0
SERVER_PUBLIC_IP=124.156.196.117

# 微信小程序配置
WECHAT_APPID=your_wechat_appid
WECHAT_APPSECRET=your_wechat_appsecret

# 环境配置
ENV=production
EOF

echo -e "${GREEN}已在当前目录创建.env文件${NC}"

# 4. 检查systemd服务配置
echo -e "\n${YELLOW}--- 4. 检查systemd服务配置 ---${NC}"
if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    echo -e "${GREEN}systemd服务文件存在${NC}"
    echo -e "${BLUE}当前服务配置:${NC}"
    cat /etc/systemd/system/${SERVICE_NAME}.service
else
    echo -e "${RED}systemd服务文件不存在${NC}"
fi

# 5. 更新systemd服务配置
echo -e "\n${YELLOW}--- 5. 更新systemd服务配置 ---${NC}"
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Score Server
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}
ExecStart=${PROJECT_DIR}/server/mahjong-server
Restart=always
RestartSec=5
Environment=ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}systemd服务配置已更新${NC}"

# 6. 重载systemd配置
echo -e "\n${YELLOW}--- 6. 重载systemd配置 ---${NC}"
systemctl daemon-reload
echo -e "${GREEN}systemd配置已重载${NC}"

# 7. 检查可执行文件
echo -e "\n${YELLOW}--- 7. 检查可执行文件 ---${NC}"
if [ -f "server/mahjong-server" ]; then
    echo -e "${GREEN}可执行文件存在${NC}"
    ls -la server/mahjong-server
    echo -e "${BLUE}文件架构:${NC}"
    file server/mahjong-server
else
    echo -e "${RED}可执行文件不存在${NC}"
    echo -e "${BLUE}尝试构建...${NC}"
    cd server
    export PATH=$PATH:/usr/local/go/bin
    go mod tidy
    go build -o mahjong-server main.go
    cd ..
    if [ -f "server/mahjong-server" ]; then
        echo -e "${GREEN}构建成功${NC}"
    else
        echo -e "${RED}构建失败${NC}"
        exit 1
    fi
fi

# 8. 重启服务
echo -e "\n${YELLOW}--- 8. 重启服务 ---${NC}"
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
echo -e "\n${YELLOW}--- 9. 测试API ---${NC}"
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
echo -e "${GREEN}  Systemd服务配置修复完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}如果问题仍然存在，请运行:${NC}"
echo -e "./troubleshoot.sh"
