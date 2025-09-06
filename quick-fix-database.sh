#!/bin/bash

# 快速修复数据库问题
echo "快速修复数据库问题..."

# 1. 启动MySQL
echo "启动MySQL服务..."
sudo systemctl start mysql
sudo systemctl enable mysql

# 2. 等待MySQL启动
sleep 5

# 3. 创建数据库
echo "创建数据库..."
sudo mysql -u root -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. 导入数据库结构
echo "导入数据库结构..."
sudo mysql -u root mahjong_score < server/database.sql

# 5. 设置root密码
echo "设置MySQL root密码..."
sudo mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';"
sudo mysql -u root -e "FLUSH PRIVILEGES;"

# 6. 重启应用服务
echo "重启应用服务..."
sudo systemctl restart score-server

# 7. 测试
sleep 3
echo "测试API..."
curl -s http://localhost:8080/api/v1/health && echo "✅ 修复成功" || echo "❌ 修复失败"

echo "快速修复完成！"
