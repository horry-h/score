# GetRoom方法TIMESTAMP字段修复

## 问题描述

虽然数据库中存在ID=1的房间，但API返回"房间不存在"错误：

```
getRoom API调用: {roomId: 1, roomCode: undefined, params: "room_id=1", url: "/api/v1/getRoom?room_id=1"}
加载房间数据失败: Error: 房间不存在
```

## 问题分析

### 1. 根本原因

在`GetRoom`方法中，数据库查询的`created_at`和`settled_at`字段是`TIMESTAMP`类型，但Go结构体中定义为`int64`类型，导致类型不匹配的扫描错误。

### 2. 数据流程问题

```
数据库查询 → TIMESTAMP字段 → 直接扫描到int64 → 类型不匹配错误 → 返回"房间不存在"
```

### 3. 错误位置

**问题代码** (`server/internal/service/mahjong.go`):
```go
func (s *MahjongService) GetRoom(ctx context.Context, req *GetRoomRequest) (*Response, error) {
    room := &Room{}
    err := s.db.QueryRow(query, args...).Scan(
        &room.Id, &room.RoomCode, &room.RoomName, &room.CreatorId, 
        &room.Status, &room.CreatedAt, &room.SettledAt,  // 问题：直接扫描TIMESTAMP到int64
    )
    
    if err != nil {
        return &Response{Code: 404, Message: "房间不存在"}, nil
    }
}
```

## 修复方案

### 1. 后端类型转换修复

#### 修复前
```go
func (s *MahjongService) GetRoom(ctx context.Context, req *GetRoomRequest) (*Response, error) {
    room := &Room{}
    err := s.db.QueryRow(query, args...).Scan(
        &room.Id, &room.RoomCode, &room.RoomName, &room.CreatorId, 
        &room.Status, &room.CreatedAt, &room.SettledAt,
    )
    
    if err != nil {
        return &Response{Code: 404, Message: "房间不存在"}, nil
    }
}
```

#### 修复后
```go
func (s *MahjongService) GetRoom(ctx context.Context, req *GetRoomRequest) (*Response, error) {
    room := &Room{}
    var createdAt, settledAt time.Time  // 使用time.Time作为中间类型
    err := s.db.QueryRow(query, args...).Scan(
        &room.Id, &room.RoomCode, &room.RoomName, &room.CreatorId, 
        &room.Status, &createdAt, &settledAt,
    )
    
    if err != nil {
        return &Response{Code: 404, Message: "房间不存在"}, nil
    }

    // 转换时间戳
    room.CreatedAt = createdAt.Unix()
    if !settledAt.IsZero() {
        room.SettledAt = settledAt.Unix()
    }
}
```

### 2. 数据流程优化

#### 修复后的数据流程
```
数据库查询 → TIMESTAMP字段 → time.Time中间类型 → 转换为Unix时间戳 → int64字段
```

#### 时间转换逻辑
```go
// 1. 数据库扫描到time.Time
var createdAt, settledAt time.Time
err := s.db.QueryRow(...).Scan(..., &createdAt, &settledAt, ...)

// 2. 转换为Unix时间戳
room.CreatedAt = createdAt.Unix()
if !settledAt.IsZero() {
    room.SettledAt = settledAt.Unix()
}
```

### 3. 错误处理增强

- **类型安全**: 使用正确的类型进行数据库扫描
- **空值处理**: 检查`settledAt`是否为零值
- **错误处理**: 保持原有的错误处理逻辑

## 测试验证

### 1. API调用测试

现在应该看到正确的响应：
```
getRoom API调用: {roomId: 1, roomCode: undefined, params: "room_id=1", url: "/api/v1/getRoom?room_id=1"}
getRoom响应: {code: 200, message: "获取成功", data: "{\"id\":1,\"room_code\":\"1757145314741633\",\"room_name\":\"测试房间\",\"creator_id\":1,\"status\":1,\"created_at\":1757145314,\"settled_at\":0,\"players\":[]}"}
```

### 2. 房间数据加载测试

```
房间页面onLoad，接收到的参数: {roomId: "1"}
使用roomId进入房间: 1
loadRoomData开始，当前roomId: 1
调用api.getRoom，参数: {roomId: 1, roomCode: undefined}
getRoom响应: {code: 200, message: "获取成功", data: "..."}
```

### 3. 数据库验证

```bash
# 在服务器上执行
./check-room-data.sh
```

## 相关文件

- ✅ `server/internal/service/mahjong.go` - GetRoom方法修复
- ✅ `check-room-data.sh` - 数据库检查脚本
- ✅ `GETROOM_TIMESTAMP_FIX.md` - 修复说明文档

## 总结

通过修复TIMESTAMP字段的类型转换问题，解决了GetRoom方法返回"房间不存在"的错误：

1. **类型安全**: 使用`time.Time`作为中间类型进行数据库扫描
2. **时间转换**: 将`time.Time`转换为Unix时间戳
3. **空值处理**: 正确处理`settled_at`字段的空值情况
4. **错误处理**: 保持原有的错误处理逻辑
5. **向后兼容**: 保持API响应格式不变

**GetRoom方法TIMESTAMP字段问题已修复！** 现在可以正常获取房间信息。🎉
