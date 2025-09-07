package handler

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"mahjong-server/internal/logger"
	"mahjong-server/internal/service"
)

type HTTPHandler struct {
	service *service.MahjongService
	wsHandler *WebSocketHandler
	hub *Hub
}

// ResponseRecorder 用于记录HTTP响应
type ResponseRecorder struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func NewResponseRecorder(w http.ResponseWriter) *ResponseRecorder {
	return &ResponseRecorder{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
		body:           &bytes.Buffer{},
	}
}

func (r *ResponseRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *ResponseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

func NewHTTPHandler(db *sql.DB, wechatService *service.WeChatService) *HTTPHandler {
	hub := NewHub()
	wsHandler := NewWebSocketHandler(hub)
	
	// 启动Hub的消息处理循环
	go hub.Run()
	
	// 创建麻将服务并设置Hub
	mahjongService := service.NewMahjongService(db, wechatService)
	mahjongService.SetHub(hub)
	
	return &HTTPHandler{
		service: mahjongService,
		wsHandler: wsHandler,
		hub: hub,
	}
}

func (h *HTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 记录请求开始时间
	startTime := time.Now()

	// 健康检查接口
	if r.URL.Path == "/health" || r.URL.Path == "/api/v1/health" {
		recorder := NewResponseRecorder(w)
		h.handleHealth(recorder, r)
		h.logRequest(r, recorder, startTime)
		return
	}

	// WebSocket连接处理
	if r.URL.Path == "/ws" {
		// WebSocket升级需要直接使用原始的ResponseWriter，不能使用包装器
		h.wsHandler.HandleWebSocket(w, r)
		return
	}
	
	// 创建响应记录器（用于其他HTTP请求）
	recorder := NewResponseRecorder(w)
	
	// 设置响应头
	recorder.Header().Set("Content-Type", "application/json")
	
	// 路由处理
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/")
	logger.Debug("处理HTTP请求", "method", r.Method, "path", r.URL.Path, "processed_path", path)
	
	switch {
	case r.Method == "POST" && path == "autoLogin":
		h.handleAutoLogin(recorder, r)
	case r.Method == "POST" && path == "updateUser":
		h.handleUpdateUser(recorder, r)
	case r.Method == "GET" && path == "getUser":
		h.handleGetUser(recorder, r)
	case r.Method == "POST" && path == "createRoom":
		h.handleCreateRoom(recorder, r)
	case r.Method == "POST" && path == "joinRoom":
		h.handleJoinRoom(recorder, r)
	case r.Method == "GET" && path == "getRoom":
		h.handleGetRoom(recorder, r)
	case r.Method == "GET" && path == "getRoomPlayers":
		h.handleGetRoomPlayers(recorder, r)
	case r.Method == "GET" && path == "getRoomTransfers":
		h.handleGetRoomTransfers(recorder, r)
	case r.Method == "POST" && path == "transferScore":
		h.handleTransferScore(recorder, r)
	case r.Method == "POST" && path == "settleRoom":
		h.handleSettleRoom(recorder, r)
	case r.Method == "GET" && path == "getUserRooms":
		h.handleGetUserRooms(recorder, r)
	case r.Method == "GET" && path == "getRoomDetail":
		h.handleGetRoomDetail(recorder, r)
	case r.Method == "GET" && path == "getRecentRoom":
		h.handleGetRecentRoom(recorder, r)
	case r.Method == "GET" && path == "health":
		h.handleHealth(recorder, r)
	case r.Method == "POST" && path == "validateSession":
		h.handleValidateSession(recorder, r)
	case r.Method == "POST" && path == "generateQRCode":
		h.handleGenerateQRCode(recorder, r)
	default:
		http.NotFound(recorder, r)
	}
	
	// 记录请求日志
	h.logRequest(r, recorder, startTime)
}

// logRequest 记录HTTP请求日志
func (h *HTTPHandler) logRequest(r *http.Request, recorder *ResponseRecorder, startTime time.Time) {
	duration := time.Since(startTime)
	
	// 获取客户端IP
	clientIP := r.RemoteAddr
	if xForwardedFor := r.Header.Get("X-Forwarded-For"); xForwardedFor != "" {
		clientIP = strings.Split(xForwardedFor, ",")[0]
	} else if xRealIP := r.Header.Get("X-Real-IP"); xRealIP != "" {
		clientIP = xRealIP
	}
	
	// 获取请求体（仅对POST请求）
	var requestBody string
	if r.Method == "POST" && r.Body != nil {
		bodyBytes, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		if len(bodyBytes) > 0 {
			requestBody = string(bodyBytes)
		}
	}
	
	// 获取响应体
	responseBody := recorder.body.String()
	
	// 构建日志字段
	logFields := map[string]interface{}{
		"method":        r.Method,
		"path":          r.URL.Path,
		"query":         r.URL.RawQuery,
		"client_ip":     clientIP,
		"user_agent":    r.Header.Get("User-Agent"),
		"status_code":   recorder.statusCode,
		"duration_ms":   duration.Milliseconds(),
		"response_size": len(responseBody),
	}
	
	// 对于非200状态码，记录详细信息
	if recorder.statusCode != http.StatusOK {
		logFields["request_body"] = requestBody
		logFields["response_body"] = responseBody
		
		logger.Error("HTTP请求异常", logFields)
	} else {
		// 对于200状态码，只记录基本信息
		logger.Info("HTTP请求", logFields)
	}
}

// 自动登录（只获取openid，查询或创建用户记录）
func (h *HTTPHandler) handleAutoLogin(w *ResponseRecorder, r *http.Request) {
	var req struct {
		Code string `json:"code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("自动登录请求解析失败", "error", err.Error())
		h.writeError(w, 400, "Invalid request body")
		return
	}

	logger.Info("处理自动登录请求", "code_length", len(req.Code))

	response, err := h.service.AutoLogin(r.Context(), &service.AutoLoginRequest{
		Code: req.Code,
	})
	
	if err != nil {
		logger.Error("自动登录服务调用失败", "error", err.Error())
		h.writeError(w, 500, "Internal server error")
		return
	}

	logger.Info("自动登录成功", "response_code", response.Code)
	h.writeResponse(w, response)
}


// 更新用户信息
func (h *HTTPHandler) handleUpdateUser(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleGetUser(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleCreateRoom(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleJoinRoom(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleGetRoom(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleGetRoomPlayers(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleGetRoomTransfers(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleTransferScore(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleSettleRoom(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleGetUserRooms(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleGetRoomDetail(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleGetRecentRoom(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) writeResponse(w *ResponseRecorder, response *service.Response) {
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
func (h *HTTPHandler) writeError(w *ResponseRecorder, code int, message string) {
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"code":    code,
		"message": message,
		"data":    "",
	})
}

// 健康检查
func (h *HTTPHandler) handleHealth(w *ResponseRecorder, r *http.Request) {
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
func (h *HTTPHandler) handleValidateSession(w *ResponseRecorder, r *http.Request) {
	var req service.ValidateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	response, err := h.service.ValidateSession(r.Context(), req.SessionID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// 生成房间二维码
func (h *HTTPHandler) handleGenerateQRCode(w *ResponseRecorder, r *http.Request) {
	var req service.GenerateQRCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	response, err := h.service.GenerateQRCode(r.Context(), &req)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}


