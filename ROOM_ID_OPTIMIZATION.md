# 房间ID优化 - 优先使用room_id

## 优化目标

将系统从优先使用`room_code`改为优先使用`room_id`（数据库主键），提高查询效率，因为主键查询比字符串查询更快。

## 优化方案

### 1. 前端优化

#### API调用逻辑 (`miniprogram/utils/api.js`)

**优化前**:
```javascript
async getRoom(roomId, roomCode) {
  const params = roomId ? `room_id=${roomId}` : `room_code=${roomCode}`;
  return this.request(`/api/v1/getRoom?${params}`);
}
```

**优化后**:
```javascript
async getRoom(roomId, roomCode) {
  // 优先使用roomId，如果没有则使用roomCode
  const params = roomId ? `room_id=${roomId}` : `room_code=${roomCode}`;
  const url = `/api/v1/getRoom?${params}`;
  console.log('getRoom API调用:', { roomId, roomCode, params, url });
  return this.request(url);
}
```

#### 房间页面参数处理 (`miniprogram/pages/room/room.js`)

**优化前**:
```javascript
// 优先使用roomCode，如果没有则使用roomId
if (roomCode && roomCode !== 'undefined' && roomCode !== 'null' && roomCode.trim() !== '') {
  this.setData({ roomCode: roomCode });
  this.loadRoomData();
} else if (roomId && roomId !== 'undefined' && roomId !== 'null' && roomId.trim() !== '') {
  // 处理roomId
}
```

**优化后**:
```javascript
// 优先使用roomId，如果没有则使用roomCode
if (roomId && roomId !== 'undefined' && roomId !== 'null' && roomId.trim() !== '') {
  const parsedRoomId = parseInt(roomId);
  if (isNaN(parsedRoomId)) {
    wx.showToast({ title: '房间ID无效', icon: 'none' });
    return;
  }
  console.log('使用roomId进入房间:', parsedRoomId);
  this.setData({ roomId: parsedRoomId });
  this.loadRoomData();
} else if (roomCode && roomCode !== 'undefined' && roomCode !== 'null' && roomCode.trim() !== '') {
  console.log('使用roomCode进入房间:', roomCode);
  this.setData({ roomCode: roomCode });
  this.loadRoomData();
}
```

#### 首页最近房间跳转 (`miniprogram/pages/index/index.js`)

**优化前**:
```javascript
// 优先使用room_code，如果没有则使用room_id
if (roomCode && roomCode !== 'undefined' && roomCode !== 'null') {
  const url = `/pages/room/room?roomCode=${roomCode}`
  wx.navigateTo({ url: url })
} else if (roomId) {
  const url = `/pages/room/room?roomId=${roomId}`
  wx.navigateTo({ url: url })
}
```

**优化后**:
```javascript
// 优先使用room_id，如果没有则使用room_code
if (roomId && roomId !== 'undefined' && roomId !== 'null') {
  const url = `/pages/room/room?roomId=${roomId}`
  console.log('使用roomId跳转，URL:', url)
  wx.navigateTo({ url: url })
} else if (roomCode && roomCode !== 'undefined' && roomCode !== 'null') {
  const url = `/pages/room/room?roomCode=${roomCode}`
  console.log('使用roomCode跳转，URL:', url)
  wx.navigateTo({ url: url })
}
```

#### 创建房间跳转 (`miniprogram/pages/create-room/create-room.js`)

**优化前**:
```javascript
wx.redirectTo({
  url: `/pages/room/room?roomCode=${roomData.room_code}`,
});
```

**优化后**:
```javascript
wx.redirectTo({
  url: `/pages/room/room?roomId=${roomData.room_id}`,
});
```

#### 加入房间跳转 (`miniprogram/pages/join-room/join-room.js`)

**优化前**:
```javascript
wx.redirectTo({
  url: `/pages/room/room?roomCode=${roomData.room_code}`,
});
```

**优化后**:
```javascript
wx.redirectTo({
  url: `/pages/room/room?roomId=${roomData.room_id}`,
});
```

#### 历史房间跳转 (`miniprogram/pages/history/history.js`)

