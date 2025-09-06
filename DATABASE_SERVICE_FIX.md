# 数据库服务修复指南

## 问题描述

服务器重启后出现以下问题：

1. **MySQL服务未启动**: `dial tcp 127.0.0.1:3306: connect: connection refused`
2. **数据库不存在**: `Unknown database 'mahjong_score'`
3. **Go应用服务重启失败**: 重启计数器达到50次

## 问题分析

### 1. 根本原因

服务器重启后：
- MySQL服务没有自动启动
- 数据库`mahjong_score`被删除或不存在
- Go应用无法连接到数据库，导致服务启动失败

### 2. 错误日志分析

```
Sep 06 16:37:32 VM-4-14-ubuntu mahjong-server[863917]: 2025/09/06 16:37:32 Failed to initialize database: failed to ping database: dial tcp 127.0.0.1:3306: connect: connection refused
Sep 06 16:37:37 VM-4-14-ubuntu mahjong-server[864247]: 2025/09/06 16:37:37 Failed to initialize database: failed to ping database: Error 1049 (42000): Unknown database 'mahjong_score'
```

## 修复方案

### 1. 快速修复脚本

#### 快速修复 (`quick-fix-database.sh`)
```bash
#!/bin/bash
# 快速修复数据库问题
echo "快速修复数据库问题..."

# 1. 启动MySQL
echo "启动MySQL服务..."
sudo systemctl start mysql
sudo systemctl enable mysql

# 2. 等待MySQL启动
sleep 5

# 3. 创建数据库
echo "创建数据库..."
sudo mysql -u root -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. 导入数据库结构
echo "导入数据库结构..."
sudo mysql -u root mahjong_score < server/database.sql

# 5. 设置root密码
echo "设置MySQL root密码..."
sudo mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';"
sudo mysql -u root -e "FLUSH PRIVILEGES;"

# 6. 重启应用服务
echo "重启应用服务..."
sudo systemctl restart score-server

# 7. 测试
sleep 3
echo "测试API..."
curl -s http://localhost:8080/api/v1/health && echo "✅ 修复成功" || echo "❌ 修复失败"

echo "快速修复完成！"
```

### 2. 完整修复脚本

#### 完整修复 (`fix-database-complete.sh`)
```bash
#!/bin/bash
# 完整修复数据库问题
echo "开始完整修复数据库问题..."

# 1. 检查MySQL服务状态
echo "1. 检查MySQL服务状态..."
systemctl status mysql

# 2. 启动MySQL服务
echo "2. 启动MySQL服务..."
systemctl start mysql

# 等待MySQL启动
echo "3. 等待MySQL启动..."
sleep 10

# 3. 检查MySQL服务状态
echo "4. 检查MySQL服务状态..."
systemctl status mysql

# 4. 设置MySQL开机自启
echo "5. 设置MySQL开机自启..."
systemctl enable mysql

# 5. 检查MySQL连接
echo "6. 检查MySQL连接..."
mysql -u root -p123456 -e "SELECT 1;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ MySQL连接成功"
else
    echo "❌ MySQL连接失败，尝试使用sudo..."
    sudo mysql -u root -e "SELECT 1;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ MySQL连接成功（使用sudo）"
        # 设置root密码
        echo "7. 设置MySQL root密码..."
        sudo mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';"
        sudo mysql -u root -e "FLUSH PRIVILEGES;"
    else
        echo "❌ MySQL仍然连接失败，请检查MySQL安装"
        exit 1
    fi
fi

# 6. 创建数据库
echo "8. 创建数据库..."
mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 数据库创建成功"
else
    echo "❌ 数据库创建失败，尝试使用sudo..."
    sudo mysql -u root -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if [ $? -eq 0 ]; then
        echo "✅ 数据库创建成功（使用sudo）"
    else
        echo "❌ 数据库创建失败"
        exit 1
    fi
fi

# 7. 导入数据库结构
echo "9. 导入数据库结构..."
if [ -f "server/database.sql" ]; then
    mysql -u root -p123456 mahjong_score < server/database.sql 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ 数据库结构导入成功"
    else
        echo "❌ 数据库结构导入失败，尝试使用sudo..."
        sudo mysql -u root mahjong_score < server/database.sql
        if [ $? -eq 0 ]; then
            echo "✅ 数据库结构导入成功（使用sudo）"
        else
            echo "❌ 数据库结构导入失败"
            exit 1
        fi
    fi
else
    echo "❌ 找不到database.sql文件"
    exit 1
fi

# 8. 验证数据库
echo "10. 验证数据库..."
mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 数据库验证成功"
    mysql -u root -p123456 -e "USE mahjong_score; SHOW TABLES;"
else
    echo "❌ 数据库验证失败"
    exit 1
fi

# 9. 重启Go应用服务
echo "11. 重启Go应用服务..."
systemctl restart score-server

# 等待服务启动
echo "12. 等待服务启动..."
sleep 5

# 10. 检查Go应用服务状态
echo "13. 检查Go应用服务状态..."
systemctl status score-server

# 11. 测试API
echo "14. 测试API..."
curl -s http://localhost:8080/api/v1/health
if [ $? -eq 0 ]; then
    echo "✅ API测试成功"
else
    echo "❌ API测试失败"
    echo "查看服务日志..."
    journalctl -u score-server --no-pager -n 20
fi

echo "数据库修复完成！"
```

## 使用说明

### 1. 快速修复（推荐）

```bash
# 在服务器上执行
chmod +x quick-fix-database.sh
./quick-fix-database.sh
```

### 2. 完整修复（详细诊断）

```bash
# 在服务器上执行
chmod +x fix-database-complete.sh
./fix-database-complete.sh
```

### 3. 手动修复步骤

如果脚本无法解决问题，可以手动执行以下步骤：

```bash
# 1. 启动MySQL服务
sudo systemctl start mysql
sudo systemctl enable mysql

# 2. 创建数据库
sudo mysql -u root -e "CREATE DATABASE IF NOT EXISTS mahjong_score CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. 导入数据库结构
sudo mysql -u root mahjong_score < server/database.sql

# 4. 设置root密码
sudo mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456';"
sudo mysql -u root -e "FLUSH PRIVILEGES;"

# 5. 重启应用服务
sudo systemctl restart score-server

# 6. 测试API
curl -s http://localhost:8080/api/v1/health
```

## 预防措施

### 1. 设置MySQL开机自启

```bash
sudo systemctl enable mysql
```

### 2. 设置应用服务依赖

修改`/etc/systemd/system/score-server.service`文件，添加MySQL依赖：

```ini
[Unit]
Description=Score Server
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/horry/score/server
ExecStart=/root/horry/score/server/mahjong-server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 3. 添加健康检查

在应用启动时添加数据库连接检查，确保MySQL服务可用。

## 相关文件

- ✅ `quick-fix-database.sh` - 快速修复脚本
- ✅ `fix-database-complete.sh` - 完整修复脚本
- ✅ `DATABASE_SERVICE_FIX.md` - 修复说明文档

## 总结

通过修复MySQL服务和重新创建数据库，解决了服务器重启后的数据库连接问题：

1. **服务启动**: 启动MySQL服务并设置开机自启
2. **数据库创建**: 重新创建`mahjong_score`数据库
3. **结构导入**: 导入数据库表结构
4. **密码设置**: 设置MySQL root密码
5. **服务重启**: 重启Go应用服务
6. **功能测试**: 验证API是否正常工作

**数据库服务修复完成！** 现在系统应该可以正常运行。🎉
