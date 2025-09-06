# 房间号输入修复 - 支持任意长度的room_id

## 问题描述

之前的实现中，房间号输入被限制为6位数字，但实际上房间号应该是`rooms`表的主键`room_id`，不一定是6位数字。

## 修复内容

### 1. 前端修复

#### 修改输入框限制
**文件**: `miniprogram/pages/join-room/join-room.wxml`

```html
<!-- 修复前 -->
<input type="text" placeholder="请输入6位房间号" maxlength="6" value="{{roomCode}}" bindinput="onRoomCodeInput" />

<!-- 修复后 -->
<input type="number" placeholder="请输入房间号" value="{{roomCode}}" bindinput="onRoomCodeInput" />
```

#### 修改验证逻辑
**文件**: `miniprogram/pages/join-room/join-room.js`

```javascript
// 修复前
if (!roomCode || roomCode.length !== 6) {
  wx.showToast({
    title: '请输入6位房间号',
    icon: 'none'
  });
  return;
}

// 修复后
if (!roomCode || roomCode.trim() === '') {
  wx.showToast({
    title: '请输入房间号',
    icon: 'none'
  });
  return;
}

// 验证房间号是否为有效数字
const roomId = parseInt(roomCode);
if (isNaN(roomId) || roomId <= 0) {
  wx.showToast({
    title: '请输入有效的房间号',
    icon: 'none'
  });
  return;
}
```

#### 修改API调用
**文件**: `miniprogram/utils/api.js`

```javascript
// 修复前
async joinRoom(userId, roomCode) {
  return this.request('/api/v1/joinRoom', {
    method: 'POST',
    data: {
      user_id: userId,
      room_code: roomCode,
    },
  });
}

// 修复后
async joinRoom(userId, roomId) {
  return this.request('/api/v1/joinRoom', {
    method: 'POST',
    data: {
      user_id: userId,
      room_id: roomId,
    },
  });
}
```

#### 支持roomId参数
**文件**: `miniprogram/pages/join-room/join-room.js`

```javascript
onLoad(options) {
  // 如果从分享链接进入，自动填入房间号
  if (options.roomCode) {
    this.setData({
      roomCode: options.roomCode,
    });
  }
  // 如果从其他页面传入roomId，也自动填入
  if (options.roomId) {
    this.setData({
      roomCode: options.roomId,
    });
  }
}
```

### 2. 后端修复

#### 修改请求结构
**文件**: `server/internal/service/types.go`

```go
// 修复前
type JoinRoomRequest struct {
	UserId   int64  `json:"user_id"`
	RoomCode string `json:"room_code"`
}

// 修复后
type JoinRoomRequest struct {
	UserId int64 `json:"user_id"`
	RoomId int64 `json:"room_id"`
}
```

#### 修改数据库查询
**文件**: `server/internal/service/mahjong.go`

```go
// 修复前
err := s.db.QueryRow(`
    SELECT id, status FROM rooms WHERE room_code = ?
`, req.RoomCode).Scan(&roomID, &status)

// 修复后
err := s.db.QueryRow(`
    SELECT id, status FROM rooms WHERE id = ?
`, req.RoomId).Scan(&roomID, &status)
```

## 修复效果

### 输入验证改进

#### 修复前
- ❌ 限制为6位数字
- ❌ 使用`room_code`（长字符串）
- ❌ 输入体验不友好

#### 修复后
- ✅ 支持任意长度的数字房间号
- ✅ 使用`room_id`（主键）
- ✅ 数字键盘输入体验更好
- ✅ 验证逻辑更合理

### 数据一致性

#### 修复前
- ❌ 前端使用`room_code`，后端查询`room_code`
- ❌ 数据流不一致

#### 修复后
- ✅ 前端使用`room_id`，后端查询`room_id`
- ✅ 数据流完全一致
- ✅ 与数据库主键直接对应

### 用户体验提升

#### 修复前
- ❌ 必须输入6位数字
- ❌ 输入错误提示不明确
- ❌ 不支持从其他页面传入`roomId`

#### 修复后
- ✅ 支持任意长度的房间号
- ✅ 清晰的错误提示
- ✅ 支持多种参数传入方式
- ✅ 数字键盘输入更便捷

## 相关文件

- ✅ `miniprogram/pages/join-room/join-room.wxml` - 输入框修改
- ✅ `miniprogram/pages/join-room/join-room.js` - 验证逻辑修改
- ✅ `miniprogram/utils/api.js` - API调用修改
- ✅ `server/internal/service/types.go` - 请求结构修改
- ✅ `server/internal/service/mahjong.go` - 数据库查询修改
- ✅ `ROOM_ID_INPUT_FIX.md` - 修复说明文档

## 测试建议

1. **输入测试**
   - 输入1位数字房间号
   - 输入多位数字房间号
   - 输入非数字字符
   - 输入负数或0

2. **参数传递测试**
   - 通过`roomCode`参数进入
   - 通过`roomId`参数进入
   - 直接输入房间号

3. **后端API测试**
   - 测试`POST /api/v1/joinRoom`接口
   - 验证`room_id`参数处理
   - 验证数据库查询正确性

## 总结

通过这次修复，实现了：

1. **灵活性**: 支持任意长度的房间号输入
2. **一致性**: 前后端都使用`room_id`（主键）
3. **用户体验**: 数字键盘输入，清晰的验证提示
4. **兼容性**: 支持多种参数传入方式

**房间号输入修复完成！** 现在支持任意长度的`room_id`输入。🔢✨
