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
DB_USER="root"
DB_PASS="123456"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  麻将记分小程序一键部署${NC}"
echo -e "${BLUE}  服务器: ${SERVER_IP}${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查root权限
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用root用户运行此脚本${NC}"
    exit 1
fi

# 检查是否在正确的项目目录
if [ ! -f "deploy.sh" ] || [ ! -d "server" ]; then
    echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
    echo -e "${YELLOW}当前目录: $(pwd)${NC}"
    echo -e "${YELLOW}请确保目录包含 deploy.sh 和 server/ 目录${NC}"
    exit 1
fi

echo -e "${GREEN}检测到项目目录: $(pwd)${NC}"

# 1. 更新系统并安装必要软件
echo -e "${YELLOW}[1/5] 检查并安装必要软件...${NC}"

# 检查并安装git
if ! command -v git &> /dev/null; then
    echo -e "${BLUE}安装git...${NC}"
    apt update -y
    apt install -y git
else
    echo -e "${GREEN}git已安装${NC}"
fi

# 检查并安装MySQL
if ! command -v mysql &> /dev/null; then
    echo -e "${BLUE}安装MySQL...${NC}"
    apt update -y
    apt install -y mysql-server
else
    echo -e "${GREEN}MySQL已安装${NC}"
fi

# 2. 安装Go
echo -e "${YELLOW}[2/5] 检查并安装Go环境...${NC}"
if ! command -v go &> /dev/null; then
    echo -e "${BLUE}安装Go 1.21.5...${NC}"
    cd /tmp
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
    export PATH=$PATH:/usr/local/go/bin
    rm go1.21.5.linux-amd64.tar.gz
    cd - > /dev/null  # 返回原目录
    echo -e "${GREEN}Go安装完成${NC}"
else
    echo -e "${GREEN}Go已安装: $(go version)${NC}"
fi

# 3. 配置MySQL
echo -e "${YELLOW}[3/5] 配置数据库...${NC}"

# 启动MySQL服务
systemctl start mysql
systemctl enable mysql

# 检查数据库是否已存在
DB_EXISTS=$(mysql -u ${DB_USER} -p${DB_PASS} -e "SHOW DATABASES LIKE '${DB_NAME}';" 2>/dev/null | grep -c "${DB_NAME}" || echo "0")

if [ "$DB_EXISTS" -eq 0 ]; then
    echo -e "${BLUE}创建数据库...${NC}"
    mysql -u ${DB_USER} -p${DB_PASS} -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
    echo -e "${GREEN}数据库创建完成${NC}"
else
    echo -e "${GREEN}数据库已存在${NC}"
fi

# 4. 配置环境变量
echo -e "${YELLOW}[4/5] 配置环境变量...${NC}"

# 检查.env文件是否已存在
if [ -f ".env" ]; then
    echo -e "${GREEN}环境配置文件已存在，跳过创建${NC}"
else
    echo -e "${BLUE}创建环境配置文件...${NC}"
    cat > .env << EOF
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_DATABASE=${DB_NAME}

# 服务端口配置
HTTP_PORT=8080
SERVER_HOST=0.0.0.0
SERVER_PUBLIC_IP=${SERVER_IP}

# 微信小程序配置
WECHAT_APPID=your_wechat_appid
WECHAT_APPSECRET=your_wechat_appsecret

# 环境配置
ENV=production
EOF
    echo -e "${GREEN}环境配置文件创建完成${NC}"
fi

# 5. 构建和部署应用
echo -e "${YELLOW}[5/5] 构建和部署应用...${NC}"

# 进入server目录
cd server

# 下载依赖
export PATH=$PATH:/usr/local/go/bin
echo -e "${BLUE}更新Go依赖...${NC}"
go mod tidy

# 构建应用
echo -e "${BLUE}构建应用...${NC}"
go build -o mahjong-server main.go

# 初始化数据库（只在首次部署时执行）
if [ -f "database.sql" ]; then
    echo -e "${BLUE}检查数据库表结构...${NC}"
    TABLE_COUNT=$(mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "SHOW TABLES;" 2>/dev/null | wc -l || echo "0")
    if [ "$TABLE_COUNT" -le 1 ]; then
        echo -e "${BLUE}初始化数据库表结构...${NC}"
        mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} < database.sql 2>/dev/null || true
        echo -e "${GREEN}数据库表结构初始化完成${NC}"
    else
        echo -e "${GREEN}数据库表结构已存在，跳过初始化${NC}"
    fi
fi

# 返回项目根目录
cd ..

