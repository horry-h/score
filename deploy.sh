#!/bin/bash

# 麻将记分小程序一键部署脚本
# 腾讯云服务器: 124.156.196.117
# 使用方法: ./deploy.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
SERVER_IP="124.156.196.117"
PROJECT_DIR="/root/horry/score"
SERVICE_NAME="score-server"
DB_NAME="mahjong_score"
DB_USER="mahjong_user"
DB_PASS="Mahjong2024!"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  麻将记分小程序一键部署${NC}"
echo -e "${BLUE}  服务器: ${SERVER_IP}${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查root权限
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用root用户运行此脚本${NC}"
    exit 1
fi

# 1. 更新系统并安装必要软件
echo -e "${YELLOW}[1/5] 安装必要软件...${NC}"
apt update -y
apt install -y git mysql-server

# 2. 安装Go
echo -e "${YELLOW}[2/5] 安装Go环境...${NC}"
if ! command -v go &> /dev/null; then
    cd /tmp
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
    export PATH=$PATH:/usr/local/go/bin
    rm go1.21.5.linux-amd64.tar.gz
fi

# 3. 配置MySQL
echo -e "${YELLOW}[3/5] 配置数据库...${NC}"
systemctl start mysql
systemctl enable mysql

# 创建数据库和用户
mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || true
mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';" 2>/dev/null || true
mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true

# 4. 配置环境变量
echo -e "${YELLOW}[4/5] 配置环境变量...${NC}"
cat > .env << EOF
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_DATABASE=${DB_NAME}
HTTP_PORT=8080
SERVER_HOST=0.0.0.0
SERVER_PUBLIC_IP=${SERVER_IP}
WECHAT_APPID=your_wechat_appid
WECHAT_APPSECRET=your_wechat_appsecret
ENV=production
EOF

# 5. 构建和部署应用
echo -e "${YELLOW}[5/5] 构建和部署应用...${NC}"
cd server

# 下载依赖
export PATH=$PATH:/usr/local/go/bin
go mod tidy

# 构建应用
go build -o mahjong-server main.go

# 初始化数据库
if [ -f "database.sql" ]; then
    mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} < database.sql 2>/dev/null || true
fi

# 创建systemd服务
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Score Server
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}/server
ExecStart=${PROJECT_DIR}/server/mahjong-server
Restart=always
RestartSec=5
Environment=ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

# 配置防火墙
ufw allow 22 2>/dev/null || true
ufw allow 80 2>/dev/null || true
ufw allow 8080 2>/dev/null || true
ufw --force enable 2>/dev/null || true

# 等待服务启动
sleep 3

# 验证部署
echo -e "${BLUE}验证部署结果...${NC}"
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ 服务启动成功${NC}"
    
    # 测试健康检查
    if curl -f -s http://localhost:8080/api/v1/health > /dev/null; then
        echo -e "${GREEN}✅ 健康检查通过${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  部署成功！${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo -e "${BLUE}服务信息：${NC}"
        echo -e "  API地址: http://${SERVER_IP}:8080"
        echo -e "  健康检查: http://${SERVER_IP}:8080/api/v1/health"
        echo -e "  服务状态: $(systemctl is-active ${SERVICE_NAME})"
        echo -e ""
        echo -e "${BLUE}常用命令：${NC}"
        echo -e "  查看状态: systemctl status ${SERVICE_NAME}"
        echo -e "  查看日志: journalctl -u ${SERVICE_NAME} -f"
        echo -e "  重启服务: systemctl restart ${SERVICE_NAME}"
        echo -e "  更新代码: cd ${PROJECT_DIR} && git pull && systemctl restart ${SERVICE_NAME}"
    else
        echo -e "${RED}❌ 健康检查失败${NC}"
        echo -e "${YELLOW}查看日志: journalctl -u ${SERVICE_NAME} -f${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 服务启动失败${NC}"
    echo -e "${YELLOW}查看日志: journalctl -u ${SERVICE_NAME} -f${NC}"
    exit 1
fi

echo -e "${GREEN}部署完成！${NC}"