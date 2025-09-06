-- 麻将记分小程序数据库设计
-- 创建数据库
CREATE DATABASE IF NOT EXISTS mahjong_score DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mahjong_score;

-- 用户表
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    openid VARCHAR(64) NOT NULL UNIQUE COMMENT '微信openid',
    nickname VARCHAR(50) NOT NULL DEFAULT '' COMMENT '用户昵称',
    avatar_url VARCHAR(255) DEFAULT '' COMMENT '头像URL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 房间表
CREATE TABLE rooms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_code VARCHAR(20) NOT NULL UNIQUE COMMENT '房间号（包含时间戳的唯一字符串）',
    room_name VARCHAR(100) DEFAULT '' COMMENT '房间名称',
    creator_id BIGINT NOT NULL COMMENT '创建者ID',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '房间状态：1-进行中，2-已结算',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP NULL COMMENT '结算时间',
    INDEX idx_room_code (room_code),
    INDEX idx_creator_id (creator_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间表';

-- 房间玩家表
CREATE TABLE room_players (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id BIGINT NOT NULL COMMENT '房间ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    current_score INT NOT NULL DEFAULT 0 COMMENT '当前分数',
    final_score INT DEFAULT NULL COMMENT '最终分数',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
    UNIQUE KEY uk_room_user (room_id, user_id),
    INDEX idx_room_id (room_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间玩家表';

-- 分数转移记录表
CREATE TABLE score_transfers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id BIGINT NOT NULL COMMENT '房间ID',
    from_user_id BIGINT NOT NULL COMMENT '转出用户ID',
    to_user_id BIGINT NOT NULL COMMENT '转入用户ID',
    amount INT NOT NULL COMMENT '转移分数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_room_id (room_id),
    INDEX idx_from_user (from_user_id),
    INDEX idx_to_user (to_user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分数转移记录表';

-- 结算记录表
CREATE TABLE settlements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id BIGINT NOT NULL COMMENT '房间ID',
    from_user_id BIGINT NOT NULL COMMENT '转出用户ID',
    to_user_id BIGINT NOT NULL COMMENT '转入用户ID',
    amount INT NOT NULL COMMENT '结算分数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_room_id (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='结算记录表';

-- 用户最近房间表（用于快速访问）
CREATE TABLE user_recent_rooms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    room_id BIGINT NOT NULL COMMENT '房间ID',
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后访问时间',
    UNIQUE KEY uk_user_room (user_id, room_id),
    INDEX idx_user_id (user_id),
    INDEX idx_last_accessed (last_accessed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户最近房间表';
