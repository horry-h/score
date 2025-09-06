#!/bin/bash

# 修复MySQL root用户访问问题
echo "修复MySQL root用户访问问题..."

# 1. 启动MySQL服务
echo "1. 启动MySQL服务..."
sudo systemctl start mysql
sudo systemctl enable mysql
sleep 3

# 2. 尝试不同的root用户连接方式
echo "2. 尝试连接MySQL..."

# 方法1: 尝试无密码连接
echo "尝试无密码连接..."
sudo mysql -u root 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 无密码连接成功"
    MYSQL_CMD="sudo mysql -u root"
elif sudo mysql -u root -p123456 2>/dev/null; then
    echo "✅ 密码123456连接成功"
    MYSQL_CMD="sudo mysql -u root -p123456"
elif sudo mysql -u root -p 2>/dev/null; then
    echo "✅ 需要输入密码"
    MYSQL_CMD="sudo mysql -u root -p"
else
    echo "❌ 无法连接，尝试重置root密码..."
    
    # 方法2: 重置root密码
    echo "3. 重置MySQL root密码..."
    
    # 停止MySQL服务
    sudo systemctl stop mysql
    
    # 创建临时SQL文件
    cat > /tmp/mysql-init.sql << EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';
FLUSH PRIVILEGES;
EOF
    
    # 以安全模式启动MySQL
    sudo mysqld_safe --init-file=/tmp/mysql-init.sql --skip-grant-tables --skip-networking &
    MYSQL_PID=$!
    
    # 等待MySQL启动
    sleep 10
    
    # 停止安全模式MySQL
    sudo kill $MYSQL_PID
    sleep 3
    
    # 启动正常MySQL服务
    sudo systemctl start mysql
    sleep 5
    
    # 清理临时文件
    rm -f /tmp/mysql-init.sql
    
    # 测试新密码
    mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ 密码重置成功"
        MYSQL_CMD="mysql -u root -p123456"
    else
        echo "❌ 密码重置失败，尝试其他方法..."
        
        # 方法3: 使用mysql_secure_installation的方式
        echo "4. 使用mysql_secure_installation方式..."
        
        # 停止MySQL
        sudo systemctl stop mysql
        
        # 跳过权限表启动
        sudo mysqld_safe --skip-grant-tables --skip-networking &
        MYSQL_PID=$!
        sleep 5
        
        # 重置密码
        mysql -u root << EOF
USE mysql;
UPDATE user SET authentication_string=PASSWORD('123456') WHERE User='root' AND Host='localhost';
FLUSH PRIVILEGES;
EOF
        
        # 停止安全模式
        sudo kill $MYSQL_PID
        sleep 3
        
        # 启动正常服务
        sudo systemctl start mysql
        sleep 5
        
        # 测试连接
        mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "✅ 密码重置成功（方法3）"
            MYSQL_CMD="mysql -u root -p123456"
        else
            echo "❌ 所有方法都失败了"
            echo "请手动检查MySQL配置"
            exit 1
        fi
    fi
fi

# 3. 创建数据库
echo "5. 创建数据库..."
$MYSQL_CMD << EOF
CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF

# 4. 导入数据库结构
echo "6. 导入数据库结构..."
$MYSQL_CMD mahjong_score < server/database.sql

# 5. 验证数据库
echo "7. 验证数据库..."
$MYSQL_CMD -e "USE mahjong_score; SHOW TABLES;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 数据库验证成功"
    $MYSQL_CMD -e "USE mahjong_score; SHOW TABLES;"
else
    echo "❌ 数据库验证失败"
    exit 1
fi

# 6. 重启应用服务
echo "8. 重启应用服务..."
sudo systemctl restart score-server
sleep 5

# 7. 测试API
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
