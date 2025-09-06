package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"mahjong-server/internal/service"
)

type HTTPHandler struct {
	service *service.MahjongService
}

func NewHTTPHandler(db *sql.DB, wechatService *service.WeChatService) *HTTPHandler {
	return &HTTPHandler{
		service: service.NewMahjongService(db, wechatService),
	}
}

func (h *HTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 设置响应头
	w.Header().Set("Content-Type", "application/json")

	// 健康检查接口
	if r.URL.Path == "/health" || r.URL.Path == "/api/v1/health" {
		h.handleHealth(w, r)
		return
	}

	// 路由处理
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/")
	fmt.Printf("请求路径: %s, 方法: %s, 处理后路径: %s\n", r.URL.Path, r.Method, path)
	
	switch {
	case r.Method == "POST" && path == "autoLogin":
		h.handleAutoLogin(w, r)
	case r.Method == "POST" && path == "login":
		h.handleLogin(w, r)
	case r.Method == "POST" && path == "updateUser":
		h.handleUpdateUser(w, r)
	case r.Method == "GET" && path == "getUser":
		h.handleGetUser(w, r)
	case r.Method == "POST" && path == "createRoom":
		h.handleCreateRoom(w, r)
	case r.Method == "POST" && path == "joinRoom":
		h.handleJoinRoom(w, r)
	case r.Method == "GET" && path == "getRoom":
		h.handleGetRoom(w, r)
	case r.Method == "GET" && path == "getRoomPlayers":
		h.handleGetRoomPlayers(w, r)
	case r.Method == "GET" && path == "getRoomTransfers":
		h.handleGetRoomTransfers(w, r)
	case r.Method == "POST" && path == "transferScore":
		h.handleTransferScore(w, r)
	case r.Method == "POST" && path == "settleRoom":
		h.handleSettleRoom(w, r)
	case r.Method == "GET" && path == "getUserRooms":
		h.handleGetUserRooms(w, r)
	case r.Method == "GET" && path == "getRoomDetail":
		h.handleGetRoomDetail(w, r)
	case r.Method == "GET" && path == "getRecentRoom":
		h.handleGetRecentRoom(w, r)
	case r.Method == "GET" && path == "health":
		h.handleHealth(w, r)
	case r.Method == "POST" && path == "validateSession":
		h.handleValidateSession(w, r)
	case r.Method == "POST" && path == "generateQRCode":
		h.handleGenerateQRCode(w, r)
	default:
		http.NotFound(w, r)
	}
}

