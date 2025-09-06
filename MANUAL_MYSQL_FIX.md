# 手动MySQL修复指南

## 问题分析

MySQL root用户没有密码，但脚本尝试使用密码连接，导致`ERROR 1045 (28000): Access denied for user 'root'@'localhost' (using password: NO)`错误。

## 手动修复步骤

### 1. 启动MySQL服务

```bash
sudo systemctl start mysql
sudo systemctl enable mysql
```

### 2. 使用无密码root用户创建数据库

```bash
sudo mysql -u root
```

在MySQL命令行中执行：
```sql
CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

### 3. 导入数据库结构

```bash
sudo mysql -u root mahjong_score < server/database.sql
```

### 4. 设置root密码

```bash
sudo mysql -u root
```

在MySQL命令行中执行：
```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';
FLUSH PRIVILEGES;
exit;
```

### 5. 验证设置

```bash
mysql -u root -p123456 -e "SELECT 1;"
```

### 6. 验证数据库

```bash
mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;"
```

### 7. 重启应用服务

```bash
sudo systemctl restart score-server
```

### 8. 测试API

```bash
curl -s http://localhost:8080/api/v1/health
```

## 一键修复脚本

### 简单修复脚本 (`simple-mysql-fix.sh`)

```bash
#!/bin/bash
# 简单MySQL修复脚本 - 处理无密码root用户
echo "简单MySQL修复脚本..."

# 1. 启动MySQL
echo "启动MySQL服务..."
sudo systemctl start mysql
sudo systemctl enable mysql
sleep 3

# 2. 使用无密码root用户创建数据库
echo "创建数据库..."
sudo mysql -u root << EOF
CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF

# 3. 导入数据库结构
echo "导入数据库结构..."
sudo mysql -u root mahjong_score < server/database.sql

# 4. 设置root密码
echo "设置root密码..."
sudo mysql -u root << EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';
FLUSH PRIVILEGES;
EOF

# 5. 验证设置
echo "验证设置..."
mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 密码设置成功"
else
    echo "❌ 密码设置失败，使用备用方法..."
    sudo mysql -u root << EOF
UPDATE mysql.user SET authentication_string=PASSWORD('123456') WHERE User='root' AND Host='localhost';
FLUSH PRIVILEGES;
EOF
fi

# 6. 验证数据库
echo "验证数据库..."
mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 数据库验证成功"
else
    echo "❌ 数据库验证失败"
    exit 1
fi

# 7. 重启应用
echo "重启应用服务..."
sudo systemctl restart score-server
sleep 3

# 8. 测试
echo "测试API..."
curl -s http://localhost:8080/api/v1/health && echo "✅ 修复成功" || echo "❌ 修复失败"

echo "修复完成！"
```

## 使用说明

### 方法1：手动执行（推荐）

按照上面的手动修复步骤，一步一步执行。

### 方法2：使用修复脚本

```bash
chmod +x simple-mysql-fix.sh
./simple-mysql-fix.sh
```

## 常见问题

### 1. 如果ALTER USER命令失败

使用备用方法：
```sql
UPDATE mysql.user SET authentication_string=PASSWORD('123456') WHERE User='root' AND Host='localhost';
FLUSH PRIVILEGES;
```

### 2. 如果仍然无法连接

检查MySQL服务状态：
```bash
sudo systemctl status mysql
```

### 3. 如果数据库导入失败

检查database.sql文件是否存在：
```bash
ls -la server/database.sql
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

- ✅ `simple-mysql-fix.sh` - 简单修复脚本
- ✅ `fix-mysql-no-password.sh` - 完整修复脚本
- ✅ `MANUAL_MYSQL_FIX.md` - 手动修复指南

## 总结

通过正确处理无密码root用户的情况，解决了MySQL连接和数据库创建问题：

1. **识别问题**: MySQL root用户无密码
2. **正确连接**: 使用无密码方式连接
3. **创建数据库**: 使用无密码root用户创建数据库
4. **设置密码**: 为root用户设置密码
5. **验证功能**: 确保所有功能正常

**MySQL修复完成！** 现在系统应该可以正常运行。🎉
