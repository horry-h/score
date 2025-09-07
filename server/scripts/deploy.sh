#!/bin/bash

# 麻将记分服务一键部署脚本
# 自动安装所有依赖并启动服务

set -e

echo "=== 麻将记分服务一键部署 ==="

# 检查是否以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "请以root权限运行此脚本"
    exit 1
fi

# 检查配置文件
echo "🔍 检查配置文件..."
if [ ! -f "../server.env" ]; then
    echo "❌ server.env文件不存在"
    echo "   请创建server.env文件并配置所有必需的参数"
    echo "   文件位置: server/server.env"
    exit 1
fi

# 检查必需的环境变量
echo "检查必需配置项..."
MISSING_COUNT=0

check_required_var() {
    local var_name="$1"
    if ! grep -q "^${var_name}=" ../server.env; then
        echo "   - $var_name (缺失)"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    elif [ -z "$(grep "^${var_name}=" ../server.env | cut -d'=' -f2)" ]; then
        echo "   - $var_name (为空)"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    else
        echo "   ✅ $var_name"
    fi
}

echo "检查微信配置..."
check_required_var "WECHAT_APP_ID"
check_required_var "WECHAT_APP_SECRET"

echo "检查COS配置..."
check_required_var "COS_BUCKET"
check_required_var "COS_REGION"
check_required_var "COS_SECRET_ID"
check_required_var "COS_SECRET_KEY"

if [ $MISSING_COUNT -gt 0 ]; then
    echo ""
    echo "❌ 发现 $MISSING_COUNT 个必需配置项缺失或为空"
    echo "请在server/server.env文件中设置这些配置项"
    exit 1
fi

echo "✅ 配置文件检查通过"

# 预检查已安装的组件
echo "🔍 预检查已安装的组件..."
EXISTING_COMPONENTS=""
if command -v go &> /dev/null; then
    EXISTING_COMPONENTS="$EXISTING_COMPONENTS Go"
fi
if command -v mysql &> /dev/null; then
    EXISTING_COMPONENTS="$EXISTING_COMPONENTS MySQL"
fi
if command -v nginx &> /dev/null; then
    EXISTING_COMPONENTS="$EXISTING_COMPONENTS Nginx"
fi

if [ -n "$EXISTING_COMPONENTS" ]; then
    echo "✅ 已安装的组件:$EXISTING_COMPONENTS"
    echo "   将跳过已安装组件的重复安装"
else
    echo "ℹ️  未检测到已安装的组件，将进行全新安装"
fi
echo ""

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
    # 确保MySQL服务正在运行
    if ! systemctl is-active --quiet mysql; then
        echo "启动MySQL服务..."
        systemctl start mysql
    fi
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
    # 确保Nginx服务正在运行
    if ! systemctl is-active --quiet nginx; then
        echo "启动Nginx服务..."
        systemctl start nginx
    fi
fi

# 5. 安装其他依赖
echo "5. 安装其他依赖..."
apt install -y curl wget net-tools

# 6. 配置MySQL数据持久化
echo "6. 配置MySQL数据持久化..."
if ! grep -q "innodb_flush_log_at_trx_commit" /etc/mysql/mysql.conf.d/mysqld.cnf; then
    echo "添加MySQL数据持久化配置..."
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
else
    echo "✅ MySQL配置已存在，跳过配置"
fi

# 7. 创建数据库
echo "7. 创建数据库..."
# 从环境变量文件读取数据库配置（注意：此时在server目录下）
DB_PASSWORD=$(grep "^DB_PASSWORD=" server.env 2>/dev/null | cut -d'=' -f2 || echo "123456")
DB_NAME=$(grep "^DB_NAME=" server.env 2>/dev/null | cut -d'=' -f2 || echo "mahjong_score")

mysql -u root -p$DB_PASSWORD -e "CREATE DATABASE IF NOT EXISTS $DB_NAME DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || {
    echo "❌ 数据库创建失败，请检查MySQL配置"
    exit 1
}

# 检查数据库是否已有表
TABLE_COUNT=$(mysql -u root -p$DB_PASSWORD -D $DB_NAME -e "SHOW TABLES;" 2>/dev/null | wc -l)
if [ "$TABLE_COUNT" -gt 0 ]; then
    echo "✅ 数据库已存在表结构，跳过表创建以避免数据丢失"
    echo "   现有表数量: $((TABLE_COUNT - 1))"
else
    echo "创建数据库表结构..."
    mysql -u root -p$DB_PASSWORD $DB_NAME < server/database.sql
    echo "✅ 数据库表结构创建完成"
