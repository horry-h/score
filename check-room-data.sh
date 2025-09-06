#!/bin/bash

# 检查房间数据
echo "检查房间数据..."

# 数据库配置
DB_HOST="localhost"
DB_USER="root"
DB_PASS="123456"
DB_NAME="mahjong_score"

# 检查房间数据
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" << EOF
-- 检查所有房间
SELECT '所有房间:' as info;
SELECT id, room_code, room_name, creator_id, status, created_at 
FROM rooms 
ORDER BY id;

-- 检查房间玩家
SELECT '房间玩家:' as info;
SELECT * FROM room_players 
ORDER BY id;

-- 检查用户最近房间
SELECT '用户最近房间:' as info;
SELECT * FROM user_recent_rooms 
ORDER BY id;

-- 检查用户数据
SELECT '用户数据:' as info;
SELECT id, nickname, openid, created_at 
FROM users 
ORDER BY id;

-- 统计信息
SELECT '统计信息:' as info;
SELECT 
    (SELECT COUNT(*) FROM users) as user_count,
    (SELECT COUNT(*) FROM rooms) as room_count,
    (SELECT COUNT(*) FROM room_players) as player_count,
    (SELECT COUNT(*) FROM user_recent_rooms) as recent_room_count;
EOF

echo "房间数据检查完成！"
