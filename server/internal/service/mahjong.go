package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"
)

type MahjongService struct {
	db          *sql.DB
	wechatService *WeChatService
}

func NewMahjongService(db *sql.DB, wechatService *WeChatService) *MahjongService {
	return &MahjongService{
		db:            db,
		wechatService: wechatService,
	}
}

// 用户登录
func (s *MahjongService) Login(ctx context.Context, req *LoginRequest) (*Response, error) {
	// 通过微信code获取openid
	wechatResp, err := s.wechatService.GetOpenID(req.Code)
	if err != nil {
		return &Response{Code: 500, Message: "获取微信用户信息失败: " + err.Error()}, nil
	}
	
	openid := wechatResp.OpenID
	if openid == "" {
		return &Response{Code: 500, Message: "获取openid失败"}, nil
	}
	
	// 检查用户是否存在
	var userID int64
	err = s.db.QueryRow("SELECT id FROM users WHERE openid = ?", openid).Scan(&userID)
	
	if err == sql.ErrNoRows {
		// 创建新用户
		result, err := s.db.Exec(`
			INSERT INTO users (openid, nickname, avatar_url) 
			VALUES (?, ?, ?)
		`, openid, req.Nickname, req.AvatarUrl)
		if err != nil {
			return &Response{Code: 500, Message: "创建用户失败"}, nil
		}
		userID, _ = result.LastInsertId()
	} else if err != nil {
		return &Response{Code: 500, Message: "查询用户失败"}, nil
	} else {
		// 用户已存在，更新用户信息
		_, err = s.db.Exec(`
			UPDATE users SET nickname = ?, avatar_url = ?, updated_at = NOW() 
			WHERE id = ?
		`, req.Nickname, req.AvatarUrl, userID)
		if err != nil {
			return &Response{Code: 500, Message: "更新用户信息失败"}, nil
		}
	}

	// 获取用户信息
	user := &User{}
	var createdAt, updatedAt time.Time
	err = s.db.QueryRow(`
		SELECT id, openid, nickname, avatar_url, created_at, updated_at 
		FROM users WHERE id = ?
	`, userID).Scan(&user.Id, &user.Openid, &user.Nickname, &user.AvatarUrl, &createdAt, &updatedAt)
	
	if err != nil {
		return &Response{Code: 500, Message: "获取用户信息失败"}, nil
	}
	
	user.CreatedAt = createdAt.Unix()
	user.UpdatedAt = updatedAt.Unix()

	// 生成自定义登录态
	customSession := s.wechatService.GenerateCustomSession(userID, openid)
	
	// 创建登录响应数据
	loginData := map[string]interface{}{
		"user":       user,
		"session_id": customSession.SessionID,
		"expires_at": customSession.ExpiresAt.Unix(),
	}
	
	userData, _ := json.Marshal(loginData)
	return &Response{Code: 200, Message: "登录成功", Data: string(userData)}, nil
}

// 更新用户信息
func (s *MahjongService) UpdateUser(ctx context.Context, req *UpdateUserRequest) (*Response, error) {
	_, err := s.db.Exec(`
		UPDATE users SET nickname = ?, avatar_url = ?, updated_at = NOW() 
		WHERE id = ?
	`, req.Nickname, req.AvatarUrl, req.UserId)
	
	if err != nil {
		return &Response{Code: 500, Message: "更新用户信息失败"}, nil
	}

	return &Response{Code: 200, Message: "更新成功"}, nil
}

// 验证登录态
func (s *MahjongService) ValidateSession(ctx context.Context, sessionID string) (*Response, error) {
	if sessionID == "" {
		return &Response{Code: 401, Message: "未登录"}, nil
	}
	
	// 验证自定义登录态
	customSession, err := s.wechatService.ValidateCustomSession(sessionID)
	if err != nil {
		return &Response{Code: 401, Message: "登录态无效"}, nil
	}
	
	// 检查是否过期
	if time.Now().After(customSession.ExpiresAt) {
		return &Response{Code: 401, Message: "登录态已过期"}, nil
	}
	
	// 获取用户信息
	user := &User{}
	var createdAt, updatedAt time.Time
	err = s.db.QueryRow(`
		SELECT id, openid, nickname, avatar_url, created_at, updated_at 
		FROM users WHERE id = ?
	`, customSession.UserID).Scan(&user.Id, &user.Openid, &user.Nickname, &user.AvatarUrl, &createdAt, &updatedAt)
	
	if err != nil {
		return &Response{Code: 404, Message: "用户不存在"}, nil
	}
	
	user.CreatedAt = createdAt.Unix()
	user.UpdatedAt = updatedAt.Unix()
	
	userData, _ := json.Marshal(user)
	return &Response{Code: 200, Message: "验证成功", Data: string(userData)}, nil
}

