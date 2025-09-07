package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"mahjong-server/internal/logger"
	"mahjong-server/internal/service"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	logger.Info("WebSocket服务器处理请求", "path", r.URL.Path, "method", r.Method, "remote_addr", r.RemoteAddr)
	
	// 从查询参数获取房间ID和用户ID
	roomIDStr := r.URL.Query().Get("room_id")
	userIDStr := r.URL.Query().Get("user_id")
	
	if roomIDStr == "" || userIDStr == "" {
		http.Error(w, "Missing room_id or user_id", http.StatusBadRequest)
		return
	}
	
	logger.Info("WebSocket参数解析", "room_id", roomIDStr, "user_id", userIDStr)
	
	// 升级HTTP连接为WebSocket连接
	logger.Info("开始WebSocket升级")
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Error("WebSocket升级失败", "error", err.Error())
		return
	}
	defer conn.Close()
	
	logger.Info("WebSocket连接成功建立")
	
	// 发送欢迎消息
	conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"welcome","message":"WebSocket连接成功"}`))
	
	// 保持连接活跃
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logger.Error("WebSocket连接异常关闭", "error", err.Error())
			}
			break
		}
	}
	
	logger.Info("WebSocket连接已关闭")
}

func main() {
	logger.Info("启动独立WebSocket服务器", "port", ":8081")
	
	// 设置WebSocket路由
	http.HandleFunc("/ws", handleWebSocket)
	
	// 启动服务器
	server := &http.Server{
		Addr:         ":8081",
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}
	
	// 优雅关闭
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)
		<-sigChan
		
		logger.Info("收到关闭信号，关闭WebSocket服务器")
		server.Close()
		os.Exit(0)
	}()
	
	logger.Info("WebSocket服务器启动", "port", "8081")
	log.Fatal(server.ListenAndServe())
}
