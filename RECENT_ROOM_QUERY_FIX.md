# 最近房间查询失败问题修复

## 问题描述

加载最近房间时出现"查询最近房间失败"错误：

```
index.js? [sm]:79 加载最近房间失败: Error: 查询最近房间失败
```

## 问题分析

### 1. 根本原因

在`GetRecentRoom`方法中，数据库查询的`last_accessed_at`字段是`TIMESTAMP`类型，但Go结构体中定义为`int64`类型，导致类型不匹配的扫描错误。

### 2. 数据流程问题

```
数据库查询 → TIMESTAMP字段 → 直接扫描到int64 → 类型不匹配错误
```

### 3. 错误位置

**问题代码** (`server/internal/service/mahjong.go`):
```go
func (s *MahjongService) GetRecentRoom(ctx context.Context, req *GetUserRequest) (*Response, error) {
    var recentRoom RecentRoom
    err := s.db.QueryRow(`
        SELECT r.id, r.room_code, r.room_name, r.status, urr.last_accessed_at,
               rp.current_score,
               (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count,
               (SELECT COUNT(*) FROM score_transfers WHERE room_id = r.id) as transfer_count
        FROM user_recent_rooms urr
        INNER JOIN rooms r ON urr.room_id = r.id
        INNER JOIN room_players rp ON r.id = rp.room_id AND rp.user_id = urr.user_id
        WHERE urr.user_id = ?
        ORDER BY urr.last_accessed_at DESC
        LIMIT 1
    `, req.UserId).Scan(
        &recentRoom.RoomId, &recentRoom.RoomCode, &recentRoom.RoomName, &recentRoom.Status,
        &recentRoom.LastAccessedAt, &recentRoom.CurrentScore, &recentRoom.PlayerCount, &recentRoom.TransferCount,
    )
    // 问题：直接扫描TIMESTAMP到int64
}
```

## 修复方案

### 1. 后端类型转换修复

#### 修复前
```go
func (s *MahjongService) GetRecentRoom(ctx context.Context, req *GetUserRequest) (*Response, error) {
    var recentRoom RecentRoom
    err := s.db.QueryRow(`
        SELECT r.id, r.room_code, r.room_name, r.status, urr.last_accessed_at,
               rp.current_score,
               (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count,
               (SELECT COUNT(*) FROM score_transfers WHERE room_id = r.id) as transfer_count
        FROM user_recent_rooms urr
        INNER JOIN rooms r ON urr.room_id = r.id
        INNER JOIN room_players rp ON r.id = rp.room_id AND rp.user_id = urr.user_id
        WHERE urr.user_id = ?
        ORDER BY urr.last_accessed_at DESC
        LIMIT 1
    `, req.UserId).Scan(
        &recentRoom.RoomId, &recentRoom.RoomCode, &recentRoom.RoomName, &recentRoom.Status,
        &recentRoom.LastAccessedAt, &recentRoom.CurrentScore, &recentRoom.PlayerCount, &recentRoom.TransferCount,
    )
}
```

#### 修复后
```go
func (s *MahjongService) GetRecentRoom(ctx context.Context, req *GetUserRequest) (*Response, error) {
    var recentRoom RecentRoom
    var lastAccessedAt time.Time  // 使用time.Time作为中间类型
    err := s.db.QueryRow(`
        SELECT r.id, r.room_code, r.room_name, r.status, urr.last_accessed_at,
               rp.current_score,
               (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count,
               (SELECT COUNT(*) FROM score_transfers WHERE room_id = r.id) as transfer_count
        FROM user_recent_rooms urr
        INNER JOIN rooms r ON urr.room_id = r.id
        INNER JOIN room_players rp ON r.id = rp.room_id AND rp.user_id = urr.user_id
        WHERE urr.user_id = ?
        ORDER BY urr.last_accessed_at DESC
        LIMIT 1
    `, req.UserId).Scan(
        &recentRoom.RoomId, &recentRoom.RoomCode, &recentRoom.RoomName, &recentRoom.Status,
        &lastAccessedAt, &recentRoom.CurrentScore, &recentRoom.PlayerCount, &recentRoom.TransferCount,
    )
    
    if err == sql.ErrNoRows {
        return &Response{Code: 200, Message: "没有最近房间"}, nil
    } else if err != nil {
        return &Response{Code: 500, Message: "查询最近房间失败"}, nil
    }

    // 转换时间戳
    recentRoom.LastAccessedAt = lastAccessedAt.Unix()

    recentRoomData, _ := json.Marshal(recentRoom)
    return &Response{Code: 200, Message: "获取成功", Data: string(recentRoomData)}, nil
}
```

### 2. 数据库调试脚本

#### 调试脚本 (`debug-recent-room.sh`)
```bash
#!/bin/bash
# 调试最近房间查询问题
# 用法: ./debug-recent-room.sh [user_id]

USER_ID=${1:-20}
echo "调试最近房间查询，用户ID: $USER_ID"

mysql -h"localhost" -u"root" -p"123456" "mahjong_score" << EOF
-- 检查用户是否存在
SELECT '用户信息:' as info;
SELECT id, nickname, openid FROM users WHERE id = $USER_ID;

-- 检查用户最近房间表
SELECT '用户最近房间:' as info;
SELECT * FROM user_recent_rooms WHERE user_id = $USER_ID;

-- 检查房间表
SELECT '房间信息:' as info;
SELECT id, room_code, room_name, status, created_at FROM rooms ORDER BY id DESC LIMIT 5;

-- 检查房间玩家表
SELECT '房间玩家:' as info;
SELECT * FROM room_players ORDER BY id DESC LIMIT 5;

-- 执行完整的最近房间查询
SELECT '完整查询测试:' as info;
SELECT r.id, r.room_code, r.room_name, r.status, urr.last_accessed_at,
       rp.current_score,
       (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count,
       (SELECT COUNT(*) FROM score_transfers WHERE room_id = r.id) as transfer_count
FROM user_recent_rooms urr
INNER JOIN rooms r ON urr.room_id = r.id
INNER JOIN room_players rp ON r.id = rp.room_id AND rp.user_id = urr.user_id
WHERE urr.user_id = $USER_ID
ORDER BY urr.last_accessed_at DESC
LIMIT 1;
EOF
```

## 数据流程优化

### 1. 修复后的数据流程

```
数据库查询 → TIMESTAMP字段 → time.Time中间类型 → 转换为Unix时间戳 → int64字段
```

### 2. 类型转换逻辑

```go
// 1. 数据库扫描到time.Time
var lastAccessedAt time.Time
err := s.db.QueryRow(...).Scan(..., &lastAccessedAt, ...)

// 2. 转换为Unix时间戳
recentRoom.LastAccessedAt = lastAccessedAt.Unix()
```

### 3. 错误处理增强

- **类型安全**: 使用正确的类型进行数据库扫描
- **错误处理**: 保持原有的错误处理逻辑
- **调试信息**: 添加数据库调试脚本

## 测试验证

### 1. 数据库查询测试

```bash
# 在服务器上执行
./debug-recent-room.sh 20
```

### 2. API调用测试

现在应该看到正确的响应：
```
getRecentRoom响应: {code: 200, message: "获取成功", data: "{\"room_id\":6,\"room_code\":\"1757145314741633\",\"room_name\":\"测试房间\",\"status\":1,\"last_accessed_at\":1757145314,\"current_score\":0,\"player_count\":1,\"transfer_count\":0}"}
```

### 3. 前端显示测试

```
最近房间数据: {room_id: 6, room_code: "1757145314741633", room_name: "测试房间", status: 1, last_accessed_at: 1757145314, current_score: 0, player_count: 1, transfer_count: 0}
准备跳转，room_id: 6
准备跳转，room_code: 1757145314741633
使用roomId跳转，URL: /pages/room/room?roomId=6
```

## 相关文件

- ✅ `server/internal/service/mahjong.go` - GetRecentRoom方法修复
- ✅ `debug-recent-room.sh` - 数据库调试脚本
- ✅ `RECENT_ROOM_QUERY_FIX.md` - 修复说明文档

## 总结

通过修复TIMESTAMP字段的类型转换问题，解决了最近房间查询失败的错误：

1. **类型安全**: 使用`time.Time`作为中间类型进行数据库扫描
2. **时间转换**: 将`time.Time`转换为Unix时间戳
3. **错误处理**: 保持原有的错误处理逻辑
4. **调试工具**: 提供数据库调试脚本
5. **向后兼容**: 保持API响应格式不变

**最近房间查询问题已修复！** 现在可以正常获取和显示最近房间信息。🎉