# 创建或更新systemd服务
echo -e "${BLUE}配置系统服务...${NC}"
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Score Server
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)/server
ExecStart=$(pwd)/server/mahjong-server
Restart=always
RestartSec=5
Environment=ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 重载systemd配置并启动服务
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}

# 检查服务是否已在运行
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}服务已在运行，重启服务...${NC}"
    systemctl restart ${SERVICE_NAME}
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}服务重启成功${NC}"
    else
        echo -e "${RED}服务重启失败${NC}"
        echo -e "${BLUE}查看错误日志:${NC}"
        journalctl -u ${SERVICE_NAME} -n 10 --no-pager
        exit 1
    fi
else
    echo -e "${BLUE}启动服务...${NC}"
    systemctl start ${SERVICE_NAME}
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}服务启动成功${NC}"
    else
        echo -e "${RED}服务启动失败${NC}"
        echo -e "${BLUE}查看错误日志:${NC}"
        journalctl -u ${SERVICE_NAME} -n 10 --no-pager
        exit 1
    fi
fi

# 配置防火墙（只在首次部署时配置）
echo -e "${BLUE}配置防火墙...${NC}"
if command -v ufw &> /dev/null; then
    if ! ufw status | grep -q "8080"; then
        ufw allow 22 2>/dev/null || true
        ufw allow 80 2>/dev/null || true
        ufw allow 8080 2>/dev/null || true
        ufw --force enable 2>/dev/null || true
        echo -e "${GREEN}UFW防火墙配置完成${NC}"
    else
        echo -e "${GREEN}UFW防火墙已配置，跳过${NC}"
    fi
else
    echo -e "${YELLOW}UFW未安装，尝试使用iptables配置防火墙...${NC}"
    # 使用iptables配置防火墙
    iptables -I INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || true
    iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
    iptables -I INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null || true
    echo -e "${GREEN}iptables防火墙配置完成${NC}"
fi

# 等待服务启动
echo -e "${BLUE}等待服务启动...${NC}"
sleep 5

# 验证部署
echo -e "${BLUE}验证部署结果...${NC}"

# 检查服务状态
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}✅ 服务运行状态正常${NC}"
else
    echo -e "${RED}❌ 服务未运行${NC}"
    echo -e "${BLUE}服务状态:${NC}"
    systemctl status ${SERVICE_NAME} --no-pager
    echo -e "${BLUE}查看详细日志:${NC}"
    journalctl -u ${SERVICE_NAME} -n 20 --no-pager
    exit 1
fi

# 检查端口监听
echo -e "${BLUE}检查端口监听...${NC}"
if ss -tuln | grep ":8080" &> /dev/null; then
    echo -e "${GREEN}✅ 端口8080正在监听${NC}"
else
    echo -e "${RED}❌ 端口8080未监听${NC}"
    echo -e "${BLUE}当前监听的端口:${NC}"
    ss -tuln | grep LISTEN
    echo -e "${BLUE}查看服务日志:${NC}"
    journalctl -u ${SERVICE_NAME} -n 10 --no-pager
    exit 1
fi

# 测试健康检查
echo -e "${BLUE}测试API健康检查...${NC}"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/health)
if [ "$HEALTH_RESPONSE" -eq 200 ]; then
    echo -e "${GREEN}✅ API健康检查通过 (HTTP $HEALTH_RESPONSE)${NC}"
    echo -e "${BLUE}API响应内容:${NC}"
    curl -s http://localhost:8080/api/v1/health | head -3
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  部署成功！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${BLUE}服务信息：${NC}"
    echo -e "  API地址: http://${SERVER_IP}:8080"
    echo -e "  健康检查: http://${SERVER_IP}:8080/api/v1/health"
    echo -e "  服务状态: $(systemctl is-active ${SERVICE_NAME})"
    echo -e "  项目目录: $(pwd)"
    echo -e ""
    echo -e "${BLUE}常用命令：${NC}"
    echo -e "  查看状态: systemctl status ${SERVICE_NAME}"
    echo -e "  查看日志: journalctl -u ${SERVICE_NAME} -f"
    echo -e "  重启服务: systemctl restart ${SERVICE_NAME}"
    echo -e "  更新代码: cd $(pwd) && git pull && systemctl restart ${SERVICE_NAME}"
else
    echo -e "${RED}❌ API健康检查失败 (HTTP $HEALTH_RESPONSE)${NC}"
    echo -e "${BLUE}尝试获取错误信息:${NC}"
    curl -v http://localhost:8080/api/v1/health 2>&1 | head -10
    echo -e "${BLUE}查看服务日志:${NC}"
    journalctl -u ${SERVICE_NAME} -n 10 --no-pager
    exit 1
fi

echo -e "${GREEN}部署完成！${NC}"