// 获取用户信息
func (s *MahjongService) GetUser(ctx context.Context, req *GetUserRequest) (*Response, error) {
	user := &User{}
	var createdAt, updatedAt time.Time
	err := s.db.QueryRow(`
		SELECT id, openid, nickname, avatar_url, created_at, updated_at 
		FROM users WHERE id = ?
	`, req.UserId).Scan(&user.Id, &user.Openid, &user.Nickname, &user.AvatarUrl, &createdAt, &updatedAt)
	
	if err != nil {
		return &Response{Code: 404, Message: "用户不存在"}, nil
	}
	
	user.CreatedAt = createdAt.Unix()
	user.UpdatedAt = updatedAt.Unix()

	userData, _ := json.Marshal(user)
	return &Response{Code: 200, Message: "获取成功", Data: string(userData)}, nil
}

// 创建房间
func (s *MahjongService) CreateRoom(ctx context.Context, req *CreateRoomRequest) (*Response, error) {
	// 生成唯一的房间号（包含时间戳的字符串）
	roomCode := s.generateUniqueRoomCode()
	
	// 创建房间
	result, err := s.db.Exec(`
		INSERT INTO rooms (room_code, room_name, creator_id) 
		VALUES (?, ?, ?)
	`, roomCode, req.RoomName, req.CreatorId)
	
	if err != nil {
		return &Response{Code: 500, Message: "创建房间失败"}, nil
	}
	
	roomID, _ := result.LastInsertId()
	
	// 创建者加入房间
	_, err = s.db.Exec(`
		INSERT INTO room_players (room_id, user_id) 
		VALUES (?, ?)
	`, roomID, req.CreatorId)
	
	if err != nil {
		return &Response{Code: 500, Message: "加入房间失败"}, nil
	}

	// 更新用户最近房间
	s.updateRecentRoom(req.CreatorId, roomID)

	roomData := map[string]interface{}{
		"room_id":   roomID,
		"room_code": roomCode,
	}
	
	data, _ := json.Marshal(roomData)
	return &Response{Code: 200, Message: "创建成功", Data: string(data)}, nil
}

// 加入房间
func (s *MahjongService) JoinRoom(ctx context.Context, req *JoinRoomRequest) (*Response, error) {
	// 获取房间信息
	var roomID int64
	var status int
	err := s.db.QueryRow(`
		SELECT id, status FROM rooms WHERE room_code = ?
	`, req.RoomCode).Scan(&roomID, &status)
	
	if err == sql.ErrNoRows {
		return &Response{Code: 404, Message: "房间不存在"}, nil
	} else if err != nil {
		return &Response{Code: 500, Message: "查询房间失败"}, nil
	}

	if status != 1 {
		return &Response{Code: 400, Message: "房间已结算"}, nil
	}

	// 检查是否已经在房间中
	var exists int
	s.db.QueryRow(`
		SELECT COUNT(*) FROM room_players 
		WHERE room_id = ? AND user_id = ?
	`, roomID, req.UserId).Scan(&exists)
	
	if exists > 0 {
		return &Response{Code: 400, Message: "已在房间中"}, nil
	}

	// 加入房间
	_, err = s.db.Exec(`
		INSERT INTO room_players (room_id, user_id) 
		VALUES (?, ?)
	`, roomID, req.UserId)
	
	if err != nil {
		return &Response{Code: 500, Message: "加入房间失败"}, nil
	}

	// 更新用户最近房间
	s.updateRecentRoom(req.UserId, roomID)

	roomData := map[string]interface{}{
		"room_id": roomID,
	}
	
	data, _ := json.Marshal(roomData)
	return &Response{Code: 200, Message: "加入成功", Data: string(data)}, nil
}

