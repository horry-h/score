#!/bin/bash

# 麻将记分服务启动脚本
# 检查所有依赖项并启动服务

set -e

echo "=== 麻将记分服务启动 ==="

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 1. 检查Go环境
echo "1. 检查Go环境..."
if ! command -v go &> /dev/null; then
    echo "❌ Go未安装，请先安装Go 1.21+"
    exit 1
fi

GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
echo "✅ Go版本: $GO_VERSION"

# 2. 检查MySQL服务
echo "2. 检查MySQL服务..."
if ! systemctl is-active --quiet mysql; then
    echo "❌ MySQL服务未运行，正在启动..."
    systemctl start mysql
    sleep 3
    if ! systemctl is-active --quiet mysql; then
        echo "❌ MySQL启动失败"
        exit 1
    fi
fi
echo "✅ MySQL服务运行正常"

# 3. 检查数据库连接
echo "3. 检查数据库连接..."
if ! mysql -u root -p123456 -e "SELECT 1;" &> /dev/null; then
    echo "❌ 数据库连接失败，请检查MySQL配置"
    exit 1
fi
echo "✅ 数据库连接正常"

# 4. 检查数据库是否存在
echo "4. 检查数据库..."
if ! mysql -u root -p123456 -e "USE mahjong_score;" &> /dev/null; then
    echo "❌ 数据库mahjong_score不存在，正在创建..."
    mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS mahjong_score DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -u root -p123456 mahjong_score < server/database.sql
    echo "✅ 数据库创建完成"
else
    echo "✅ 数据库存在"
fi

# 5. 检查Nginx服务
echo "5. 检查Nginx服务..."
if ! systemctl is-active --quiet nginx; then
    echo "❌ Nginx服务未运行，正在启动..."
    systemctl start nginx
    sleep 2
    if ! systemctl is-active --quiet nginx; then
        echo "❌ Nginx启动失败"
        exit 1
    fi
fi
echo "✅ Nginx服务运行正常"

# 6. 检查端口占用
echo "6. 检查端口占用..."
if netstat -tlnp | grep -q ":8080 "; then
    echo "⚠️  端口8080已被占用，正在停止现有服务..."
    systemctl stop mahjong-server || true
    pkill -f mahjong-server || true
    sleep 2
fi

# 7. 构建Go应用
echo "7. 构建Go应用..."
cd server
if [ ! -f "go.mod" ]; then
    echo "❌ 未找到go.mod文件"
    exit 1
fi

go mod tidy
go build -o mahjong-server .
if [ $? -ne 0 ]; then
    echo "❌ Go应用构建失败"
    exit 1
fi
echo "✅ Go应用构建成功"

# 8. 安装Go应用
echo "8. 安装Go应用..."
cp mahjong-server /usr/local/bin/
chmod +x /usr/local/bin/mahjong-server
echo "✅ Go应用安装完成"

# 9. 配置systemd服务
echo "9. 配置systemd服务..."
cat > /etc/systemd/system/mahjong-server.service << 'EOF'
[Unit]
Description=Mahjong Score Server
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/horry/score/server
ExecStart=/usr/local/bin/mahjong-server
Restart=always
RestartSec=5
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mahjong-server
echo "✅ systemd服务配置完成"

# 10. 启动Go服务
echo "10. 启动Go服务..."
systemctl start mahjong-server
sleep 3

if systemctl is-active --quiet mahjong-server; then
    echo "✅ Go服务启动成功"
else
    echo "❌ Go服务启动失败"
    systemctl status mahjong-server --no-pager
    exit 1
fi

# 11. 测试服务
echo "11. 测试服务..."
sleep 2
if curl -s http://127.0.0.1:8080/health > /dev/null; then
    echo "✅ 服务健康检查通过"
else
    echo "⚠️  服务健康检查失败，但服务可能仍在启动中"
fi

# 12. 显示服务状态
echo ""
echo "=== 服务状态 ==="
systemctl status mahjong-server --no-pager -l

echo ""
echo "=== 启动完成 ==="
echo "✅ 麻将记分服务已成功启动"
echo "📊 服务地址: https://www.aipaint.cloud"
echo "📝 日志目录: /root/horry/score/server/logs"
echo "🔧 管理命令:"
echo "   - 查看日志: ./view-logs.sh"
echo "   - 重启服务: ./restart.sh"
echo "   - 停止服务: ./stop.sh"
