package service

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"reflect"
	"time"

	"mahjong-server/internal/logger"
)

type MahjongService struct {
	db          *sql.DB
	wechatService *WeChatService
	hub         interface{} // WebSocket Hub接口，避免循环依赖
}

func NewMahjongService(db *sql.DB, wechatService *WeChatService) *MahjongService {
	return &MahjongService{
		db:            db,
		wechatService: wechatService,
	}
}

// SetHub 设置WebSocket Hub（避免循环依赖）
func (s *MahjongService) SetHub(hub interface{}) {
	s.hub = hub
}

// broadcastToRoom 向房间广播消息
func (s *MahjongService) broadcastToRoom(roomID int64, eventType string, data interface{}) {
	if s.hub != nil {
		// 使用反射调用Hub的BroadcastToRoom方法
		hubValue := reflect.ValueOf(s.hub)
		method := hubValue.MethodByName("BroadcastToRoom")
		if method.IsValid() {
			method.Call([]reflect.Value{
				reflect.ValueOf(roomID),
				reflect.ValueOf(eventType),
				reflect.ValueOf(data),
			})
			logger.Info("已广播房间事件", "room_id", roomID, "event_type", eventType)
		}
	}
}

// 自动登录（只获取openid，查询或创建用户记录）
func (s *MahjongService) AutoLogin(ctx context.Context, req *AutoLoginRequest) (*Response, error) {
	logger.Info("开始自动登录", "code_length", len(req.Code))
	
	// 通过微信code获取openid
	wechatResp, err := s.wechatService.GetOpenID(req.Code)
	if err != nil {
		logger.Error("获取微信用户信息失败", "error", err.Error())
		return &Response{Code: 500, Message: "获取微信用户信息失败: " + err.Error()}, nil
	}
	
	logger.Info("获取微信openid成功", "openid", wechatResp.OpenID)
	
	openid := wechatResp.OpenID
	if openid == "" {
		return &Response{Code: 500, Message: "获取openid失败"}, nil
	}
	
	// 查询用户是否已存在
	var user User
	var createdAt, updatedAt time.Time
	err = s.db.QueryRow(`
		SELECT id, openid, nickname, avatar_url, created_at, updated_at 
		FROM users WHERE openid = ?
	`, openid).Scan(&user.Id, &user.Openid, &user.Nickname, &user.AvatarUrl, &createdAt, &updatedAt)
	
	if err == sql.ErrNoRows {
		// 用户不存在，创建新用户记录（使用默认值）
		result, err := s.db.Exec(`
			INSERT INTO users (openid, nickname, avatar_url, created_at, updated_at) 
			VALUES (?, ?, ?, NOW(), NOW())
		`, openid, "微信用户", "/images/default-avatar.png")
		
		if err != nil {
			return &Response{Code: 500, Message: "创建用户失败: " + err.Error()}, nil
		}
		
		userID, _ := result.LastInsertId()
		user = User{
			Id:        userID,
			Openid:    openid,
			Nickname:  "微信用户",
			AvatarUrl: "/images/default-avatar.png",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
	} else if err != nil {
		return &Response{Code: 500, Message: "查询用户失败: " + err.Error()}, nil
	} else {
		// 用户已存在，更新最后登录时间
		user.CreatedAt = createdAt
		user.UpdatedAt = updatedAt
		
		_, err = s.db.Exec(`UPDATE users SET updated_at = NOW() WHERE id = ?`, user.Id)
		if err != nil {
			return &Response{Code: 500, Message: "更新用户登录时间失败: " + err.Error()}, nil
		}
	}
	
	// 生成session
	sessionID := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%d_%s_%d", user.Id, user.Openid, time.Now().UnixNano()))))
	expiresAt := time.Now().Add(24 * time.Hour)
	
	// 保存session到数据库
	_, err = s.db.Exec(`
		INSERT INTO user_sessions (session_id, user_id, expires_at, created_at) 
		VALUES (?, ?, ?, NOW())
	`, sessionID, user.Id, expiresAt)
	
	if err != nil {
		return &Response{Code: 500, Message: "保存session失败: " + err.Error()}, nil
	}
	
	// 返回用户信息和session
	responseData := map[string]interface{}{
		"user":       user,
		"session_id": sessionID,
		"expires_at": expiresAt.Unix(),
	}
	
	userData, _ := json.Marshal(responseData)
	return &Response{Code: 200, Message: "自动登录成功", Data: string(userData)}, nil
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
	
	user.CreatedAt = createdAt
	user.UpdatedAt = updatedAt
	
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
	
	user.CreatedAt = createdAt
	user.UpdatedAt = updatedAt

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
		INSERT INTO room_players (room_id, user_id, current_score, final_score) 
		VALUES (?, ?, 0, 0)
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
		SELECT id, status FROM rooms WHERE id = ?
	`, req.RoomId).Scan(&roomID, &status)
	
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
		// 用户已在房间中，直接返回房间信息
		var roomCode, roomName string
		var creatorId int64
		var createdAt time.Time
		var settledAt sql.NullTime
		
		// 获取房间详细信息
		err := s.db.QueryRow(`
			SELECT room_code, room_name, creator_id, created_at, settled_at
			FROM rooms WHERE id = ?
		`, roomID).Scan(&roomCode, &roomName, &creatorId, &createdAt, &settledAt)
		
		if err != nil {
			return &Response{Code: 500, Message: "获取房间信息失败"}, nil
		}
		
		// 返回与正常加入房间相同的数据结构
		roomData := map[string]interface{}{
			"room_id":   roomID,
			"room_code": roomCode,
		}
		
		data, _ := json.Marshal(roomData)
		logger.Info("已在房间中，返回房间数据", "data", string(data))
		return &Response{Code: 200, Message: "已在房间中", Data: string(data)}, nil
	}

	// 加入房间
	logger.Info("JoinRoom: 插入玩家记录", "room_id", roomID, "user_id", req.UserId)
	result, err := s.db.Exec(`
		INSERT INTO room_players (room_id, user_id, current_score, final_score) 
		VALUES (?, ?, 0, 0)
	`, roomID, req.UserId)
	
	if err != nil {
		logger.Error("JoinRoom: 插入玩家记录失败", "error", err.Error())
		return &Response{Code: 500, Message: "加入房间失败"}, nil
	}
	
	rowsAffected, _ := result.RowsAffected()
	logger.Info("JoinRoom: 成功插入玩家记录", "rows_affected", rowsAffected)

	// 更新用户最近房间
	s.updateRecentRoom(req.UserId, roomID)

	// 获取房间的room_code
	var roomCode string
	s.db.QueryRow("SELECT room_code FROM rooms WHERE id = ?", roomID).Scan(&roomCode)

	// 获取新加入玩家的信息用于广播
	var userID int64
	var nickname, avatarUrl string
	var currentScore, finalScore int32
	err = s.db.QueryRow(`
		SELECT u.id, u.nickname, u.avatar_url, rp.current_score, rp.final_score
		FROM users u
		JOIN room_players rp ON u.id = rp.user_id
		WHERE rp.room_id = ? AND rp.user_id = ?
	`, roomID, req.UserId).Scan(
		&userID, &nickname, &avatarUrl, &currentScore, &finalScore,
	)
	
	if err == nil {
		// 广播玩家加入事件
		s.broadcastToRoom(roomID, "player_joined", map[string]interface{}{
			"player": map[string]interface{}{
				"user_id":       userID,
				"nickname":      nickname,
				"avatar_url":    avatarUrl,
				"current_score": currentScore,
				"final_score":   finalScore,
			},
		})
	}

	roomData := map[string]interface{}{
		"room_id":   roomID,
		"room_code": roomCode,
	}
	
	data, _ := json.Marshal(roomData)
	return &Response{Code: 200, Message: "加入成功", Data: string(data)}, nil
}

// 获取房间信息
func (s *MahjongService) GetRoom(ctx context.Context, req *GetRoomRequest) (*Response, error) {
	var query string
	var args []interface{}
	
	// 添加调试日志
	logger.Debug("GetRoom请求", "room_id", req.RoomId, "room_code", req.RoomCode)
	
	// 优先使用room_id，如果没有则使用room_code
	if req.RoomId > 0 {
		query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE id = ?"
		args = []interface{}{req.RoomId}
		logger.Debug("使用room_id查询", "room_id", req.RoomId)
	} else if req.RoomCode != "" {
		query = "SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE room_code = ?"
		args = []interface{}{req.RoomCode}
		logger.Debug("使用room_code查询", "room_code", req.RoomCode)
	} else {
		logger.Warn("缺少房间标识")
		return &Response{Code: 400, Message: "缺少房间标识"}, nil
	}

	logger.Debug("执行查询", "query", query, "args", args)

	room := &Room{}
	var createdAt time.Time
	var settledAt sql.NullTime
	err := s.db.QueryRow(query, args...).Scan(
		&room.Id, &room.RoomCode, &room.RoomName, &room.CreatorId, 
		&room.Status, &createdAt, &settledAt,
	)
	
	if err != nil {
		logger.Error("查询错误", "error", err.Error())
		return &Response{Code: 404, Message: "房间不存在"}, nil
	}
	
	logger.Info("查询成功", "room_id", room.Id, "room_code", room.RoomCode)

	// 转换时间戳
	room.CreatedAt = createdAt
	if settledAt.Valid {
		room.SettledAt = &settledAt.Time
	} else {
		room.SettledAt = nil  // 如果settled_at为NULL，设置为nil
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
	var query string
	var args []interface{}
	
	// 构建查询语句，支持增量更新
	if req.LastTransferId > 0 {
		// 增量更新：获取ID大于lastTransferId的记录
		query = `
			SELECT st.id, st.room_id, st.from_user_id, st.to_user_id, st.amount, st.created_at,
			       u1.nickname as from_user_name, u2.nickname as to_user_name
			FROM score_transfers st
			LEFT JOIN users u1 ON st.from_user_id = u1.id
			LEFT JOIN users u2 ON st.to_user_id = u2.id
			WHERE st.room_id = ? AND st.id > ?
			ORDER BY st.id ASC
			LIMIT 100
		`
		args = []interface{}{req.RoomId, req.LastTransferId}
	} else {
		// 全量获取：获取最新的100条记录
		query = `
			SELECT st.id, st.room_id, st.from_user_id, st.to_user_id, st.amount, st.created_at,
			       u1.nickname as from_user_name, u2.nickname as to_user_name
			FROM score_transfers st
			LEFT JOIN users u1 ON st.from_user_id = u1.id
			LEFT JOIN users u2 ON st.to_user_id = u2.id
			WHERE st.room_id = ?
			ORDER BY st.id DESC
			LIMIT 100
		`
		args = []interface{}{req.RoomId}
	}
	
	rows, err := s.db.Query(query, args...)
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

	// 如果是全量获取，需要反转数组顺序（因为查询时是DESC，但前端期望ASC）
	if req.LastTransferId == 0 {
		for i, j := 0, len(transfers)-1; i < j; i, j = i+1, j-1 {
			transfers[i], transfers[j] = transfers[j], transfers[i]
		}
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

	// 允许分数为负数，移除分数不足检查

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

	// 获取转移双方的昵称用于广播
	var fromUserName, toUserName string
	s.db.QueryRow("SELECT nickname FROM users WHERE id = ?", req.FromUserId).Scan(&fromUserName)
	s.db.QueryRow("SELECT nickname FROM users WHERE id = ?", req.ToUserId).Scan(&toUserName)

	// 广播分数转移事件
	s.broadcastToRoom(req.RoomId, "score_transfer", map[string]interface{}{
		"transfer": map[string]interface{}{
			"from_user_id":   req.FromUserId,
			"to_user_id":     req.ToUserId,
			"from_user_name": fromUserName,
			"to_user_name":   toUserName,
			"amount":         req.Amount,
		},
	})

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
		`, req.RoomId, settlement.FromUserId, settlement.ToUserId, settlement.Amount)
		
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

	// 广播房间结算事件
	s.broadcastToRoom(req.RoomId, "room_settled", map[string]interface{}{
		"settlements": settlements,
		"players":     players,
	})

	settlementsData, _ := json.Marshal(settlements)
	return &Response{Code: 200, Message: "结算成功", Data: string(settlementsData)}, nil
}

