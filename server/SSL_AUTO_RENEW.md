# SSL证书自动续期方案

## 问题说明
腾讯云免费SSL证书有效期只有2-3个月,需要频繁手动更新,非常麻烦。

## 解决方案
使用 **Let's Encrypt + Certbot** 实现SSL证书的自动申请和续期。

### 方案优势
- ✅ **完全免费**: Let's Encrypt提供免费证书
- ✅ **自动续期**: 证书到期前30天自动续期,无需人工干预
- ✅ **简单易用**: 一键安装配置,全自动化管理
- ✅ **安全可靠**: Let's Encrypt是全球信任的证书颁发机构

---

## 使用步骤

### 1. 前置条件
在运行SSL自动化脚本前,请确保:

- [x] 已运行 `deploy.sh` 完成服务部署
- [x] 域名已正确解析到服务器IP
- [x] 防火墙已开放 80 和 443 端口
- [x] Nginx服务正在运行

### 2. 运行自动化脚本

```bash
cd /root/horry/score/server/scripts
sudo ./setup-certbot.sh
```

脚本会自动完成:
1. 安装Certbot及Nginx插件
2. 申请Let's Encrypt证书
3. 自动配置Nginx HTTPS
4. 设置证书自动续期(每天检查2次)
5. 测试证书和自动续期功能

### 3. 确认证书状态

查看证书信息:
```bash
sudo certbot certificates
```

测试自动续期:
```bash
sudo certbot renew --dry-run
```

---

## 证书管理

### 查看证书信息
```bash
sudo certbot certificates
```

### 手动续期证书
虽然会自动续期,但如果需要手动触发:
```bash
sudo certbot renew --nginx
```

### 强制重新申请证书
```bash
sudo certbot renew --nginx --force-renewal
```

### 查看续期定时任务状态
```bash
# 查看systemd定时器
sudo systemctl list-timers certbot.timer

# 或查看cron任务
cat /etc/cron.d/certbot
```

### 撤销证书
```bash
sudo certbot revoke --cert-path /etc/letsencrypt/live/aipaint.cloud/fullchain.pem
```

---

## 自动续期机制

### 续期策略
- **检查频率**: 每天2次(0点和12点)
- **续期阈值**: 证书到期前30天自动续期
- **证书有效期**: 90天
- **实际更新周期**: 约每60天自动更新一次

### 续期流程
1. Certbot定时器每天自动运行
2. 检查所有证书的到期时间
3. 如果证书距离到期少于30天,自动续期
4. 续期成功后自动重载Nginx配置
5. 如果失败,会发送通知(需配置邮箱)

### 验证自动续期是否正常
```bash
# 查看最近的续期日志
sudo journalctl -u certbot.timer -n 50

# 测试续期(不会真正续期)
sudo certbot renew --dry-run
```

---

## 常见问题

### Q1: 证书申请失败怎么办?
**可能原因:**
- 域名DNS解析未生效
- 80端口无法从外网访问
- Let's Encrypt API限流

**解决方法:**
```bash
# 检查DNS解析
dig aipaint.cloud

# 检查80端口访问
curl http://aipaint.cloud

# 检查防火墙
sudo ufw status
```

### Q2: 如何恢复旧证书?
脚本会自动备份旧证书到 `/root/ssl-backup-[时间戳]/`

恢复方法:
```bash
# 查看备份目录
ls -la /root/ssl-backup-*

# 恢复Nginx配置
sudo cp /root/ssl-backup-[时间戳]/aipaint.cloud /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx
```

### Q3: 证书过期了怎么办?
Let's Encrypt证书90天有效期,但会在到期前30天自动续期。如果错过自动续期:

```bash
# 手动强制续期
sudo certbot renew --nginx --force-renewal
```

### Q4: 如何切换回腾讯云证书?
如果需要切换回手动管理的腾讯云证书:

1. 停用Certbot自动续期:
```bash
sudo systemctl stop certbot-renew.timer
sudo systemctl disable certbot-renew.timer
```

2. 恢复原Nginx配置(使用备份)
3. 上传腾讯云证书到 `/etc/ssl/certs/` 和 `/etc/ssl/private/`
4. 重载Nginx: `sudo systemctl reload nginx`

### Q5: 证书申请次数限制
Let's Encrypt有速率限制:
- 每个域名每周最多50个证书
- 每小时最多5次失败

如果触发限制,需要等待一段时间后重试。

---

## 技术细节

### 证书存储位置
```
/etc/letsencrypt/
├── live/aipaint.cloud/          # 证书符号链接
│   ├── fullchain.pem            # 完整证书链
│   ├── privkey.pem              # 私钥
│   ├── cert.pem                 # 证书
│   └── chain.pem                # 证书链
├── archive/aipaint.cloud/       # 证书实际文件
├── renewal/                     # 续期配置
└── renewal-hooks/               # 续期钩子脚本
```

### Nginx配置变化
Certbot会自动修改Nginx配置:
- 更新 `ssl_certificate` 路径指向Let's Encrypt证书
- 更新 `ssl_certificate_key` 路径
- 添加HTTP到HTTPS重定向
- 不会修改其他配置(如proxy_pass等)

### 自动续期定时任务
```bash
# systemd定时器(推荐)
/etc/systemd/system/certbot-renew.timer
/etc/systemd/system/certbot-renew.service

# 或cron任务
/etc/cron.d/certbot
```

---

## 优势对比

| 特性 | 腾讯云免费证书 | Let's Encrypt + Certbot |
|------|--------------|------------------------|
| 有效期 | 2-3个月 | 90天 |
| 续期方式 | 手动申请下载配置 | 全自动 |
| 操作复杂度 | 高(需要多步操作) | 低(一键配置) |
| 时间成本 | 每2-3月需10分钟 | 初次配置5分钟,后续0成本 |
| 可靠性 | 依赖人工记忆 | 自动化,不会遗忘 |
| 费用 | 免费 | 免费 |

---

## 总结

使用 `setup-certbot.sh` 脚本后,你再也不需要:
- ❌ 记住证书到期时间
- ❌ 登录腾讯云控制台
- ❌ 手动下载证书文件
- ❌ 手动配置Nginx
- ❌ 重启服务

一切都是自动化的!🎉
