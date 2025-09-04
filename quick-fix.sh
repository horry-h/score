#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置
SERVICE_NAME="score-server"
DB_NAME="mahjong_score"
DB_USER="root"
DB_PASS="123456"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  快速修复脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 检查服务状态
echo -e "\n${YELLOW}--- 1. 检查服务状态 ---${NC}"
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}服务正在运行${NC}"
    systemctl status ${SERVICE_NAME} --no-pager
else
    echo -e "${RED}服务未运行${NC}"
    echo -e "${BLUE}查看服务状态:${NC}"
    systemctl status ${SERVICE_NAME} --no-pager
fi

# 2. 检查端口监听
echo -e "\n${YELLOW}--- 2. 检查端口监听 ---${NC}"
if ss -tuln | grep ":8080" &> /dev/null; then
    echo -e "${GREEN}端口8080正在监听${NC}"
    ss -tuln | grep ":8080"
else
    echo -e "${RED}端口8080未监听${NC}"
fi

# 3. 检查可执行文件
echo -e "\n${YELLOW}--- 3. 检查可执行文件 ---${NC}"
if [ -f "server/mahjong-server" ]; then
    echo -e "${GREEN}可执行文件存在${NC}"
    ls -la server/mahjong-server
    
    # 检查文件架构
    echo -e "${BLUE}检查文件架构...${NC}"
    FILE_INFO=$(file server/mahjong-server)
    echo -e "${BLUE}文件信息: ${FILE_INFO}${NC}"
    
    # 检查是否是Linux可执行文件
    if echo "$FILE_INFO" | grep -q "Linux"; then
        echo -e "${GREEN}可执行文件架构正确 (Linux)${NC}"
    else
        echo -e "${RED}可执行文件架构不匹配，需要重新构建${NC}"
        echo -e "${BLUE}重新构建应用...${NC}"
        cd server
        rm -f mahjong-server
        export PATH=$PATH:/usr/local/go/bin
        go mod tidy
        if go build -o mahjong-server main.go; then
            echo -e "${GREEN}重新构建成功${NC}"
            ls -la mahjong-server
        else
            echo -e "${RED}重新构建失败${NC}"
            exit 1
        fi
        cd ..
    fi
else
    echo -e "${RED}可执行文件不存在${NC}"
    echo -e "${BLUE}尝试构建...${NC}"
    cd server
    export PATH=$PATH:/usr/local/go/bin
    go mod tidy
    if go build -o mahjong-server main.go; then
        echo -e "${GREEN}构建成功${NC}"
        ls -la mahjong-server
    else
        echo -e "${RED}构建失败${NC}"
        exit 1
    fi
    cd ..
fi

# 4. 检查数据库连接
echo -e "\n${YELLOW}--- 4. 检查数据库连接 ---${NC}"
if mysql -u ${DB_USER} -p${DB_PASS} -e "SELECT 1;" ${DB_NAME} &> /dev/null; then
    echo -e "${GREEN}数据库连接正常${NC}"
else
    echo -e "${RED}数据库连接失败${NC}"
    echo -e "${BLUE}尝试修复数据库...${NC}"
    
    # 创建数据库和用户
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
    sudo mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || true
    sudo mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';" 2>/dev/null || true
    sudo mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
    
    # 测试连接
    if mysql -u ${DB_USER} -p${DB_PASS} -e "SELECT 1;" ${DB_NAME} &> /dev/null; then
        echo -e "${GREEN}数据库修复成功${NC}"
    else
        echo -e "${RED}数据库修复失败${NC}"
        exit 1
    fi
fi

# 5. 检查数据库表
echo -e "\n${YELLOW}--- 5. 检查数据库表 ---${NC}"
TABLE_COUNT=$(mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "SHOW TABLES;" 2>/dev/null | wc -l)
if [ "$TABLE_COUNT" -le 1 ]; then
    echo -e "${YELLOW}数据库表不存在，创建表结构...${NC}"
    if [ -f "server/database.sql" ]; then
        mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} < server/database.sql
        echo -e "${GREEN}数据库表创建完成${NC}"
    else
        echo -e "${RED}未找到 database.sql 文件${NC}"
    fi
else
    echo -e "${GREEN}数据库表已存在${NC}"
fi

# 6. 重启服务
echo -e "\n${YELLOW}--- 6. 重启服务 ---${NC}"
systemctl restart ${SERVICE_NAME}
sleep 3

if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo -e "${GREEN}服务重启成功${NC}"
else
    echo -e "${RED}服务重启失败${NC}"
    echo -e "${BLUE}查看错误日志:${NC}"
    journalctl -u ${SERVICE_NAME} -n 20 --no-pager
    exit 1
fi

# 7. 测试API
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
    echo -e "${BLUE}查看服务日志:${NC}"
    journalctl -u ${SERVICE_NAME} -n 10 --no-pager
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  快速修复完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}如果问题仍然存在，请运行:${NC}"
echo -e "./troubleshoot.sh"
