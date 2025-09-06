#!/bin/bash

# 修复MySQL服务问题
# 解决服务器重启后MySQL服务未启动的问题

echo "开始修复MySQL服务问题..."

# 检查MySQL服务状态
echo "1. 检查MySQL服务状态..."
systemctl status mysql

# 启动MySQL服务
echo "2. 启动MySQL服务..."
systemctl start mysql

# 等待MySQL启动
echo "3. 等待MySQL启动..."
sleep 5

# 检查MySQL服务状态
echo "4. 检查MySQL服务状态..."
systemctl status mysql

# 设置MySQL开机自启
echo "5. 设置MySQL开机自启..."
systemctl enable mysql

# 检查MySQL连接
echo "6. 检查MySQL连接..."
mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ MySQL连接成功"
else
    echo "❌ MySQL连接失败"
    echo "尝试重启MySQL服务..."
    systemctl restart mysql
    sleep 5
    mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ MySQL重启后连接成功"
    else
        echo "❌ MySQL仍然连接失败，请检查配置"
        exit 1
    fi
fi

# 重启Go应用服务
echo "7. 重启Go应用服务..."
systemctl restart score-server

# 等待服务启动
echo "8. 等待服务启动..."
sleep 3

# 检查Go应用服务状态
echo "9. 检查Go应用服务状态..."
systemctl status score-server

# 测试API
echo "10. 测试API..."
curl -s http://localhost:8080/api/v1/health
if [ $? -eq 0 ]; then
    echo "✅ API测试成功"
else
    echo "❌ API测试失败"
fi

echo "MySQL服务修复完成！"
