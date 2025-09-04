#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MySQL Root密码设置脚本${NC}"
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

# 2. 设置root用户密码
echo -e "\n${YELLOW}--- 2. 设置root用户密码 ---${NC}"
echo -e "${BLUE}设置MySQL root用户密码为 123456...${NC}"

# 使用sudo mysql连接，设置root密码
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';" 2>/dev/null || true
sudo mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true

echo -e "${GREEN}root用户密码设置完成${NC}"

# 3. 测试连接
echo -e "\n${YELLOW}--- 3. 测试连接 ---${NC}"
if mysql -u root -p123456 -e "SELECT 1;" &> /dev/null; then
    echo -e "${GREEN}✅ root用户连接测试成功${NC}"
else
    echo -e "${RED}❌ root用户连接测试失败${NC}"
    echo -e "${BLUE}尝试手动测试:${NC}"
    echo -e "mysql -u root -p123456"
    exit 1
fi

# 4. 创建数据库
echo -e "\n${YELLOW}--- 4. 创建数据库 ---${NC}"
mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
echo -e "${GREEN}数据库 mahjong_score 创建完成${NC}"

# 5. 验证数据库
echo -e "\n${YELLOW}--- 5. 验证数据库 ---${NC}"
mysql -u root -p123456 -e "SHOW DATABASES;" 2>/dev/null | grep mahjong_score
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库验证成功${NC}"
else
    echo -e "${RED}❌ 数据库验证失败${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  MySQL Root密码设置完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}现在可以使用以下命令连接数据库:${NC}"
echo -e "mysql -u root -p123456"
echo -e "mysql -u root -p123456 mahjong_score"