// 获取房间信息
func (s *MahjongService) GetRoom(ctx context.Context, req *GetRoomRequest) (*Response, error) {
	var query string
	var args []interface{}
	
	if req.RoomId > 0 {
		query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE id = ?"
		args = []interface{}{req.RoomId}
	} else {
		query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE room_code = ?"
		args = []interface{}{req.RoomCode}
	}

	room := &Room{}
	err := s.db.QueryRow(query, args...).Scan(
		&room.Id, &room.RoomCode, &room.RoomName, &room.CreatorId, 
		&room.Status, &room.CreatedAt, &room.SettledAt,
	)
	
	if err != nil {
		return &Response{Code: 404, Message: "房间不存在"}, nil
	}

	// 获取房间玩家
	players, err := s.getRoomPlayers(room.Id)
	if err != nil {
		return &Response{Code: 500, Message: "获取玩家信息失败"}, nil
	}
	room.Players = players

	roomData, _ := json.Marshal(room)
	return &Response{Code: 200, Message: "获取成功", Data: string(roomData)}, nil
}

// 获取房间玩家
func (s *MahjongService) GetRoomPlayers(ctx context.Context, req *GetRoomPlayersRequest) (*Response, error) {
	players, err := s.getRoomPlayers(req.RoomId)
	if err != nil {
		return &Response{Code: 500, Message: "获取玩家信息失败"}, nil
	}

	playersData, _ := json.Marshal(players)
	return &Response{Code: 200, Message: "获取成功", Data: string(playersData)}, nil
}

// 获取房间转移记录
func (s *MahjongService) GetRoomTransfers(ctx context.Context, req *GetRoomTransfersRequest) (*Response, error) {
	rows, err := s.db.Query(`
		SELECT st.id, st.room_id, st.from_user_id, st.to_user_id, st.amount, st.created_at,
		       u1.nickname as from_user_name, u2.nickname as to_user_name
		FROM score_transfers st
		LEFT JOIN users u1 ON st.from_user_id = u1.id
		LEFT JOIN users u2 ON st.to_user_id = u2.id
		WHERE st.room_id = ?
		ORDER BY st.created_at DESC
	`, req.RoomId)
	
	if err != nil {
		return &Response{Code: 500, Message: "查询转移记录失败"}, nil
	}
	defer rows.Close()

	var transfers []*ScoreTransfer
	for rows.Next() {
		transfer := &ScoreTransfer{}
		err := rows.Scan(
			&transfer.Id, &transfer.RoomId, &transfer.FromUserId, &transfer.ToUserId,
			&transfer.Amount, &transfer.CreatedAt, &transfer.FromUserName, &transfer.ToUserName,
		)
		if err != nil {
			continue
		}
		transfers = append(transfers, transfer)
	}

	transfersData, _ := json.Marshal(transfers)
	return &Response{Code: 200, Message: "获取成功", Data: string(transfersData)}, nil
}

// 转移分数
func (s *MahjongService) TransferScore(ctx context.Context, req *TransferScoreRequest) (*Response, error) {
	// 开始事务
	tx, err := s.db.Begin()
	if err != nil {
		return &Response{Code: 500, Message: "开始事务失败"}, nil
	}
	defer tx.Rollback()

	// 检查转出用户分数是否足够
	var fromScore int32
	err = tx.QueryRow(`
		SELECT current_score FROM room_players 
		WHERE room_id = ? AND user_id = ?
	`, req.RoomId, req.FromUserId).Scan(&fromScore)
	
	if err != nil {
		return &Response{Code: 404, Message: "转出用户不在房间中"}, nil
	}

	if fromScore < req.Amount {
		return &Response{Code: 400, Message: "分数不足"}, nil
	}

	// 更新转出用户分数
	_, err = tx.Exec(`
		UPDATE room_players 
		SET current_score = current_score - ? 
		WHERE room_id = ? AND user_id = ?
	`, req.Amount, req.RoomId, req.FromUserId)
	
	if err != nil {
		return &Response{Code: 500, Message: "更新转出用户分数失败"}, nil
	}

	// 更新转入用户分数
	_, err = tx.Exec(`
		UPDATE room_players 
		SET current_score = current_score + ? 
		WHERE room_id = ? AND user_id = ?
	`, req.Amount, req.RoomId, req.ToUserId)
	
	if err != nil {
		return &Response{Code: 500, Message: "更新转入用户分数失败"}, nil
	}

	// 记录转移
	_, err = tx.Exec(`
		INSERT INTO score_transfers (room_id, from_user_id, to_user_id, amount) 
		VALUES (?, ?, ?, ?)
	`, req.RoomId, req.FromUserId, req.ToUserId, req.Amount)
	
	if err != nil {
		return &Response{Code: 500, Message: "记录转移失败"}, nil
	}

	// 提交事务
	if err = tx.Commit(); err != nil {
		return &Response{Code: 500, Message: "提交事务失败"}, nil
	}

	return &Response{Code: 200, Message: "转移成功"}, nil
}

