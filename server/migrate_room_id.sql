-- 房间号迁移脚本
-- 将rooms表的room_code字段长度扩展，支持包含时间戳的唯一字符串

-- 1. 备份现有数据（可选）
-- CREATE TABLE rooms_backup AS SELECT * FROM rooms;

-- 2. 修改rooms表结构，扩展room_code字段长度
ALTER TABLE rooms MODIFY COLUMN room_code VARCHAR(20) NOT NULL UNIQUE COMMENT '房间号（包含时间戳的唯一字符串）';

-- 3. 更新现有房间的room_code（如果需要）
-- 注意：这个操作需要谨慎，因为会改变现有的房间号
-- 建议在测试环境中先验证

-- 示例：为现有房间生成新的时间戳房间号
-- UPDATE rooms SET room_code = CONCAT(UNIX_TIMESTAMP(created_at) * 1000, LPAD(id % 1000, 3, '0')) WHERE LENGTH(room_code) = 6;
