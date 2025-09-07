package service

import "time"

// 用户信息
type User struct {
	Id        int64     `json:"id"`
	Openid    string    `json:"openid"`
	Nickname  string    `json:"nickname"`
	AvatarUrl string    `json:"avatar_url"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// 房间信息
type Room struct {
	Id        int64         `json:"id"`
	RoomCode  string        `json:"room_code"`
	RoomName  string        `json:"room_name"`
	CreatorId int64         `json:"creator_id"`
	Status    int32         `json:"status"` // 1-进行中，2-已结算
	CreatedAt time.Time     `json:"created_at"`
	SettledAt *time.Time    `json:"settled_at"` // 使用指针，因为可能为NULL
	Players   []*RoomPlayer `json:"players"`
}

// 房间玩家
type RoomPlayer struct {
	Id          int64     `json:"id"`
	RoomId      int64     `json:"room_id"`
	UserId      int64     `json:"user_id"`
	CurrentScore int32    `json:"current_score"`
	FinalScore  int32     `json:"final_score"`
	JoinedAt    time.Time `json:"joined_at"`
	User        *User     `json:"user"`
}

// 分数转移记录
type ScoreTransfer struct {
	Id           int64     `json:"id"`
	RoomId       int64     `json:"room_id"`
	FromUserId   int64     `json:"from_user_id"`
	ToUserId     int64     `json:"to_user_id"`
	Amount       int32     `json:"amount"`
	CreatedAt    time.Time `json:"created_at"`
	FromUserName string    `json:"from_user_name"`
	ToUserName   string    `json:"to_user_name"`
}

// 结算记录
type Settlement struct {
	Id           int64     `json:"id"`
	RoomId       int64     `json:"room_id"`
	FromUserId   int64     `json:"from_user_id"`
	ToUserId     int64     `json:"to_user_id"`
	Amount       int32     `json:"amount"`
	CreatedAt    time.Time `json:"created_at"`
	FromUserName string    `json:"from_user_name"`
	ToUserName   string    `json:"to_user_name"`
}

// 最近房间
type RecentRoom struct {
	RoomId         int64     `json:"room_id"`
	RoomCode       string    `json:"room_code"`
	RoomName       string    `json:"room_name"`
	Status         int32     `json:"status"`
	LastAccessedAt time.Time `json:"last_accessed_at"`
	CurrentScore   int32     `json:"current_score"`
	PlayerCount    int32     `json:"player_count"`
	TransferCount  int32     `json:"transfer_count"`
}

// 通用响应
type Response struct {
	Code    int32  `json:"code"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

// 请求结构体
type AutoLoginRequest struct {
	Code string `json:"code"`
}


type UpdateUserRequest struct {
	UserId    int64  `json:"user_id"`
	Nickname  string `json:"nickname"`
	AvatarUrl string `json:"avatar_url"`
}

type GetUserRequest struct {
	UserId int64 `json:"user_id"`
}

type CreateRoomRequest struct {
	CreatorId int64  `json:"creator_id"`
	RoomName  string `json:"room_name"`
}

type JoinRoomRequest struct {
	UserId int64 `json:"user_id"`
	RoomId int64 `json:"room_id"`
}

type GetRoomRequest struct {
	RoomId   int64  `json:"room_id"`
	RoomCode string `json:"room_code"`
}

type GetRoomPlayersRequest struct {
	RoomId int64 `json:"room_id"`
}

type GetRoomTransfersRequest struct {
	RoomId int64 `json:"room_id"`
}

type TransferScoreRequest struct {
	RoomId     int64 `json:"room_id"`
	FromUserId int64 `json:"from_user_id"`
	ToUserId   int64 `json:"to_user_id"`
	Amount     int32 `json:"amount"`
}

type SettleRoomRequest struct {
	RoomId int64 `json:"room_id"`
	UserId int64 `json:"user_id"`
}

type GetUserRoomsRequest struct {
	UserId   int64 `json:"user_id"`
	Page     int32 `json:"page"`
	PageSize int32 `json:"page_size"`
}

type GetRoomDetailRequest struct {
	RoomId int64 `json:"room_id"`
	UserId int64 `json:"user_id"`
}

type ValidateSessionRequest struct {
	SessionID string `json:"session_id"`
}

type GenerateQRCodeRequest struct {
	RoomId int64 `json:"room_id"`
}