// 结算房间
func (s *MahjongService) SettleRoom(ctx context.Context, req *SettleRoomRequest) (*Response, error) {
	// 开始事务
	tx, err := s.db.Begin()
	if err != nil {
		return &Response{Code: 500, Message: "开始事务失败"}, nil
	}
	defer tx.Rollback()

	// 获取所有玩家分数
	rows, err := tx.Query(`
		SELECT rp.user_id, rp.current_score, u.nickname
		FROM room_players rp
		LEFT JOIN users u ON rp.user_id = u.id
		WHERE rp.room_id = ?
	`, req.RoomId)
	
	if err != nil {
		return &Response{Code: 500, Message: "获取玩家分数失败"}, nil
	}
	defer rows.Close()

	var players []struct {
		UserID   int64
		Score    int32
		Nickname string
	}
	
	for rows.Next() {
		var player struct {
			UserID   int64
			Score    int32
			Nickname string
		}
		rows.Scan(&player.UserID, &player.Score, &player.Nickname)
		players = append(players, player)
	}

	// 计算最优转账方案
	settlements := s.calculateOptimalSettlement(players)

	// 记录结算
	for _, settlement := range settlements {
		_, err = tx.Exec(`
			INSERT INTO settlements (room_id, from_user_id, to_user_id, amount) 
			VALUES (?, ?, ?, ?)
		`, req.RoomId, settlement.FromUserID, settlement.ToUserID, settlement.Amount)
		
		if err != nil {
			return &Response{Code: 500, Message: "记录结算失败"}, nil
		}
	}

	// 更新房间状态
	_, err = tx.Exec(`
		UPDATE rooms SET status = 2, settled_at = NOW() WHERE id = ?
	`, req.RoomId)
	
	if err != nil {
		return &Response{Code: 500, Message: "更新房间状态失败"}, nil
	}

	// 更新玩家最终分数
	for _, player := range players {
		_, err = tx.Exec(`
			UPDATE room_players SET final_score = ? WHERE room_id = ? AND user_id = ?
		`, player.Score, req.RoomId, player.UserID)
		
		if err != nil {
			return &Response{Code: 500, Message: "更新最终分数失败"}, nil
		}
	}

	// 提交事务
	if err = tx.Commit(); err != nil {
		return &Response{Code: 500, Message: "提交事务失败"}, nil
	}

	settlementsData, _ := json.Marshal(settlements)
	return &Response{Code: 200, Message: "结算成功", Data: string(settlementsData)}, nil
}

// 获取用户房间列表
func (s *MahjongService) GetUserRooms(ctx context.Context, req *GetUserRoomsRequest) (*Response, error) {
	offset := (req.Page - 1) * req.PageSize
	
	rows, err := s.db.Query(`
		SELECT r.id, r.room_code, r.room_name, r.status, r.created_at, r.settled_at,
		       rp.current_score, rp.final_score,
		       (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count,
		       (SELECT COUNT(*) FROM score_transfers WHERE room_id = r.id) as transfer_count
		FROM rooms r
		INNER JOIN room_players rp ON r.id = rp.room_id
		WHERE rp.user_id = ?
		ORDER BY r.created_at DESC
		LIMIT ? OFFSET ?
	`, req.UserId, req.PageSize, offset)
	
	if err != nil {
		return &Response{Code: 500, Message: "查询房间列表失败"}, nil
	}
	defer rows.Close()

	var rooms []map[string]interface{}
	for rows.Next() {
		var roomID int64
		var roomCode, roomName string
		var status int
		var createdAt, settledAt sql.NullTime
		var currentScore, finalScore sql.NullInt32
		var playerCount, transferCount int

		rows.Scan(&roomID, &roomCode, &roomName, &status, &createdAt, &settledAt,
			&currentScore, &finalScore, &playerCount, &transferCount)

		room := map[string]interface{}{
			"room_id":       roomID,
			"room_code":     roomCode,
			"room_name":     roomName,
			"status":        status,
			"created_at":    createdAt.Time.Unix(),
			"settled_at":    settledAt.Time.Unix(),
			"current_score": currentScore.Int32,
			"final_score":   finalScore.Int32,
			"player_count":  playerCount,
			"transfer_count": transferCount,
		}
		rooms = append(rooms, room)
	}

	roomsData, _ := json.Marshal(rooms)
	return &Response{Code: 200, Message: "获取成功", Data: string(roomsData)}, nil
}

