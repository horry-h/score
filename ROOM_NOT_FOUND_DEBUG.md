# 房间不存在问题调试

## 问题描述

房间页面能正确接收到`roomCode`参数，但API调用时返回"房间不存在"错误：

```
房间页面onLoad，接收到的参数: {roomCode: "1757146398754523"}
roomCode值: 1757146398754523 类型: string
使用roomCode进入房间: 1757146398754523
loadRoomData开始，当前roomCode: 1757146398754523
加载房间数据失败: Error: 房间不存在
```

## 问题分析

### 1. 数据流程

```
创建房间 → 返回roomCode → 前端跳转 → API调用getRoom → 后端查询数据库 → 返回"房间不存在"
```

### 2. 可能的原因

1. **数据库中没有该房间**: 房间创建失败或数据未正确保存
2. **roomCode格式问题**: 数据库中的roomCode格式与查询的不匹配
3. **API参数传递问题**: 前端传递的参数格式不正确
4. **后端查询逻辑问题**: 后端查询条件有误

## 调试方案

### 1. 前端调试信息增强

#### 房间页面调试 (`miniprogram/pages/room/room.js`)

```javascript
// 添加详细的调试信息
console.log('开始加载房间数据，roomId:', this.data.roomId, 'roomCode:', this.data.roomCode);
console.log('调用api.getRoom，参数:', { roomId: this.data.roomId, roomCode: this.data.roomCode });
const roomResponse = await api.getRoom(this.data.roomId, this.data.roomCode);
console.log('getRoom响应:', roomResponse);
```

#### API调用调试 (`miniprogram/utils/api.js`)

```javascript
async getRoom(roomId, roomCode) {
  const params = roomId ? `room_id=${roomId}` : `room_code=${roomCode}`;
  const url = `/api/v1/getRoom?${params}`;
  console.log('getRoom API调用:', { roomId, roomCode, params, url });
  return this.request(url);
}
```

### 2. 数据库验证脚本

#### 房间数据检查脚本 (`check-room.sh`)

```bash
#!/bin/bash
# 检查房间数据
# 用法: ./check-room.sh [room_code]

ROOM_CODE=${1:-"1757146398754523"}

echo "检查房间数据: $ROOM_CODE"

# 数据库配置
DB_HOST="localhost"
DB_USER="root"
DB_PASS="123456"
DB_NAME="mahjong_score"

# 查询房间信息
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" << EOF
-- 查询指定房间
SELECT '指定房间信息:' as info;
SELECT id, room_code, room_name, creator_id, status, created_at 
FROM rooms 
WHERE room_code = '$ROOM_CODE';

-- 查询最近的房间
SELECT '最近的房间:' as info;
SELECT id, room_code, room_name, creator_id, status, created_at 
FROM rooms 
ORDER BY id DESC 
LIMIT 5;

-- 统计房间数量
SELECT '房间统计:' as info;
SELECT COUNT(*) as total_rooms FROM rooms;
SELECT COUNT(*) as rooms_with_code FROM rooms WHERE room_code IS NOT NULL AND room_code != '';
EOF
```

### 3. 后端调试信息

#### GetRoom方法调试 (`server/internal/service/mahjong.go`)

```go
func (s *MahjongService) GetRoom(ctx context.Context, req *GetRoomRequest) (*Response, error) {
    var query string
    var args []interface{}
    
    if req.RoomId > 0 {
        query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE id = ?"
        args = []interface{}{req.RoomId}
        log.Printf("查询房间ID: %d", req.RoomId)
    } else {
        query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE room_code = ?"
        args = []interface{}{req.RoomCode}
        log.Printf("查询房间Code: %s", req.RoomCode)
    }

    room := &Room{}
    err := s.db.QueryRow(query, args...).Scan(
        &room.Id, &room.RoomCode, &room.RoomName, &room.CreatorId, 
        &room.Status, &room.CreatedAt, &room.SettledAt,
    )
    
    if err != nil {
        log.Printf("房间查询失败: %v, 查询条件: %v", err, args)
        return &Response{Code: 404, Message: "房间不存在"}, nil
    }

    log.Printf("找到房间: ID=%d, Code=%s", room.Id, room.RoomCode)
    // ... 其余代码
}
```

## 排查步骤

### 1. 检查数据库数据

```bash
# 在服务器上执行
./check-room.sh 1757146398754523
```

### 2. 检查前端API调用

查看控制台输出：
```
getRoom API调用: {roomId: null, roomCode: "1757146398754523", params: "room_code=1757146398754523", url: "/api/v1/getRoom?room_code=1757146398754523"}
```

### 3. 检查后端日志

查看服务器日志：
```
查询房间Code: 1757146398754523
房间查询失败: sql: no rows in result set, 查询条件: [1757146398754523]
```

### 4. 验证房间创建

检查房间创建是否成功：
```bash
# 查看最近的房间
./check-room.sh
```

## 可能的解决方案

### 1. 数据库数据问题

如果数据库中没有该房间：
```sql
-- 检查房间创建是否成功
SELECT * FROM rooms ORDER BY id DESC LIMIT 5;

-- 检查是否有room_code为空的房间
SELECT * FROM rooms WHERE room_code IS NULL OR room_code = '';
```

### 2. roomCode格式问题

如果roomCode格式不匹配：
```sql
-- 检查roomCode的实际格式
SELECT id, room_code, LENGTH(room_code) as code_length 
FROM rooms 
WHERE room_code LIKE '%1757146398754523%';
```

### 3. API参数问题

如果API参数传递有问题，检查：
- 前端传递的参数类型
- URL编码是否正确
- 后端接收的参数格式

## 相关文件

- ✅ `miniprogram/pages/room/room.js` - 房间页面调试信息
- ✅ `miniprogram/utils/api.js` - API调用调试信息
- ✅ `check-room.sh` - 数据库检查脚本
- ✅ `ROOM_NOT_FOUND_DEBUG.md` - 调试说明文档

## 下一步

1. **运行检查脚本**: `./check-room.sh 1757146398754523`
2. **查看前端日志**: 检查API调用参数
3. **查看后端日志**: 检查数据库查询结果
4. **验证房间创建**: 确认房间是否成功创建

**需要根据调试结果确定具体的问题原因和解决方案。** 🔍
