#!/bin/bash

# 简单MySQL修复脚本 - 处理无密码root用户
echo "简单MySQL修复脚本..."

# 1. 启动MySQL
echo "启动MySQL服务..."
sudo systemctl start mysql
sudo systemctl enable mysql
sleep 3

# 2. 使用无密码root用户创建数据库
echo "创建数据库..."
sudo mysql -u root << EOF
CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF

# 3. 导入数据库结构
echo "导入数据库结构..."
sudo mysql -u root mahjong_score < server/database.sql

# 4. 设置root密码
echo "设置root密码..."
sudo mysql -u root << EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';
FLUSH PRIVILEGES;
EOF

# 5. 验证设置
echo "验证设置..."
mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 密码设置成功"
else
    echo "❌ 密码设置失败，使用备用方法..."
    sudo mysql -u root << EOF
UPDATE mysql.user SET authentication_string=PASSWORD('123456') WHERE User='root' AND Host='localhost';
FLUSH PRIVILEGES;
EOF
fi

# 6. 验证数据库
echo "验证数据库..."
mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 数据库验证成功"
else
    echo "❌ 数据库验证失败"
    exit 1
fi

# 7. 重启应用
echo "重启应用服务..."
sudo systemctl restart score-server
sleep 3

# 8. 测试
echo "测试API..."
curl -s http://localhost:8080/api/v1/health && echo "✅ 修复成功" || echo "❌ 修复失败"

echo "修复完成！"