// 获取房间详情
func (s *MahjongService) GetRoomDetail(ctx context.Context, req *GetRoomDetailRequest) (*Response, error) {
	// 获取房间基本信息
	room := &Room{}
	err := s.db.QueryRow(`
		SELECT id, room_code, room_name, creator_id, status, created_at, settled_at 
		FROM rooms WHERE id = ?
	`, req.RoomId).Scan(
		&room.Id, &room.RoomCode, &room.RoomName, &room.CreatorId, 
		&room.Status, &room.CreatedAt, &room.SettledAt,
	)
	
	if err != nil {
		return &Response{Code: 404, Message: "房间不存在"}, nil
	}

	// 获取玩家信息
	players, err := s.getRoomPlayers(req.RoomId)
	if err != nil {
		return &Response{Code: 500, Message: "获取玩家信息失败"}, nil
	}
	room.Players = players

	// 获取转移记录
	transfers, err := s.getRoomTransfers(req.RoomId)
	if err != nil {
		return &Response{Code: 500, Message: "获取转移记录失败"}, nil
	}

	// 获取结算记录
	settlements, err := s.getRoomSettlements(req.RoomId)
	if err != nil {
		return &Response{Code: 500, Message: "获取结算记录失败"}, nil
	}

	detail := map[string]interface{}{
		"room":        room,
		"transfers":   transfers,
		"settlements": settlements,
	}

	detailData, _ := json.Marshal(detail)
	return &Response{Code: 200, Message: "获取成功", Data: string(detailData)}, nil
}

// 获取最近房间
func (s *MahjongService) GetRecentRoom(ctx context.Context, req *GetUserRequest) (*Response, error) {
	var recentRoom RecentRoom
	err := s.db.QueryRow(`
		SELECT r.id, r.room_code, r.room_name, r.status, urr.last_accessed_at,
		       rp.current_score,
		       (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count,
		       (SELECT COUNT(*) FROM score_transfers WHERE room_id = r.id) as transfer_count
		FROM user_recent_rooms urr
		INNER JOIN rooms r ON urr.room_id = r.id
		INNER JOIN room_players rp ON r.id = rp.room_id AND rp.user_id = urr.user_id
		WHERE urr.user_id = ?
		ORDER BY urr.last_accessed_at DESC
		LIMIT 1
	`, req.UserId).Scan(
		&recentRoom.RoomId, &recentRoom.RoomCode, &recentRoom.RoomName, &recentRoom.Status,
		&recentRoom.LastAccessedAt, &recentRoom.CurrentScore, &recentRoom.PlayerCount, &recentRoom.TransferCount,
	)
	
	if err == sql.ErrNoRows {
		return &Response{Code: 200, Message: "没有最近房间"}, nil
	} else if err != nil {
		return &Response{Code: 500, Message: "查询最近房间失败"}, nil
	}

	recentRoomData, _ := json.Marshal(recentRoom)
	return &Response{Code: 200, Message: "获取成功", Data: string(recentRoomData)}, nil
}

// 辅助方法

// 生成唯一的房间号（包含时间戳的字符串）
func (s *MahjongService) generateUniqueRoomCode() string {
	// 获取当前时间戳（毫秒）
	timestamp := time.Now().UnixMilli()
	
	// 生成随机数（0-999）
	rand.Seed(time.Now().UnixNano())
	randomPart := rand.Intn(1000)
	
	// 组合时间戳和随机数，确保唯一性
	// 格式：时间戳(13位) + 随机数(3位) = 16位数字字符串
	roomCode := fmt.Sprintf("%d%03d", timestamp, randomPart)
	
	// 检查房间号是否已存在，如果存在则重新生成
	for {
		var exists int
		err := s.db.QueryRow("SELECT COUNT(*) FROM rooms WHERE room_code = ?", roomCode).Scan(&exists)
		if err != nil || exists == 0 {
			break
		}
		// 如果房间号已存在，重新生成
		roomCode = fmt.Sprintf("%d%03d", timestamp, rand.Intn(1000))
	}
	
	return roomCode
}

func (s *MahjongService) updateRecentRoom(userID, roomID int64) {
	s.db.Exec(`
		INSERT INTO user_recent_rooms (user_id, room_id, last_accessed_at) 
		VALUES (?, ?, NOW())
		ON DUPLICATE KEY UPDATE last_accessed_at = NOW()
	`, userID, roomID)
}

