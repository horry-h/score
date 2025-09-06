#!/bin/bash

# 数据库修复脚本 - 添加缺失的user_sessions表

echo "🔧 修复数据库 - 添加缺失的user_sessions表..."

# 检查MySQL服务是否运行
if ! systemctl is-active --quiet mysql; then
    echo "启动MySQL服务..."
    systemctl start mysql
    sleep 3
fi

# 执行SQL脚本添加缺失的表
echo "执行数据库迁移..."
mysql -u root -p123456 < /root/horry/score/server/add_user_sessions_table.sql

if [ $? -eq 0 ]; then
    echo "✅ 数据库修复成功！user_sessions表已创建"
else
    echo "❌ 数据库修复失败，请检查MySQL连接和权限"
    exit 1
fi

echo "🎉 数据库修复完成！现在可以正常使用自动登录功能了"
