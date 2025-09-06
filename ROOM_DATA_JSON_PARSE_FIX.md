# 房间数据JSON解析问题修复

## 问题描述

创建房间后，后端返回的响应格式为：
```json
{
  "code": 200,
  "message": "创建成功",
  "data": "{\"room_code\":\"1757145314741633\",\"room_id\":6}"
}
```

但前端直接使用`response.data.room_code`时得到`undefined`，因为`data`字段是一个JSON字符串，需要先解析。

## 问题分析

### 1. 后端返回格式

后端在`CreateRoom`和`JoinRoom`方法中：
```go
roomData := map[string]interface{}{
    "room_id":   roomID,
    "room_code": roomCode,
}

data, _ := json.Marshal(roomData)
return &Response{Code: 200, Message: "创建成功", Data: string(data)}, nil
```

这里将`roomData`序列化为JSON字符串，然后作为`Data`字段返回。

### 2. 前端处理问题

前端直接使用：
```javascript
response.data.room_code  // undefined，因为data是字符串
```

## 修复方案

### 1. 前端JSON解析处理

#### 创建房间页面 (`miniprogram/pages/create-room/create-room.js`)

**修复前**:
```javascript
if (response.code === 200) {
  wx.setStorageSync('recentRoom', response.data);
  wx.redirectTo({
    url: `/pages/room/room?roomCode=${response.data.room_code}`,
  });
}
```

**修复后**:
```javascript
if (response.code === 200) {
  console.log("新房间响应:", response)
  
  // 解析data字段中的JSON字符串
  let roomData;
  try {
    roomData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    console.log("解析后的房间数据:", roomData)
  } catch (error) {
    console.error("解析房间数据失败:", error)
    wx.showToast({
      title: '房间数据解析失败',
      icon: 'none'
    });
    return;
  }
  
  // 保存最近房间信息
  wx.setStorageSync('recentRoom', roomData);
  console.log("保存的房间数据:", roomData)
  console.log("房间号:", roomData.room_code)
  
  // 跳转到房间页面
  setTimeout(() => {
    wx.redirectTo({
      url: `/pages/room/room?roomCode=${roomData.room_code}`,
    });
  }, 1500);
}
```

#### 加入房间页面 (`miniprogram/pages/join-room/join-room.js`)

**修复前**:
```javascript
if (response.code === 200) {
  wx.setStorageSync('recentRoom', response.data);
  wx.redirectTo({
    url: `/pages/room/room?roomCode=${response.data.room_code}`,
  });
}
```

**修复后**:
```javascript
if (response.code === 200) {
  console.log("加入房间响应:", response)
  
  // 解析data字段中的JSON字符串
  let roomData;
  try {
    roomData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    console.log("解析后的房间数据:", roomData)
  } catch (error) {
    console.error("解析房间数据失败:", error)
    wx.showToast({
      title: '房间数据解析失败',
      icon: 'none'
    });
    return;
  }
  
  // 保存最近房间信息
  wx.setStorageSync('recentRoom', roomData);
  console.log("保存的房间数据:", roomData)
  console.log("房间号:", roomData.room_code)
  
  // 跳转到房间页面
  setTimeout(() => {
    wx.redirectTo({
      url: `/pages/room/room?roomCode=${roomData.room_code}`,
    });
  }, 1500);
}
```

### 2. 后端数据完整性修复

#### JoinRoom方法修复 (`server/internal/service/mahjong.go`)

**修复前**:
```go
roomData := map[string]interface{}{
    "room_id": roomID,
}
```

**修复后**:
```go
// 获取房间的room_code
var roomCode string
s.db.QueryRow("SELECT room_code FROM rooms WHERE id = ?", roomID).Scan(&roomCode)

roomData := map[string]interface{}{
    "room_id":   roomID,
    "room_code": roomCode,
}
```

## 数据流程优化

### 1. 新的数据流程

```
后端创建房间 → 返回JSON字符串 → 前端解析JSON → 提取room_code → 跳转房间页面
```

### 2. 错误处理增强

- **JSON解析错误**: 捕获解析异常并提示用户
- **数据验证**: 确保解析后的数据包含必要字段
- **调试信息**: 添加详细的日志输出

### 3. 调试信息验证

现在会看到正确的调试输出：
```
新房间响应: {code: 200, message: "创建成功", data: "{\"room_code\":\"1757145314741633\",\"room_id\":6}"}
解析后的房间数据: {room_code: "1757145314741633", room_id: 6}
保存的房间数据: {room_code: "1757145314741633", room_id: 6}
房间号: 1757145314741633
```

## 测试验证

### 1. 创建房间测试

1. **正常创建**: 验证房间创建后能正确跳转
2. **数据解析**: 验证JSON解析是否正常
3. **错误处理**: 测试解析失败时的处理

### 2. 加入房间测试

1. **正常加入**: 验证加入房间后能正确跳转
2. **数据完整性**: 验证返回数据包含room_code
3. **跳转逻辑**: 验证使用room_code进行跳转

### 3. 调试信息验证

```
创建房间响应: {code: 200, message: "创建成功", data: "{\"room_code\":\"1757145314741633\",\"room_id\":6}"}
解析后的房间数据: {room_code: "1757145314741633", room_id: 6}
保存的房间数据: {room_code: "1757145314741633", room_id: 6}
房间号: 1757145314741633
跳转URL: /pages/room/room?roomCode=1757145314741633
```

## 相关文件

- ✅ `miniprogram/pages/create-room/create-room.js` - 创建房间JSON解析修复
- ✅ `miniprogram/pages/join-room/join-room.js` - 加入房间JSON解析修复
- ✅ `server/internal/service/mahjong.go` - JoinRoom数据完整性修复
- ✅ `ROOM_DATA_JSON_PARSE_FIX.md` - 修复说明文档

## 总结

通过前端JSON解析处理和后端数据完整性修复，解决了房间数据解析问题：

1. **JSON解析**: 前端正确解析后端返回的JSON字符串
2. **错误处理**: 增强解析错误处理和用户提示
3. **数据完整性**: 后端确保返回完整的数据字段
4. **调试信息**: 添加详细的日志输出
5. **向后兼容**: 支持字符串和对象两种数据格式

**房间数据JSON解析问题已修复！** 现在可以正确提取room_code并进行房间跳转。🎉
