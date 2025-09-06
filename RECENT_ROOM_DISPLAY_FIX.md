# 最近房间显示字段修复

## 问题描述

首页最近房间没有展示房间号，显示为空白。

## 问题分析

### 1. 根本原因

**字段名不匹配**: 前端模板中使用的字段名与后端返回的字段名不一致。

**前端模板使用**:
```html
<text class="room-id">房间号: {{recentRoom.roomId}}</text>
<text class="time-text">{{recentRoom.time}}</text>
<text class="score-text">{{recentRoom.score}}分</text>
<text class="stats-text">{{recentRoom.playerCount}}人参与</text>
<text class="stats-text">{{recentRoom.transferCount}}次转移</text>
```

**后端返回字段**:
```go
type RecentRoom struct {
    RoomId         int64  `json:"room_id"`
    RoomCode       string `json:"room_code"`
    RoomName       string `json:"room_name"`
    Status         int32  `json:"status"`
    LastAccessedAt int64  `json:"last_accessed_at"`
    CurrentScore   int32  `json:"current_score"`
    PlayerCount    int32  `json:"player_count"`
    TransferCount  int32  `json:"transfer_count"`
}
```

### 2. 字段映射问题

| 前端模板字段 | 后端实际字段 | 说明 |
|-------------|-------------|------|
| `roomId` | `room_id` | 房间号显示（数据库主键） |
| `time` | `room_name` | 房间名称 |
| `score` | `current_score` | 当前分数 |
| `playerCount` | `player_count` | 玩家数量 |
| `transferCount` | `transfer_count` | 转移次数 |

## 修复方案

### 1. 修复房间号显示

#### 修复前
```html
<text class="room-id">房间号: {{recentRoom.roomId}}</text>
```

#### 修复后
```html
<text class="room-id">房间号: {{recentRoom.room_id}}</text>
```

### 2. 修复房间名称显示

#### 修复前
```html
<text class="time-text">{{recentRoom.time}}</text>
```

#### 修复后
```html
<text class="time-text">{{recentRoom.room_name}}</text>
```

### 3. 修复分数显示

#### 修复前
```html
<text class="score-text {{recentRoom.score > 0 ? 'positive' : 'negative'}}">
  {{recentRoom.score > 0 ? '+' : ''}}{{recentRoom.score}}分
</text>
```

#### 修复后
```html
<text class="score-text {{recentRoom.current_score > 0 ? 'positive' : 'negative'}}">
  {{recentRoom.current_score > 0 ? '+' : ''}}{{recentRoom.current_score}}分
</text>
```

### 4. 修复统计信息显示

#### 修复前
```html
<text class="stats-text">{{recentRoom.playerCount}}人参与</text>
<text class="stats-text">{{recentRoom.transferCount}}次转移</text>
```

#### 修复后
```html
<text class="stats-text">{{recentRoom.player_count}}人参与</text>
<text class="stats-text">{{recentRoom.transfer_count}}次转移</text>
```

## 修复效果

### 修复前
```
房间号: (空白)
📅 (空白)
💰 0分
👥 0人参与 | 🔄 0次转移
```

### 修复后
```
房间号: 1
📅 999
💰 0分
👥 1人参与 | 🔄 0次转移
```

## 数据流程

```
后端GetRecentRoom → JSON字符串 → 前端解析 → 正确字段名 → 模板显示
```

## 相关文件

- ✅ `miniprogram/pages/index/index.wxml` - 最近房间显示模板修复
- ✅ `RECENT_ROOM_DISPLAY_FIX.md` - 修复说明文档

## 总结

通过修复前端模板中的字段名，解决了最近房间显示问题：

1. **字段映射**: 统一前后端字段名
2. **数据显示**: 房间号、名称、分数、统计信息正常显示
3. **用户体验**: 用户可以清楚看到最近房间的详细信息
4. **数据一致性**: 前后端数据结构保持一致

**最近房间显示问题已修复！** 现在可以正常显示房间号和其他信息。🎉
