# MySQL Root用户访问修复指南

## 问题描述

MySQL root用户无法访问，出现错误：
```
ERROR 1045 (28000): Access denied for user 'root'@'localhost' (using password: NO)
```

## 问题分析

这是MySQL安装后的常见问题，root用户需要密码但系统不知道密码是什么。

## 修复方案

### 方法1: 重置root密码（推荐）

#### 步骤1: 停止MySQL服务
```bash
sudo systemctl stop mysql
```

#### 步骤2: 创建临时SQL文件
```bash
cat > /tmp/mysql-init.sql << EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';
FLUSH PRIVILEGES;
EOF
```

#### 步骤3: 以安全模式启动MySQL
```bash
sudo mysqld_safe --init-file=/tmp/mysql-init.sql --skip-grant-tables --skip-networking &
```

#### 步骤4: 等待MySQL启动
```bash
sleep 10
```

#### 步骤5: 停止安全模式MySQL
```bash
sudo pkill mysqld
```

#### 步骤6: 启动正常MySQL服务
```bash
sudo systemctl start mysql
```

#### 步骤7: 测试新密码
```bash
mysql -u root -p123456 -e "SELECT 1;"
```

### 方法2: 使用mysql_secure_installation

```bash
sudo mysql_secure_installation
```

按照提示设置root密码。

### 方法3: 使用系统用户

```bash
sudo mysql
```

在MySQL命令行中执行：
```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';
FLUSH PRIVILEGES;
exit;
```

## 完整修复流程

### 1. 重置root密码
```bash
# 停止MySQL
sudo systemctl stop mysql

# 创建临时SQL文件
cat > /tmp/mysql-init.sql << EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';
FLUSH PRIVILEGES;
EOF

# 以安全模式启动
sudo mysqld_safe --init-file=/tmp/mysql-init.sql --skip-grant-tables --skip-networking &
sleep 10

# 停止安全模式
sudo pkill mysqld
sleep 3

# 启动正常服务
sudo systemctl start mysql
sleep 5

# 清理临时文件
rm -f /tmp/mysql-init.sql
```

### 2. 验证密码设置
```bash
mysql -u root -p123456 -e "SELECT 1;"
```

### 3. 创建数据库
```bash
mysql -u root -p123456 << EOF
CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
```

### 4. 导入数据库结构
```bash
mysql -u root -p123456 mahjong_score < server/database.sql
```

### 5. 验证数据库
```bash
mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;"
```

### 6. 重启应用服务
```bash
sudo systemctl restart score-server
```

### 7. 测试API
```bash
curl -s http://localhost:8080/api/v1/health
```

## 一键修复脚本

### 使用修复脚本
```bash
chmod +x fix-mysql-root-access.sh
./fix-mysql-root-access.sh
```

### 脚本特点
- 自动尝试多种连接方式
- 自动重置root密码
- 自动创建数据库
- 自动导入表结构
- 自动验证功能

## 常见问题

### 1. 如果mysqld_safe命令不存在
```bash
# 使用mysqld命令
sudo mysqld --init-file=/tmp/mysql-init.sql --skip-grant-tables --skip-networking &
```

### 2. 如果仍然无法连接
```bash
# 检查MySQL服务状态
sudo systemctl status mysql

# 查看MySQL错误日志
sudo tail -f /var/log/mysql/error.log
```

### 3. 如果密码重置失败
```bash
# 使用UPDATE语句重置
sudo mysql -u root << EOF
USE mysql;
UPDATE user SET authentication_string=PASSWORD('123456') WHERE User='root' AND Host='localhost';
FLUSH PRIVILEGES;
EOF
```

## 验证修复

修复完成后，应该看到：

1. **MySQL连接成功**：
   ```bash
   mysql -u root -p123456 -e "SELECT 1;"
   ```

2. **数据库存在**：
   ```bash
   mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;"
   ```

3. **API正常**：
   ```bash
   curl -s http://localhost:8080/api/v1/health
   ```

## 相关文件

- ✅ `fix-mysql-root-access.sh` - 一键修复脚本
- ✅ `MYSQL_ROOT_ACCESS_FIX.md` - 修复指南

## 总结

通过重置MySQL root用户密码，解决了访问权限问题：

1. **识别问题**: MySQL root用户需要密码
2. **重置密码**: 使用安全模式重置密码
3. **创建数据库**: 使用新密码创建数据库
4. **导入结构**: 导入数据库表结构
5. **验证功能**: 确保所有功能正常

**MySQL root用户访问问题已修复！** 现在系统应该可以正常运行。🎉
