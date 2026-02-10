#!/bin/bash

# SSL证书自动化管理脚本 (基于Certbot)
# 用于自动申请和续期Let's Encrypt免费证书

set -e

echo "=== SSL证书自动化管理 (Certbot) ==="

# 检查是否以root权限运行
if [ "$(id -u)" -ne 0 ]; then
    echo "❌ 请以root权限运行此脚本"
    exit 1
fi

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo "❌ 无法检测操作系统版本"
    exit 1
fi

echo "✅ 检测到操作系统: $OS $VERSION"

# 1. 安装Certbot
echo ""
echo "1. 安装Certbot..."
if command -v certbot &> /dev/null; then
    CERTBOT_VERSION=$(certbot --version 2>&1 | grep -oP '\d+\.\d+\.\d+' | head -1)
    echo "✅ Certbot已安装，版本: $CERTBOT_VERSION"
else
    echo "正在安装Certbot..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt update -y
        apt install -y certbot python3-certbot-nginx
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y epel-release
        yum install -y certbot python3-certbot-nginx
    else
        echo "❌ 不支持的操作系统: $OS"
        exit 1
    fi
    echo "✅ Certbot安装完成"
fi

# 2. 检查Nginx配置
echo ""
echo "2. 检查Nginx配置..."
DOMAIN="aipaint.cloud"
WWW_DOMAIN="www.aipaint.cloud"

if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx未安装，请先运行deploy.sh脚本"
    exit 1
fi

# 检查Nginx配置文件是否存在
if [ ! -f "/etc/nginx/sites-available/$DOMAIN" ]; then
    echo "❌ Nginx配置文件不存在: /etc/nginx/sites-available/$DOMAIN"
    echo "   请先运行deploy.sh脚本"
    exit 1
fi

echo "✅ Nginx配置文件存在"

# 3. 备份现有证书配置
echo ""
echo "3. 备份现有Nginx配置..."
BACKUP_DIR="/root/ssl-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 备份Nginx配置
cp /etc/nginx/sites-available/$DOMAIN "$BACKUP_DIR/"

# 备份现有证书(如果存在)
if [ -f "/etc/ssl/certs/$DOMAIN.crt" ]; then
    cp /etc/ssl/certs/$DOMAIN.crt "$BACKUP_DIR/"
fi
if [ -f "/etc/ssl/private/$DOMAIN.key" ]; then
    cp /etc/ssl/private/$DOMAIN.key "$BACKUP_DIR/"
fi

echo "✅ 备份已保存到: $BACKUP_DIR"

# 4. 临时修改Nginx配置以便Certbot验证
echo ""
echo "4. 准备证书申请环境..."

# 检查80端口是否被占用
if ! netstat -tuln | grep -q ":80 "; then
    echo "⚠️  80端口未监听，确保Nginx正在运行..."
    systemctl start nginx
fi

# 5. 使用Certbot申请证书
echo ""
echo "5. 申请Let's Encrypt证书..."
echo "   域名: $DOMAIN, $WWW_DOMAIN"

# 检查是否已有证书
if certbot certificates 2>&1 | grep -q "$DOMAIN"; then
    echo "✅ 证书已存在"
    echo ""
    echo "当前证书信息:"
    certbot certificates
    
    read -p "是否续期现有证书? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "正在续期证书..."
        certbot renew --nginx --force-renewal
    else
        echo "跳过证书续期"
    fi