// 计算最优转账方案
func (s *MahjongService) calculateOptimalSettlement(players []struct {
	UserID   int64
	Score    int32
	Nickname string
}) []Settlement {
	// 分离债权人和债务人
	var creditors []struct {
		UserID   int64
		Score    int32
		Nickname string
	}
	var debtors []struct {
		UserID   int64
		Score    int32
		Nickname string
	}

	for _, player := range players {
		if player.Score > 0 {
			creditors = append(creditors, player)
		} else if player.Score < 0 {
			debtors = append(debtors, player)
		}
	}

	var settlements []Settlement
	creditorIndex := 0
	debtorIndex := 0

	// 贪心算法：每次处理一个债权人和一个债务人
	for creditorIndex < len(creditors) && debtorIndex < len(debtors) {
		creditor := &creditors[creditorIndex]
		debtor := &debtors[debtorIndex]

		// 计算转账金额
		amount := min(creditor.Score, -debtor.Score)
		
		// 创建转账记录
		settlement := Settlement{
			FromUserId: debtor.UserID,
			ToUserId:   creditor.UserID,
			Amount:     amount,
		}
		settlements = append(settlements, settlement)

		// 更新余额
		creditor.Score -= amount
		debtor.Score += amount

		// 如果债权人余额为0，移动到下一个债权人
		if creditor.Score == 0 {
			creditorIndex++
		}
		// 如果债务人余额为0，移动到下一个债务人
		if debtor.Score == 0 {
			debtorIndex++
		}
	}

	return settlements
}

