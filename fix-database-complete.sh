#!/bin/bash

# 完整修复数据库问题
# 解决MySQL服务未启动和数据库不存在的问题

echo "开始完整修复数据库问题..."

# 1. 检查MySQL服务状态
echo "1. 检查MySQL服务状态..."
systemctl status mysql

# 2. 启动MySQL服务
echo "2. 启动MySQL服务..."
systemctl start mysql

# 等待MySQL启动
echo "3. 等待MySQL启动..."
sleep 10

# 3. 检查MySQL服务状态
echo "4. 检查MySQL服务状态..."
systemctl status mysql

# 4. 设置MySQL开机自启
echo "5. 设置MySQL开机自启..."
systemctl enable mysql

# 5. 检查MySQL连接
echo "6. 检查MySQL连接..."
mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ MySQL连接成功"
else
    echo "❌ MySQL连接失败，尝试使用sudo..."
    sudo mysql -u root -e "SELECT 1;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ MySQL连接成功（使用sudo）"
        # 设置root密码
        echo "7. 设置MySQL root密码..."
        sudo mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';"
        sudo mysql -u root -e "FLUSH PRIVILEGES;"
    else
        echo "❌ MySQL仍然连接失败，请检查MySQL安装"
        exit 1
    fi
fi

# 6. 创建数据库
echo "8. 创建数据库..."
mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 数据库创建成功"
else
    echo "❌ 数据库创建失败，尝试使用sudo..."
    sudo mysql -u root -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if [ $? -eq 0 ]; then
        echo "✅ 数据库创建成功（使用sudo）"
    else
        echo "❌ 数据库创建失败"
        exit 1
    fi
fi

# 7. 导入数据库结构
echo "9. 导入数据库结构..."
if [ -f "server/database.sql" ]; then
    mysql -u root -p123456 mahjong_score < server/database.sql 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ 数据库结构导入成功"
    else
        echo "❌ 数据库结构导入失败，尝试使用sudo..."
        sudo mysql -u root mahjong_score < server/database.sql
        if [ $? -eq 0 ]; then
            echo "✅ 数据库结构导入成功（使用sudo）"
        else
            echo "❌ 数据库结构导入失败"
            exit 1
        fi
    fi
else
    echo "❌ 找不到database.sql文件"
    exit 1
fi

# 8. 验证数据库
echo "10. 验证数据库..."
mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 数据库验证成功"
    mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;"
else
    echo "❌ 数据库验证失败"
    exit 1
fi

# 9. 重启Go应用服务
echo "11. 重启Go应用服务..."
systemctl restart score-server

# 等待服务启动
echo "12. 等待服务启动..."
sleep 5

# 10. 检查Go应用服务状态
echo "13. 检查Go应用服务状态..."
systemctl status score-server

# 11. 测试API
echo "14. 测试API..."
curl -s http://localhost:8080/api/v1/health
if [ $? -eq 0 ]; then
    echo "✅ API测试成功"
else
    echo "❌ API测试失败"
    echo "查看服务日志..."
    journalctl -u score-server --no-pager -n 20
fi

echo "数据库修复完成！"