func (s *MahjongService) getRoomPlayers(roomID int64) ([]*RoomPlayer, error) {
	rows, err := s.db.Query(`
		SELECT rp.id, rp.room_id, rp.user_id, rp.current_score, rp.final_score, rp.joined_at,
		       u.id, u.openid, u.nickname, u.avatar_url, u.created_at, u.updated_at
		FROM room_players rp
		LEFT JOIN users u ON rp.user_id = u.id
		WHERE rp.room_id = ?
		ORDER BY rp.joined_at ASC
	`, roomID)
	
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var players []*RoomPlayer
	for rows.Next() {
		player := &RoomPlayer{}
		user := &User{}
		
		err := rows.Scan(
			&player.Id, &player.RoomId, &player.UserId, &player.CurrentScore, 
			&player.FinalScore, &player.JoinedAt,
			&user.Id, &user.Openid, &user.Nickname, &user.AvatarUrl, 
			&user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			continue
		}
		
		player.User = user
		players = append(players, player)
	}

	return players, nil
}

func (s *MahjongService) getRoomTransfers(roomID int64) ([]*ScoreTransfer, error) {
	rows, err := s.db.Query(`
		SELECT st.id, st.room_id, st.from_user_id, st.to_user_id, st.amount, st.created_at,
		       u1.nickname as from_user_name, u2.nickname as to_user_name
		FROM score_transfers st
		LEFT JOIN users u1 ON st.from_user_id = u1.id
		LEFT JOIN users u2 ON st.to_user_id = u2.id
		WHERE st.room_id = ?
		ORDER BY st.created_at DESC
	`, roomID)
	
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transfers []*ScoreTransfer
	for rows.Next() {
		transfer := &ScoreTransfer{}
		err := rows.Scan(
			&transfer.Id, &transfer.RoomId, &transfer.FromUserId, &transfer.ToUserId,
			&transfer.Amount, &transfer.CreatedAt, &transfer.FromUserName, &transfer.ToUserName,
		)
		if err != nil {
			continue
		}
		transfers = append(transfers, transfer)
	}

	return transfers, nil
}

func (s *MahjongService) getRoomSettlements(roomID int64) ([]*Settlement, error) {
	rows, err := s.db.Query(`
		SELECT s.id, s.room_id, s.from_user_id, s.to_user_id, s.amount, s.created_at,
		       u1.nickname as from_user_name, u2.nickname as to_user_name
		FROM settlements s
		LEFT JOIN users u1 ON s.from_user_id = u1.id
		LEFT JOIN users u2 ON s.to_user_id = u2.id
		WHERE s.room_id = ?
		ORDER BY s.created_at ASC
	`, roomID)
	
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var settlements []*Settlement
	for rows.Next() {
		settlement := &Settlement{}
		err := rows.Scan(
			&settlement.Id, &settlement.RoomId, &settlement.FromUserId, &settlement.ToUserId,
			&settlement.Amount, &settlement.CreatedAt, &settlement.FromUserName, &settlement.ToUserName,
		)
		if err != nil {
			continue
		}
		settlements = append(settlements, settlement)
	}

	return settlements, nil
}

// 计算最优转账方案（最少转账次数）
func (s *MahjongService) calculateOptimalSettlement(players []struct {
	UserID   int64
	Score    int32
	Nickname string
}) []struct {
	FromUserID int64
	ToUserID   int64
	Amount     int32
} {
	// 分离赢家和输家
	var winners, losers []struct {
		UserID   int64
		Score    int32
		Nickname string
	}

	for _, player := range players {
		if player.Score > 0 {
			winners = append(winners, player)
		} else if player.Score < 0 {
			losers = append(losers, player)
		}
	}

	var settlements []struct {
		FromUserID int64
		ToUserID   int64
		Amount     int32
	}

	// 贪心算法：每次处理一个输家，尽可能多地偿还给赢家
	for _, loser := range losers {
		debt := -loser.Score // 债务金额
		
		for i := range winners {
			if debt <= 0 {
				break
			}
			if winners[i].Score <= 0 {
				continue
			}

			transfer := debt
			if transfer > winners[i].Score {
				transfer = winners[i].Score
			}

			settlements = append(settlements, struct {
				FromUserID int64
				ToUserID   int64
				Amount     int32
			}{
				FromUserID: loser.UserID,
				ToUserID:   winners[i].UserID,
				Amount:     transfer,
			})

			debt -= transfer
			winners[i].Score -= transfer
		}
	}

	return settlements
}
