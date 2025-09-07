#!/bin/bash

# 测试配置文件读取脚本

echo "=== 配置文件读取测试 ==="

# 检查配置文件是否存在
if [ -f "../env.conf" ]; then
    echo "✅ env.conf文件存在"
    CONFIG_FILE="../env.conf"
elif [ -f "../server.env" ]; then
    echo "⚠️  server.env文件存在（建议重命名为env.conf）"
    CONFIG_FILE="../server.env"
else
    echo "❌ 配置文件不存在"
    exit 1
fi

echo "使用配置文件: $CONFIG_FILE"
echo ""

# 测试读取各个配置项
echo "🔍 测试配置项读取..."

test_config() {
    local var_name="$1"
    local value=$(grep "^${var_name}=" $CONFIG_FILE 2>/dev/null | cut -d'=' -f2- | tr -d ' ')
    if [ -n "$value" ]; then
        echo "   ✅ $var_name = $value"
    else
        echo "   ❌ $var_name (未找到或为空)"
    fi
}

echo "数据库配置:"
test_config "DB_HOST"
test_config "DB_PORT"
test_config "DB_USERNAME"
test_config "DB_PASSWORD"
test_config "DB_NAME"

echo ""
echo "服务配置:"
test_config "HTTP_PORT"
test_config "SERVICE_NAME"
test_config "SERVICE_USER"
test_config "SERVICE_WORK_DIR"

echo ""
echo "微信配置:"
test_config "WECHAT_APP_ID"
test_config "WECHAT_APP_SECRET"

echo ""
echo "COS配置:"
test_config "COS_BUCKET"
test_config "COS_REGION"
test_config "COS_SECRET_ID"
test_config "COS_SECRET_KEY"

echo ""
echo "日志配置:"
test_config "LOG_LEVEL"
test_config "LOG_DIR"

echo ""
echo "=== 测试完成 ==="
