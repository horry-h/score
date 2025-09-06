#!/bin/bash

# 创建测试数据
echo "创建测试数据..."

# 数据库配置
DB_HOST="localhost"
DB_USER="root"
DB_PASS="123456"
DB_NAME="mahjong_score"

# 创建测试数据
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" << EOF
-- 创建测试用户
INSERT IGNORE INTO users (id, openid, nickname, avatar_url, created_at, updated_at) 
VALUES (1, 'test_openid_001', '测试用户1', 'https://example.com/avatar1.jpg', NOW(), NOW());

-- 创建测试房间
INSERT IGNORE INTO rooms (id, room_code, room_name, creator_id, status, created_at) 
VALUES (1, '1757145314741633', '测试房间1', 1, 1, NOW());

-- 创建房间玩家
INSERT IGNORE INTO room_players (id, room_id, user_id, current_score, created_at, updated_at) 
VALUES (1, 1, 1, 0, NOW(), NOW());

-- 创建用户最近房间
INSERT IGNORE INTO user_recent_rooms (id, user_id, room_id, last_accessed_at) 
VALUES (1, 1, 1, NOW());

-- 验证数据
SELECT '创建的数据:' as info;
SELECT '用户:' as type, id, nickname, openid FROM users WHERE id = 1;
SELECT '房间:' as type, id, room_code, room_name, creator_id, status FROM rooms WHERE id = 1;
SELECT '房间玩家:' as type, id, room_id, user_id, current_score FROM room_players WHERE id = 1;
SELECT '最近房间:' as type, id, user_id, room_id FROM user_recent_rooms WHERE id = 1;
EOF

echo "测试数据创建完成！"
