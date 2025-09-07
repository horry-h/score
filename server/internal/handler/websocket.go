package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"mahjong-server/internal/logger"
)

// WebSocketMessage 定义WebSocket消息结构
type WebSocketMessage struct {
	Type      string      `json:"type"`
	RoomID    int64       `json:"room_id"`
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
}

// RoomEvent 房间事件类型
const (
	EventPlayerJoined   = "player_joined"
	EventPlayerLeft     = "player_left"
	EventScoreTransfer  = "score_transfer"
	EventRoomSettled    = "room_settled"
	EventPlayerUpdated  = "player_updated"
	EventRoomUpdated    = "room_updated"
)

// Client 表示一个WebSocket客户端连接
type Client struct {
	conn     *websocket.Conn
	roomID   int64
	userID   int64
	send     chan []byte
	hub      *Hub
	mu       sync.Mutex
}

// Hub 维护所有活跃的客户端连接
type Hub struct {
	clients    map[*Client]bool
	rooms      map[int64]map[*Client]bool // roomID -> clients
	register   chan *Client
	unregister chan *Client
	broadcast  chan *WebSocketMessage
	mu         sync.RWMutex
}

// NewHub 创建新的Hub实例
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[int64]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *WebSocketMessage),
	}
}

// Run 启动Hub的消息处理循环
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if h.rooms[client.roomID] == nil {
				h.rooms[client.roomID] = make(map[*Client]bool)
			}
			h.rooms[client.roomID][client] = true
			h.mu.Unlock()
			
			logger.Info("客户端已注册", "room_id", client.roomID, "user_id", client.userID, "total_clients", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				if roomClients, exists := h.rooms[client.roomID]; exists {
					delete(roomClients, client)
					if len(roomClients) == 0 {
						delete(h.rooms, client.roomID)
					}
				}
				close(client.send)
			}
			h.mu.Unlock()
			
			logger.Info("客户端已注销", "room_id", client.roomID, "user_id", client.userID, "total_clients", len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			if roomClients, exists := h.rooms[message.RoomID]; exists {
				for client := range roomClients {
					select {
					case client.send <- h.marshalMessage(message):
					default:
						close(client.send)
						delete(h.clients, client)
						delete(roomClients, client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastToRoom 向指定房间广播消息
func (h *Hub) BroadcastToRoom(roomID int64, eventType string, data interface{}) {
	message := &WebSocketMessage{
		Type:      eventType,
		RoomID:    roomID,
		Data:      data,
		Timestamp: time.Now().Unix(),
	}
	
	select {
	case h.broadcast <- message:
		logger.Info("消息已加入广播队列", "room_id", roomID, "event_type", eventType)
	default:
		logger.Warn("广播队列已满，消息被丢弃", "room_id", roomID, "event_type", eventType)
	}
}

// marshalMessage 将消息序列化为JSON
func (h *Hub) marshalMessage(message *WebSocketMessage) []byte {
	data, err := json.Marshal(message)
	if err != nil {
		logger.Error("消息序列化失败", "error", err.Error())
		return []byte("{}")
	}
	return data
}

// WebSocketHandler 处理WebSocket连接
type WebSocketHandler struct {
	hub *Hub
	upgrader websocket.Upgrader
}

// NewWebSocketHandler 创建WebSocket处理器
func NewWebSocketHandler(hub *Hub) *WebSocketHandler {
	return &WebSocketHandler{
		hub: hub,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// 允许所有来源的连接（生产环境应该更严格）
				return true
			},
		},
	}
}

// HandleWebSocket 处理WebSocket连接请求
func (h *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	logger.Info("WebSocket连接请求", "path", r.URL.Path, "query", r.URL.RawQuery)
	logger.Info("WebSocket处理器被调用", "method", r.Method, "remote_addr", r.RemoteAddr)
	
	// 检查ResponseWriter类型
	logger.Info("ResponseWriter类型", "type", fmt.Sprintf("%T", w))
	
	// 从查询参数获取房间ID和用户ID
	roomIDStr := r.URL.Query().Get("room_id")
	userIDStr := r.URL.Query().Get("user_id")
	
	if roomIDStr == "" || userIDStr == "" {
		http.Error(w, "Missing room_id or user_id", http.StatusBadRequest)
		return
	}
	
	// 解析房间ID和用户ID
	var roomID, userID int64
	if _, err := fmt.Sscanf(roomIDStr, "%d", &roomID); err != nil {
		http.Error(w, "Invalid room_id", http.StatusBadRequest)
		return
	}
	
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}
	
	// 升级HTTP连接为WebSocket连接
	logger.Info("开始WebSocket升级", "room_id", roomID, "user_id", userID)
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Error("WebSocket升级失败", "error", err.Error(), "room_id", roomID, "user_id", userID)
		return
	}
	
	// 创建客户端
	client := &Client{
		conn:   conn,
		roomID: roomID,
		userID: userID,
		send:   make(chan []byte, 256),
		hub:    h.hub,
	}
	
	// 注册客户端
	client.hub.register <- client
	
	// 启动客户端处理协程
	go client.writePump()
	go client.readPump()
	
	logger.Info("WebSocket连接已建立", "room_id", roomID, "user_id", userID)
}

// readPump 处理从客户端读取消息
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	
	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logger.Error("WebSocket读取错误", "error", err.Error(), "room_id", c.roomID, "user_id", c.userID)
			}
			break
		}
	}
}

// writePump 处理向客户端发送消息
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			
			// 批量发送队列中的消息
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}
			
			if err := w.Close(); err != nil {
				return
			}
			
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