else
    echo "正在申请新证书..."
    echo "⚠️  申请前请确保:"
    echo "   1. 域名 $DOMAIN 和 $WWW_DOMAIN 已正确解析到此服务器"
    echo "   2. 防火墙已开放 80 和 443 端口"
    echo "   3. Nginx正在运行"
    echo ""
    
    read -p "是否继续申请证书? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 已取消证书申请"
        exit 1
    fi
    
    # 申请证书(使用nginx插件,自动配置)
    certbot --nginx \
        -d "$DOMAIN" \
        -d "$WWW_DOMAIN" \
        --non-interactive \
        --agree-tos \
        --redirect \
        --email admin@$DOMAIN \
        || {
            echo ""
            echo "❌ 证书申请失败，可能的原因:"
            echo "   1. 域名未正确解析到此服务器"
            echo "   2. 80端口无法访问"
            echo "   3. Let's Encrypt API限流(每小时最多5次失败)"
            echo ""
            echo "💡 解决方案:"
            echo "   - 检查域名DNS解析: dig $DOMAIN"
            echo "   - 检查80端口: curl http://$DOMAIN"
            echo "   - 稍后重试"
            exit 1
        }
    
    echo "✅ 证书申请成功"
fi

# 6. 验证证书
echo ""
echo "6. 验证证书..."
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ 证书文件存在"
    
    # 显示证书到期时间
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem | cut -d= -f2)
    echo "📅 证书到期时间: $EXPIRY_DATE"
else
    echo "❌ 证书文件不存在"
    exit 1
fi

# 7. 配置自动续期
echo ""
echo "7. 配置证书自动续期..."

# Certbot安装时会自动创建systemd timer或cron任务
if systemctl list-timers | grep -q certbot; then
    echo "✅ Certbot systemd定时器已启用"
    systemctl list-timers certbot.timer --no-pager
elif [ -f /etc/cron.d/certbot ]; then
    echo "✅ Certbot cron任务已启用"
    cat /etc/cron.d/certbot
else
    echo "⚠️  未检测到自动续期任务，手动创建..."
    
    # 创建systemd timer
    cat > /etc/systemd/system/certbot-renew.service << 'EOF'
[Unit]
Description=Certbot Renewal

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --nginx --quiet --post-hook "systemctl reload nginx"
EOF

    cat > /etc/systemd/system/certbot-renew.timer << 'EOF'
[Unit]
Description=Run certbot renewal twice daily

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    systemctl enable certbot-renew.timer
    systemctl start certbot-renew.timer
    
    echo "✅ 已创建systemd定时器"
fi

# 8. 测试自动续期
echo ""
echo "8. 测试证书自动续期..."
if certbot renew --dry-run --nginx; then
    echo "✅ 证书自动续期测试通过"
else
    echo "⚠️  证书自动续期测试失败，请检查配置"
fi

# 9. 重载Nginx配置
echo ""
echo "9. 重载Nginx配置..."
if nginx -t; then
    systemctl reload nginx
    echo "✅ Nginx配置已重载"
else
    echo "❌ Nginx配置测试失败"
    echo "正在恢复备份配置..."
    cp "$BACKUP_DIR/$DOMAIN" /etc/nginx/sites-available/
    systemctl reload nginx
    exit 1
fi

# 10. 测试HTTPS访问
echo ""
echo "10. 测试HTTPS访问..."
if curl -sSf -o /dev/null https://$DOMAIN/health 2>/dev/null || \
   curl -sSf -o /dev/null https://$DOMAIN/ 2>/dev/null; then
    echo "✅ HTTPS访问测试通过"
else
    echo "⚠️  HTTPS访问测试失败，但证书可能已正确配置"
    echo "   请手动访问: https://$DOMAIN"
fi

echo ""
echo "=== SSL证书配置完成 ==="
echo "✅ Let's Encrypt证书已成功配置并启用自动续期"
echo ""
echo "📋 证书信息:"
certbot certificates
echo ""
echo "📝 重要说明:"
echo "   - 证书有效期: 90天"
echo "   - 自动续期: 每天检查2次(0点和12点)"
echo "   - 续期阈值: 到期前30天自动续期"
echo "   - 备份位置: $BACKUP_DIR"
echo ""
echo "🔧 管理命令:"
echo "   - 查看证书: certbot certificates"
echo "   - 手动续期: certbot renew --nginx"
echo "   - 测试续期: certbot renew --dry-run"
echo "   - 撤销证书: certbot revoke --cert-path /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo ""
echo "🌐 访问地址:"
echo "   - https://$DOMAIN"
echo "   - https://$WWW_DOMAIN"