// 自动登录（只获取openid，查询或创建用户记录）
func (h *HTTPHandler) handleAutoLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, 400, "Invalid request body")
		return
	}

	response, err := h.service.AutoLogin(r.Context(), &service.AutoLoginRequest{
		Code: req.Code,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 用户登录
func (h *HTTPHandler) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code      string `json:"code"`
		Nickname  string `json:"nickname"`
		AvatarUrl string `json:"avatar_url"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, 400, "Invalid request body")
		return
	}

	response, err := h.service.Login(r.Context(), &service.LoginRequest{
		Code:      req.Code,
		Nickname:  req.Nickname,
		AvatarUrl: req.AvatarUrl,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 更新用户信息
func (h *HTTPHandler) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserId    int64  `json:"user_id"`
		Nickname  string `json:"nickname"`
		AvatarUrl string `json:"avatar_url"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, 400, "Invalid request body")
		return
	}

	response, err := h.service.UpdateUser(r.Context(), &service.UpdateUserRequest{
		UserId:    req.UserId,
		Nickname:  req.Nickname,
		AvatarUrl: req.AvatarUrl,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 获取用户信息
func (h *HTTPHandler) handleGetUser(w http.ResponseWriter, r *http.Request) {
	userIdStr := r.URL.Query().Get("user_id")
	userId, err := strconv.ParseInt(userIdStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "Invalid user_id")
		return
	}

	response, err := h.service.GetUser(r.Context(), &service.GetUserRequest{
		UserId: userId,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 创建房间
func (h *HTTPHandler) handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CreatorId int64  `json:"creator_id"`
		RoomName  string `json:"room_name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, 400, "Invalid request body")
		return
	}

	response, err := h.service.CreateRoom(r.Context(), &service.CreateRoomRequest{
		CreatorId: req.CreatorId,
		RoomName:  req.RoomName,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 加入房间
func (h *HTTPHandler) handleJoinRoom(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserId int64 `json:"user_id"`
		RoomId int64 `json:"room_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, 400, "Invalid request body")
		return
	}

	response, err := h.service.JoinRoom(r.Context(), &service.JoinRoomRequest{
		UserId: req.UserId,
		RoomId: req.RoomId,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 获取房间信息
func (h *HTTPHandler) handleGetRoom(w http.ResponseWriter, r *http.Request) {
	roomIdStr := r.URL.Query().Get("room_id")
	roomCode := r.URL.Query().Get("room_code")

	var roomId int64
	if roomIdStr != "" {
		var err error
		roomId, err = strconv.ParseInt(roomIdStr, 10, 64)
		if err != nil {
			h.writeError(w, 400, "Invalid room_id")
			return
		}
	}

	response, err := h.service.GetRoom(r.Context(), &service.GetRoomRequest{
		RoomId:   roomId,
		RoomCode: roomCode,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 获取房间玩家
func (h *HTTPHandler) handleGetRoomPlayers(w http.ResponseWriter, r *http.Request) {
	roomIdStr := r.URL.Query().Get("room_id")
	roomId, err := strconv.ParseInt(roomIdStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "Invalid room_id")
		return
	}

	response, err := h.service.GetRoomPlayers(r.Context(), &service.GetRoomPlayersRequest{
		RoomId: roomId,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 获取房间转移记录
func (h *HTTPHandler) handleGetRoomTransfers(w http.ResponseWriter, r *http.Request) {
	roomIdStr := r.URL.Query().Get("room_id")
	roomId, err := strconv.ParseInt(roomIdStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "Invalid room_id")
		return
	}

	response, err := h.service.GetRoomTransfers(r.Context(), &service.GetRoomTransfersRequest{
		RoomId: roomId,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 转移分数
func (h *HTTPHandler) handleTransferScore(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RoomId     int64 `json:"room_id"`
		FromUserId int64 `json:"from_user_id"`
		ToUserId   int64 `json:"to_user_id"`
		Amount     int32 `json:"amount"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, 400, "Invalid request body")
		return
	}

	response, err := h.service.TransferScore(r.Context(), &service.TransferScoreRequest{
		RoomId:     req.RoomId,
		FromUserId: req.FromUserId,
		ToUserId:   req.ToUserId,
		Amount:     req.Amount,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 结算房间
func (h *HTTPHandler) handleSettleRoom(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RoomId int64 `json:"room_id"`
		UserId int64 `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, 400, "Invalid request body")
		return
	}

	response, err := h.service.SettleRoom(r.Context(), &service.SettleRoomRequest{
		RoomId: req.RoomId,
		UserId: req.UserId,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 获取用户房间列表
func (h *HTTPHandler) handleGetUserRooms(w http.ResponseWriter, r *http.Request) {
	userIdStr := r.URL.Query().Get("user_id")
	pageStr := r.URL.Query().Get("page")
	pageSizeStr := r.URL.Query().Get("page_size")

	userId, err := strconv.ParseInt(userIdStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "Invalid user_id")
		return
	}

	page, _ := strconv.ParseInt(pageStr, 10, 32)
	if page <= 0 {
		page = 1
	}

	pageSize, _ := strconv.ParseInt(pageSizeStr, 10, 32)
	if pageSize <= 0 {
		pageSize = 10
	}

	response, err := h.service.GetUserRooms(r.Context(), &service.GetUserRoomsRequest{
		UserId:   userId,
		Page:     int32(page),
		PageSize: int32(pageSize),
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 获取房间详情
func (h *HTTPHandler) handleGetRoomDetail(w http.ResponseWriter, r *http.Request) {
	roomIdStr := r.URL.Query().Get("room_id")
	userIdStr := r.URL.Query().Get("user_id")

	roomId, err := strconv.ParseInt(roomIdStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "Invalid room_id")
		return
	}

	userId, err := strconv.ParseInt(userIdStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "Invalid user_id")
		return
	}

	response, err := h.service.GetRoomDetail(r.Context(), &service.GetRoomDetailRequest{
		RoomId: roomId,
		UserId: userId,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 获取最近房间
func (h *HTTPHandler) handleGetRecentRoom(w http.ResponseWriter, r *http.Request) {
	userIdStr := r.URL.Query().Get("user_id")
	userId, err := strconv.ParseInt(userIdStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "Invalid user_id")
		return
	}

	response, err := h.service.GetRecentRoom(r.Context(), &service.GetUserRequest{
		UserId: userId,
	})
	
	if err != nil {
		h.writeError(w, 500, "Internal server error")
		return
	}

	h.writeResponse(w, response)
}

// 写入响应
func (h *HTTPHandler) writeResponse(w http.ResponseWriter, response *service.Response) {
	// 对于业务逻辑错误，返回HTTP 200状态码，在响应体中包含业务状态码
	if response.Code == 404 {
		w.WriteHeader(http.StatusOK)
	} else if response.Code >= 400 {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	json.NewEncoder(w).Encode(response)
}

// 写入错误响应
func (h *HTTPHandler) writeError(w http.ResponseWriter, code int, message string) {
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"code":    code,
		"message": message,
		"data":    "",
	})
}

// 健康检查
func (h *HTTPHandler) handleHealth(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"code":    200,
		"message": "服务运行正常",
		"data": map[string]interface{}{
			"service":    "麻将记分小程序后端服务",
			"version":    "1.0.0",
			"status":     "healthy",
			"server_ip":  "124.156.196.117",
			"timestamp":  "2025-09-05T01:25:00Z",
		},
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// 验证登录态
func (h *HTTPHandler) handleValidateSession(w http.ResponseWriter, r *http.Request) {
	var req service.ValidateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	response, err := h.service.ValidateSession(r.Context(), req.SessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// 生成房间二维码
func (h *HTTPHandler) handleGenerateQRCode(w http.ResponseWriter, r *http.Request) {
	var req service.GenerateQRCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	response, err := h.service.GenerateQRCode(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

