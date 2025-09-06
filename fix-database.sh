#!/bin/bash

# 修复数据库中的room_code问题
# 为没有room_code的旧房间生成新的room_code

echo "开始修复数据库中的room_code问题..."

# 数据库配置
DB_HOST="localhost"
DB_USER="root"
DB_PASS="123456"
DB_NAME="mahjong_score"

# 执行修复SQL
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" << EOF
-- 修复没有room_code的旧房间数据
UPDATE rooms 
SET room_code = CONCAT(
    UNIX_TIMESTAMP(created_at) * 1000,  -- 13位时间戳
    LPAD(FLOOR(RAND() * 1000), 3, '0')  -- 3位随机数
)
WHERE room_code IS NULL OR room_code = '' OR room_code = 'undefined';

-- 检查修复结果
SELECT '修复后的房间数据:' as info;
SELECT id, room_code, room_name, created_at 
FROM rooms 
ORDER BY id DESC 
LIMIT 10;
EOF

echo "数据库修复完成！"
