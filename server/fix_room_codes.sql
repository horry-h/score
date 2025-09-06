-- 修复没有room_code的旧房间数据
-- 为所有room_code为NULL或空的房间生成新的room_code

UPDATE rooms 
SET room_code = CONCAT(
    UNIX_TIMESTAMP(created_at) * 1000,  -- 13位时间戳
    LPAD(FLOOR(RAND() * 1000), 3, '0')  -- 3位随机数
)
WHERE room_code IS NULL OR room_code = '' OR room_code = 'undefined';

-- 检查修复结果
SELECT id, room_code, room_name, created_at 
FROM rooms 
ORDER BY id DESC 
LIMIT 10;
