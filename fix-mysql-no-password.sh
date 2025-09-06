#!/bin/bash

# 修复MySQL无密码root用户问题
echo "修复MySQL无密码root用户问题..."

# 1. 启动MySQL服务
echo "1. 启动MySQL服务..."
sudo systemctl start mysql
sudo systemctl enable mysql

# 等待MySQL启动
sleep 5

# 2. 检查MySQL连接（无密码）
echo "2. 检查MySQL连接（无密码）..."
sudo mysql -u root -e "SELECT 1;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ MySQL连接成功（无密码）"
    
    # 3. 创建数据库
    echo "3. 创建数据库..."
    sudo mysql -u root -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    # 4. 导入数据库结构
    echo "4. 导入数据库结构..."
    sudo mysql -u root mahjong_score < server/database.sql
    
    # 5. 设置root密码为123456
    echo "5. 设置MySQL root密码为123456..."
    sudo mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';"
    sudo mysql -u root -e "FLUSH PRIVILEGES;"
    
    # 6. 验证密码设置
    echo "6. 验证密码设置..."
    mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ 密码设置成功"
    else
        echo "❌ 密码设置失败，尝试重新设置..."
        sudo mysql -u root -e "UPDATE mysql.user SET authentication_string=PASSWORD('123456') WHERE User='root' AND Host='localhost';"
        sudo mysql -u root -e "FLUSH PRIVILEGES;"
    fi
    
else
    echo "❌ MySQL连接失败，尝试其他方法..."
    
    # 尝试使用mysql_secure_installation的方式
    echo "尝试重置MySQL root密码..."
    sudo systemctl stop mysql
    sudo mysqld_safe --skip-grant-tables --skip-networking &
    sleep 5
    
    # 重置密码
    sudo mysql -u root -e "USE mysql; UPDATE user SET authentication_string=PASSWORD('123456') WHERE User='root' AND Host='localhost'; FLUSH PRIVILEGES;"
    
    # 重启MySQL
    sudo pkill mysqld
    sudo systemctl start mysql
    sleep 5
    
    # 再次尝试连接
    mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ 密码重置成功"
        
        # 创建数据库
        echo "创建数据库..."
        mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        
        # 导入数据库结构
        echo "导入数据库结构..."
        mysql -u root -p123456 mahjong_score < server/database.sql
    else
        echo "❌ 密码重置失败"
        exit 1
    fi
fi

# 7. 验证数据库
echo "7. 验证数据库..."
mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 数据库验证成功"
    mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;"
else
    echo "❌ 数据库验证失败"
    exit 1
fi

# 8. 重启应用服务
echo "8. 重启应用服务..."
sudo systemctl restart score-server

# 等待服务启动
sleep 5

# 9. 测试API
echo "9. 测试API..."
curl -s http://localhost:8080/api/v1/health
if [ $? -eq 0 ]; then
    echo "✅ API测试成功"
else
    echo "❌ API测试失败"
    echo "查看服务日志..."
    sudo journalctl -u score-server --no-pager -n 10
fi

echo "MySQL修复完成！"