// 辅助函数：返回两个整数中的较小值
func min(a, b int32) int32 {
	if a < b {
		return a
	}
	return b
}

// 获取用户房间列表
func (s *MahjongService) GetUserRooms(ctx context.Context, req *GetUserRoomsRequest) (*Response, error) {
	// 限制最大返回100条记录
	if req.PageSize > 100 {
		req.PageSize = 100
	}
	
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
	// 查询最近20个房间，限制数量以优化性能
	rows, err := s.db.Query(`
		SELECT r.id, r.room_code, r.room_name, r.status, rp.joined_at,
		       rp.current_score,
		       (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count,
		       (SELECT COUNT(*) FROM score_transfers WHERE room_id = r.id) as transfer_count
		FROM room_players rp
		INNER JOIN rooms r ON rp.room_id = r.id
		WHERE rp.user_id = ? AND r.status = 1
		ORDER BY rp.joined_at DESC
		LIMIT 20
	`, req.UserId)
	
	if err != nil {
		return &Response{Code: 500, Message: "查询最近房间失败"}, nil
	}
	defer rows.Close()

	var recentRooms []RecentRoom
	for rows.Next() {
		var recentRoom RecentRoom
		var lastAccessedAt time.Time
		
		err := rows.Scan(
			&recentRoom.RoomId, &recentRoom.RoomCode, &recentRoom.RoomName, &recentRoom.Status,
			&lastAccessedAt, &recentRoom.CurrentScore, &recentRoom.PlayerCount, &recentRoom.TransferCount,
		)
		if err != nil {
			return &Response{Code: 500, Message: "解析房间数据失败"}, nil
		}
		
		// 转换时间戳
		recentRoom.LastAccessedAt = lastAccessedAt
		recentRooms = append(recentRooms, recentRoom)
	}
	
	if len(recentRooms) == 0 {
		return &Response{Code: 200, Message: "没有最近房间"}, nil
	}

	recentRoomsData, _ := json.Marshal(recentRooms)
	return &Response{Code: 200, Message: "获取成功", Data: string(recentRoomsData)}, nil
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
	logger.Debug("getRoomPlayers: 查询房间玩家", "room_id", roomID)
	
	// 先简单查询room_players表，看看是否有记录
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM room_players WHERE room_id = ?", roomID).Scan(&count)
	if err != nil {
		logger.Error("getRoomPlayers: 查询room_players表失败", "error", err.Error())
	} else {
		logger.Debug("getRoomPlayers: room_players表记录数", "room_id", roomID, "count", count)
	}
	
	query := `
		SELECT rp.id, rp.room_id, rp.user_id, rp.current_score, rp.final_score, rp.joined_at,
		       u.id, u.openid, u.nickname, u.avatar_url, u.created_at, u.updated_at
		FROM room_players rp
		LEFT JOIN users u ON rp.user_id = u.id
		WHERE rp.room_id = ?
		ORDER BY rp.joined_at ASC
	`
	logger.Debug("getRoomPlayers: 执行查询", "query", query, "room_id", roomID)
	
	rows, err := s.db.Query(query, roomID)
	
	if err != nil {
		logger.Error("getRoomPlayers: 查询失败", "error", err.Error())
		return nil, err
	}
	defer rows.Close()

	var players []*RoomPlayer
	playerCount := 0
	
	logger.Debug("getRoomPlayers: 开始遍历查询结果")
	for rows.Next() {
		logger.Debug("getRoomPlayers: 处理行数据", "row_number", playerCount+1)
		player := &RoomPlayer{}
		user := &User{}
		
		err := rows.Scan(
			&player.Id, &player.RoomId, &player.UserId, &player.CurrentScore, 
			&player.FinalScore, &player.JoinedAt,
			&user.Id, &user.Openid, &user.Nickname, &user.AvatarUrl, 
			&user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			logger.Error("getRoomPlayers: 扫描行数据失败", "error", err.Error())
			continue
		}
		
		player.User = user
		players = append(players, player)
		playerCount++
		logger.Debug("getRoomPlayers: 找到玩家", "player_count", playerCount, "user_id", player.UserId, "nickname", user.Nickname, "current_score", player.CurrentScore)
	}
	
	// 检查是否有行扫描错误
	if err := rows.Err(); err != nil {
		logger.Error("getRoomPlayers: 行扫描过程中出现错误", "error", err.Error())
		return nil, err
	}

	logger.Info("getRoomPlayers: 查询完成", "total_players", playerCount)
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


// 生成房间二维码
func (s *MahjongService) GenerateQRCode(ctx context.Context, req *GenerateQRCodeRequest) (*Response, error) {
	// 验证房间是否存在
	var roomExists bool
	err := s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM rooms WHERE id = ?)", req.RoomId).Scan(&roomExists)
	if err != nil {
		return &Response{Code: 500, Message: "查询房间失败: " + err.Error()}, nil
	}
	
	if !roomExists {
		return &Response{Code: 404, Message: "房间不存在"}, nil
	}
	
	// 调用微信API生成小程序码
	qrCodeData, err := s.wechatService.GenerateUnlimitedQRCode(req.RoomId, req.EnvVersion)
	if err != nil {
		return &Response{Code: 500, Message: "生成二维码失败: " + err.Error()}, nil
	}
	
	// 将二维码数据转换为base64返回
	responseData := map[string]interface{}{
		"room_id": req.RoomId,
		"qr_code": qrCodeData,
	}
	
	data, _ := json.Marshal(responseData)
	return &Response{Code: 200, Message: "生成成功", Data: string(data)}, nil
}

