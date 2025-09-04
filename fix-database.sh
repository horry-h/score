#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置
DB_NAME="mahjong_score"
DB_USER="root"
DB_PASS="123456"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  数据库修复脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 检查MySQL服务状态
echo -e "\n${YELLOW}--- 1. 检查MySQL服务 ---${NC}"
if systemctl is-active --quiet mysql; then
    echo -e "${GREEN}MySQL服务正在运行${NC}"
else
    echo -e "${RED}MySQL服务未运行，启动服务...${NC}"
    systemctl start mysql
    systemctl enable mysql
fi

# 2. 测试root用户连接
echo -e "\n${YELLOW}--- 2. 测试MySQL连接 ---${NC}"
if sudo mysql -e "SELECT 1;" &> /dev/null; then
    echo -e "${GREEN}MySQL root用户连接正常${NC}"
else
    echo -e "${RED}MySQL root用户连接失败${NC}"
    exit 1
fi

# 3. 创建数据库
echo -e "\n${YELLOW}--- 3. 创建数据库 ---${NC}"
sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}数据库 ${DB_NAME} 创建成功${NC}"
else
    echo -e "${YELLOW}数据库可能已存在${NC}"
fi

# 4. 设置root用户密码
echo -e "\n${YELLOW}--- 4. 设置root用户密码 ---${NC}"
echo -e "${BLUE}设置MySQL root用户密码为 123456...${NC}"
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASS}';" 2>/dev/null || true
sudo mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
echo -e "${GREEN}root用户密码设置完成${NC}"

# 5. 测试用户连接
echo -e "\n${YELLOW}--- 5. 测试用户连接 ---${NC}"
if mysql -u ${DB_USER} -p${DB_PASS} -e "SELECT 1;" ${DB_NAME} &> /dev/null; then
    echo -e "${GREEN}用户连接测试成功${NC}"
else
    echo -e "${RED}用户连接测试失败${NC}"
    echo -e "${BLUE}尝试手动测试:${NC}"
    echo -e "mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME}"
    exit 1
fi

# 6. 初始化数据库表
echo -e "\n${YELLOW}--- 6. 初始化数据库表 ---${NC}"
if [ -f "server/database.sql" ]; then
    TABLE_COUNT=$(mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "SHOW TABLES;" 2>/dev/null | wc -l)
    if [ "$TABLE_COUNT" -le 1 ]; then
        echo -e "${BLUE}创建数据库表...${NC}"
        mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} < server/database.sql
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}数据库表创建成功${NC}"
        else
            echo -e "${RED}数据库表创建失败${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}数据库表已存在，跳过创建${NC}"
    fi
else
    echo -e "${YELLOW}未找到 database.sql 文件${NC}"
fi

# 7. 验证数据库
echo -e "\n${YELLOW}--- 7. 验证数据库 ---${NC}"
echo -e "${BLUE}数据库表列表:${NC}"
mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "SHOW TABLES;" 2>/dev/null

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  数据库修复完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}现在可以重启服务:${NC}"
echo -e "systemctl restart score-server"
echo -e "systemctl status score-server"
