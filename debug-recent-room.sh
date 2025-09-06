#!/bin/bash

# 调试最近房间查询问题
# 用法: ./debug-recent-room.sh [user_id]

USER_ID=${1:-20}

echo "调试最近房间查询，用户ID: $USER_ID"

# 数据库配置
DB_HOST="localhost"
DB_USER="root"
DB_PASS="123456"
DB_NAME="mahjong_score"

# 调试查询
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" << EOF
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

-- 检查表结构
SELECT 'user_recent_rooms表结构:' as info;
DESCRIBE user_recent_rooms;

SELECT 'rooms表结构:' as info;
DESCRIBE rooms;

SELECT 'room_players表结构:' as info;
DESCRIBE room_players;
EOF

echo "调试完成！"