**优化前**:
```javascript
wx.navigateTo({
  url: `/pages/room/room?roomCode=${room.room_code}`,
});
```

**优化后**:
```javascript
wx.navigateTo({
  url: `/pages/room/room?roomId=${room.room_id}`,
});
```

### 2. 后端优化

#### GetRoom方法 (`server/internal/service/mahjong.go`)

**优化前**:
```go
if req.RoomId > 0 {
    query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE id = ?"
    args = []interface{}{req.RoomId}
} else {
    query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE room_code = ?"
    args = []interface{}{req.RoomCode}
}
```

**优化后**:
```go
// 优先使用room_id，如果没有则使用room_code
if req.RoomId > 0 {
    query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE id = ?"
    args = []interface{}{req.RoomId}
} else if req.RoomCode != "" {
    query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE room_code = ?"
    args = []interface{}{req.RoomCode}
} else {
    return &Response{Code: 400, Message: "缺少房间标识"}, nil
}
```

## 数据流程优化

### 1. 新的数据流程

```
创建房间 → 返回room_id和room_code → 前端优先使用room_id跳转 → 后端优先使用room_id查询
```

### 2. 查询效率提升

- **主键查询**: `WHERE id = ?` (使用索引，O(log n))
- **字符串查询**: `WHERE room_code = ?` (字符串比较，O(n))

### 3. 兼容性保证

- **向后兼容**: 仍然支持通过`room_code`查询
- **渐进优化**: 新创建的房间优先使用`room_id`
- **错误处理**: 增强参数验证和错误提示

## 测试验证

### 1. 创建房间测试

```
创建房间响应: {code: 200, message: "创建成功", data: "{\"room_code\":\"1757145314741633\",\"room_id\":6}"}
解析后的房间数据: {room_code: "1757145314741633", room_id: 6}
跳转URL: /pages/room/room?roomId=6
房间页面onLoad，接收到的参数: {roomId: "6"}
使用roomId进入房间: 6
```

### 2. 最近房间测试

```
enterRecentRoom被调用，recentRoom: {room_id: 6, room_code: "1757145314741633"}
使用roomId跳转，URL: /pages/room/room?roomId=6
房间页面onLoad，接收到的参数: {roomId: "6"}
使用roomId进入房间: 6
```

### 3. 历史房间测试

```
历史房间数据: {room_id: 6, room_code: "1757145314741633"}
跳转URL: /pages/room/room?roomId=6
房间页面onLoad，接收到的参数: {roomId: "6"}
使用roomId进入房间: 6
```

## 性能提升

### 1. 查询效率

- **主键查询**: 使用B+树索引，查询时间O(log n)
- **字符串查询**: 全表扫描或字符串索引，查询时间O(n)

### 2. 内存使用

- **主键**: 8字节整数，内存占用小
- **room_code**: 16字节字符串，内存占用大

### 3. 网络传输

- **URL参数**: `roomId=6` vs `roomCode=1757145314741633`
- **减少传输**: 主键ID更短，减少网络开销

## 相关文件

- ✅ `miniprogram/utils/api.js` - API调用逻辑优化
- ✅ `miniprogram/pages/room/room.js` - 房间页面参数处理优化
- ✅ `miniprogram/pages/index/index.js` - 首页跳转逻辑优化
- ✅ `miniprogram/pages/create-room/create-room.js` - 创建房间跳转优化
- ✅ `miniprogram/pages/join-room/join-room.js` - 加入房间跳转优化
- ✅ `miniprogram/pages/history/history.js` - 历史房间跳转优化
- ✅ `server/internal/service/mahjong.go` - 后端GetRoom方法优化
- ✅ `ROOM_ID_OPTIMIZATION.md` - 优化说明文档

## 总结

通过优先使用`room_id`而不是`room_code`，实现了以下优化：

1. **性能提升**: 主键查询比字符串查询更快
2. **内存优化**: 整数ID比字符串占用更少内存
3. **网络优化**: 更短的URL参数减少传输开销
4. **向后兼容**: 仍然支持`room_code`查询
5. **错误处理**: 增强参数验证和错误提示

**房间ID优化完成！** 现在系统优先使用高效的`room_id`进行房间操作。🚀
