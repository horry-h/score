# 登录API 500错误修复说明

## 问题描述

小程序调用登录API时返回500内部服务器错误：
```
POST http://124.156.196.117:8080/api/v1/login 500 (Internal Server Error)
{"code":500,"message":"获取用户信息失败","data":""}
```

## 问题分析

### 错误原因

1. **数据库字段类型不匹配**: 
   - 数据库中使用`TIMESTAMP`类型存储时间
   - Go代码中期望`int64`类型（Unix时间戳）

2. **Scan方法类型错误**:
   - 直接扫描`TIMESTAMP`字段到`int64`变量会失败
   - 需要先扫描到`time.Time`类型，再转换为Unix时间戳

### 具体问题位置

在`server/internal/service/mahjong.go`的Login方法中：

**修改前**:
```go
err = s.db.QueryRow(`
    SELECT id, openid, nickname, avatar_url, created_at, updated_at 
    FROM users WHERE id = ?
`, userID).Scan(&user.Id, &user.Openid, &user.Nickname, &user.AvatarUrl, &user.CreatedAt, &user.UpdatedAt)
```

**问题**: 直接扫描`TIMESTAMP`字段到`int64`变量，导致类型不匹配错误。

## 解决方案

### 修复方法

1. **使用中间变量**: 先扫描到`time.Time`类型
2. **类型转换**: 将`time.Time`转换为Unix时间戳
3. **错误处理**: 确保转换过程正确

### 修复后的代码

**Login方法**:
```go
// 获取用户信息
user := &User{}
var createdAt, updatedAt time.Time
err = s.db.QueryRow(`
    SELECT id, openid, nickname, avatar_url, created_at, updated_at 
    FROM users WHERE id = ?
`, userID).Scan(&user.Id, &user.Openid, &user.Nickname, &user.AvatarUrl, &createdAt, &updatedAt)

if err != nil {
    return &Response{Code: 500, Message: "获取用户信息失败"}, nil
}

user.CreatedAt = createdAt.Unix()
user.UpdatedAt = updatedAt.Unix()
```

**GetUser方法**:
```go
// 获取用户信息
user := &User{}
var createdAt, updatedAt time.Time
err = s.db.QueryRow(`
    SELECT id, openid, nickname, avatar_url, created_at, updated_at 
    FROM users WHERE id = ?
`, req.UserId).Scan(&user.Id, &user.Openid, &user.Nickname, &user.AvatarUrl, &createdAt, &updatedAt)

if err != nil {
    return &Response{Code: 404, Message: "用户不存在"}, nil
}

user.CreatedAt = createdAt.Unix()
user.UpdatedAt = updatedAt.Unix()
```

## 数据库字段类型说明

### 数据库表结构
```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    openid VARCHAR(64) NOT NULL UNIQUE,
    nickname VARCHAR(50) NOT NULL DEFAULT '',
    avatar_url VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Go结构体定义
```go
type User struct {
    Id        int64  `json:"id"`
    Openid    string `json:"openid"`
    Nickname  string `json:"nickname"`
    AvatarUrl string `json:"avatar_url"`
    CreatedAt int64  `json:"created_at"`  // Unix时间戳
    UpdatedAt int64  `json:"updated_at"`  // Unix时间戳
}
```

### 类型转换说明
- **数据库**: `TIMESTAMP` → **Go**: `time.Time` → **JSON**: `int64` (Unix时间戳)
- 使用`time.Time.Unix()`方法转换为Unix时间戳

## 部署步骤

### 1. 本地构建
```bash
cd server
go mod tidy
go build -o mahjong-server .
```

### 2. 服务器部署
```bash
# 在服务器上执行
cd /root/horry/score
git pull
cd server
go mod tidy
go build -o mahjong-server .
sudo systemctl restart score-server
```

### 3. 验证修复
```bash
# 测试登录API
curl -X POST http://124.156.196.117:8080/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code","nickname":"测试用户","avatar_url":"https://example.com/avatar.jpg"}'
```

**预期结果**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": "{\"id\":1,\"openid\":\"mock_openid_1234\",\"nickname\":\"测试用户\",\"avatar_url\":\"https://example.com/avatar.jpg\",\"created_at\":1694000000,\"updated_at\":1694000000}"
}
```

## 其他需要修复的方法

### 可能存在的类似问题

1. **GetRoom方法**: 房间的`created_at`和`settled_at`字段
2. **GetRoomPlayers方法**: 玩家的`joined_at`字段
3. **GetRoomTransfers方法**: 转移记录的`created_at`字段
4. **GetRoomSettlements方法**: 结算记录的`created_at`字段

### 修复模式

对于所有时间字段，使用相同的修复模式：
```go
var timeField time.Time
err = s.db.QueryRow(query, args...).Scan(..., &timeField, ...)
if err != nil {
    return &Response{Code: 500, Message: "查询失败"}, nil
}
structField.TimeField = timeField.Unix()
```

## 测试验证

### 测试场景

1. **新用户登录**: 创建新用户并返回用户信息
2. **已存在用户登录**: 返回现有用户信息
3. **数据库连接**: 确保数据库连接正常
4. **时间戳格式**: 验证返回的时间戳格式正确

### 调试方法

1. **查看服务器日志**:
   ```bash
   sudo journalctl -u score-server -f
   ```

2. **测试数据库连接**:
   ```bash
   mysql -u root -p123456 -e "SELECT * FROM mahjong_score.users LIMIT 1;"
   ```

3. **检查服务状态**:
   ```bash
   sudo systemctl status score-server
   ```

## 总结

通过修复数据库字段类型不匹配的问题，解决了登录API的500错误：

1. **问题根源**: 数据库`TIMESTAMP`字段与Go `int64`类型不匹配
2. **解决方案**: 使用中间变量进行类型转换
3. **修复范围**: Login和GetUser方法
4. **部署方式**: 重新构建并重启服务

修复后，登录API应该能够正常工作，返回正确的用户信息。🎉
