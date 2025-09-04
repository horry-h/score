#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  环境配置修复脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 检查当前目录
echo -e "\n${YELLOW}--- 1. 检查当前目录 ---${NC}"
echo -e "${BLUE}当前目录: $(pwd)${NC}"
ls -la

# 2. 检查.env文件
echo -e "\n${YELLOW}--- 2. 检查.env文件 ---${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}.env文件存在${NC}"
    echo -e "${BLUE}当前.env文件内容:${NC}"
    cat .env
else
    echo -e "${RED}.env文件不存在${NC}"
fi

# 3. 备份现有配置
echo -e "\n${YELLOW}--- 3. 备份现有配置 ---${NC}"
if [ -f ".env" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}已备份现有配置${NC}"
fi

# 4. 创建正确的.env文件
echo -e "\n${YELLOW}--- 4. 创建正确的配置 ---${NC}"
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

echo -e "${GREEN}新的.env文件已创建${NC}"

# 5. 验证配置
echo -e "\n${YELLOW}--- 5. 验证配置 ---${NC}"
echo -e "${BLUE}新的.env文件内容:${NC}"
cat .env

# 6. 检查文件权限
echo -e "\n${YELLOW}--- 6. 检查文件权限 ---${NC}"
ls -la .env

# 7. 测试数据库连接
echo -e "\n${YELLOW}--- 7. 测试数据库连接 ---${NC}"
if mysql -u root -p123456 -e "SELECT 1;" mahjong_score &> /dev/null; then
    echo -e "${GREEN}数据库连接测试成功${NC}"
else
    echo -e "${RED}数据库连接测试失败${NC}"
    echo -e "${BLUE}尝试设置MySQL root密码...${NC}"
    
    # 设置root密码
    sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';" 2>/dev/null || true
    sudo mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
    
    # 再次测试
    if mysql -u root -p123456 -e "SELECT 1;" mahjong_score &> /dev/null; then
        echo -e "${GREEN}数据库连接修复成功${NC}"
    else
        echo -e "${RED}数据库连接仍然失败${NC}"
        echo -e "${BLUE}尝试创建数据库...${NC}"
        mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
    fi
fi

# 8. 检查systemd服务配置
echo -e "\n${YELLOW}--- 8. 检查systemd服务配置 ---${NC}"
if [ -f "/etc/systemd/system/score-server.service" ]; then
    echo -e "${GREEN}systemd服务文件存在${NC}"
    echo -e "${BLUE}服务配置:${NC}"
    cat /etc/systemd/system/score-server.service
else
    echo -e "${RED}systemd服务文件不存在${NC}"
fi

# 9. 重启服务
echo -e "\n${YELLOW}--- 9. 重启服务 ---${NC}"
systemctl daemon-reload
systemctl restart score-server
sleep 3

if systemctl is-active --quiet score-server; then
    echo -e "${GREEN}服务重启成功${NC}"
else
    echo -e "${RED}服务重启失败${NC}"
    echo -e "${BLUE}查看错误日志:${NC}"
    journalctl -u score-server -n 10 --no-pager
fi

# 10. 测试API
echo -e "\n${YELLOW}--- 10. 测试API ---${NC}"
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
echo -e "${GREEN}  环境配置修复完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}如果问题仍然存在，请运行:${NC}"
echo -e "./troubleshoot.sh"