fi

# 8. 配置Nginx
echo "8. 配置Nginx..."
if [ ! -f "/etc/nginx/sites-available/aipaint.cloud" ]; then
    echo "创建Nginx配置文件..."
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
    echo "✅ Nginx配置文件创建完成"
else
    echo "✅ Nginx配置文件已存在，跳过创建"
fi

# 启用站点配置
if [ ! -L "/etc/nginx/sites-enabled/aipaint.cloud" ]; then
    echo "启用Nginx站点配置..."
    ln -sf /etc/nginx/sites-available/aipaint.cloud /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    echo "✅ Nginx站点配置已启用"
else
    echo "✅ Nginx站点配置已启用"
    # 测试配置并重载
    nginx -t && systemctl reload nginx
fi

# 9. 构建Go应用
echo "9. 构建Go应用..."
cd ..
go mod tidy
go build -o mahjong-server .
cp mahjong-server /usr/local/bin/
chmod +x /usr/local/bin/mahjong-server
echo "✅ Go应用构建完成"

# 10. 配置systemd服务
echo "10. 配置systemd服务..."
if [ ! -f "/etc/systemd/system/mahjong-server.service" ]; then
    echo "创建systemd服务配置..."
    # 从环境变量文件读取服务配置（注意：此时在server目录下）
    SERVICE_NAME=$(grep "^SERVICE_NAME=" server.env 2>/dev/null | cut -d'=' -f2 || echo "mahjong-server")
    SERVICE_USER=$(grep "^SERVICE_USER=" server.env 2>/dev/null | cut -d'=' -f2 || echo "root")
    SERVICE_WORK_DIR=$(grep "^SERVICE_WORK_DIR=" server.env 2>/dev/null | cut -d'=' -f2 || echo "/root/horry/score/server")
    
    cat > /etc/systemd/system/$SERVICE_NAME.service << 'EOF'
[Unit]
Description=Mahjong Score Server
After=network.target mysql.service

[Service]
Type=simple
User=ROOT_USER
WorkingDirectory=WORK_DIR
ExecStart=/usr/local/bin/SERVICE_NAME
Restart=always
RestartSec=5
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
EOF
    
    # 替换占位符
    sed -i.bak "s/SERVICE_NAME/$SERVICE_NAME/g" /etc/systemd/system/$SERVICE_NAME.service
    sed -i.bak "s/ROOT_USER/$SERVICE_USER/g" /etc/systemd/system/$SERVICE_NAME.service
    sed -i.bak "s|WORK_DIR|$SERVICE_WORK_DIR|g" /etc/systemd/system/$SERVICE_NAME.service
    rm -f /etc/systemd/system/$SERVICE_NAME.service.bak
    echo "✅ systemd服务配置创建完成"
else
    echo "✅ systemd服务配置已存在，跳过创建"
fi

systemctl daemon-reload
# 从环境变量文件读取服务名（注意：此时在server目录下）
SERVICE_NAME=$(grep "^SERVICE_NAME=" server.env 2>/dev/null | cut -d'=' -f2 || echo "mahjong-server")
systemctl enable $SERVICE_NAME
echo "✅ systemd服务配置完成"

# 11. 启动服务
echo "11. 启动服务..."
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ 服务已在运行，跳过启动"
else
    echo "启动$SERVICE_NAME服务..."
    systemctl start $SERVICE_NAME
    sleep 3
    
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo "✅ 服务启动成功"
    else
        echo "❌ 服务启动失败"
        systemctl status $SERVICE_NAME --no-pager
        exit 1
    fi
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
echo "📋 部署总结:"
echo "   - 已安装组件:$EXISTING_COMPONENTS"
echo "   - 数据库表: $(mysql -u root -p$DB_PASSWORD -D $DB_NAME -e "SHOW TABLES;" 2>/dev/null | wc -l | awk '{print $1-1}') 个表"
echo "   - 服务状态: $(systemctl is-active $SERVICE_NAME)"
echo ""
echo "⚠️  注意: 需要手动配置SSL证书文件:"
echo "   - 证书文件: /etc/ssl/certs/aipaint.cloud.crt"
echo "   - 私钥文件: /etc/ssl/private/aipaint.cloud.key"
echo ""
echo "🔧 管理命令:"
echo "   - 重启服务: ./restart.sh"
echo "   - 停止服务: ./stop.sh"
echo "   - 查看日志: tail -f /root/horry/score/server/logs/log_*.log"