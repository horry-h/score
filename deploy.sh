#!/bin/bash

# 麻将记分服务一键部署脚本
# 自动安装所有依赖并启动服务

set -e

echo "=== 麻将记分服务一键部署 ==="

# 检查是否以root权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 1. 更新系统包
echo "1. 更新系统包..."
apt update -y

# 2. 安装Go环境
echo "2. 安装Go环境..."
if ! command -v go &> /dev/null; then
    echo "安装Go 1.21..."
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
    export PATH=$PATH:/usr/local/go/bin
    rm go1.21.5.linux-amd64.tar.gz
    echo "✅ Go安装完成"
else
    GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
    echo "✅ Go已安装，版本: $GO_VERSION"
fi

# 3. 安装MySQL
echo "3. 安装MySQL..."
if ! command -v mysql &> /dev/null; then
    echo "安装MySQL..."
    apt install -y mysql-server
    systemctl start mysql
    systemctl enable mysql
    
    # 配置MySQL root密码
    mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';"
    mysql -e "FLUSH PRIVILEGES;"
    echo "✅ MySQL安装完成"
else
    echo "✅ MySQL已安装"
fi

# 4. 安装Nginx
echo "4. 安装Nginx..."
if ! command -v nginx &> /dev/null; then
    echo "安装Nginx..."
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
    echo "✅ Nginx安装完成"
else
    echo "✅ Nginx已安装"
fi

# 5. 安装其他依赖
echo "5. 安装其他依赖..."
apt install -y curl wget net-tools

# 6. 配置MySQL数据持久化
echo "6. 配置MySQL数据持久化..."
cat >> /etc/mysql/mysql.conf.d/mysqld.cnf << 'EOF'

# 数据持久化配置
[mysqld]
innodb_flush_log_at_trx_commit = 1
innodb_flush_method = O_DIRECT
sync_binlog = 1
innodb_file_per_table = 1
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
default-time-zone = '+8:00'
EOF

systemctl restart mysql
echo "✅ MySQL配置完成"

# 7. 创建数据库
echo "7. 创建数据库..."
mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS mahjong_score DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || {
    echo "❌ 数据库创建失败，请检查MySQL配置"
    exit 1
}
mysql -u root -p123456 mahjong_score < server/database.sql
echo "✅ 数据库创建完成"

# 8. 配置Nginx
echo "8. 配置Nginx..."
cat > /etc/nginx/sites-available/aipaint.cloud << 'EOF'
server {
    listen 80;
    server_name www.aipaint.cloud aipaint.cloud;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.aipaint.cloud aipaint.cloud;

    # SSL证书配置（需要手动上传证书文件）
    ssl_certificate /etc/ssl/certs/aipaint.cloud.crt;
    ssl_certificate_key /etc/ssl/private/aipaint.cloud.key;
    
    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 反向代理到Go服务
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/aipaint.cloud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✅ Nginx配置完成"

# 9. 构建Go应用
echo "9. 构建Go应用..."
cd server
go mod tidy
go build -o mahjong-server .
cp mahjong-server /usr/local/bin/
chmod +x /usr/local/bin/mahjong-server
echo "✅ Go应用构建完成"

# 10. 配置systemd服务
echo "10. 配置systemd服务..."
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

# 11. 启动服务
echo "11. 启动服务..."
systemctl start mahjong-server
sleep 3

if systemctl is-active --quiet mahjong-server; then
    echo "✅ 服务启动成功"
else
    echo "❌ 服务启动失败"
    systemctl status mahjong-server --no-pager
    exit 1
fi

# 12. 测试服务
echo "12. 测试服务..."
sleep 2
if curl -s http://127.0.0.1:8080/health > /dev/null; then
    echo "✅ 服务健康检查通过"
else
    echo "⚠️  服务健康检查失败，但服务可能仍在启动中"
fi

echo ""
echo "=== 部署完成 ==="
echo "✅ 麻将记分服务部署成功"
echo "📊 服务地址: https://www.aipaint.cloud"
echo "📝 日志目录: /root/horry/score/server/logs"
echo ""
echo "⚠️  注意: 需要手动配置SSL证书文件:"
echo "   - 证书文件: /etc/ssl/certs/aipaint.cloud.crt"
echo "   - 私钥文件: /etc/ssl/private/aipaint.cloud.key"
echo ""
echo "🔧 管理命令:"
echo "   - 重启服务: ./restart.sh"
echo "   - 停止服务: ./stop.sh"
echo "   - 查看日志: tail -f /root/horry/score/server/logs/log_*.log"