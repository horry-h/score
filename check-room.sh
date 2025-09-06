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

echo "查询完成！"
