package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("WebSocket请求: %s %s\n", r.Method, r.URL.Path)
	
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket升级失败: %v", err)
		http.Error(w, "WebSocket upgrade failed", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	fmt.Printf("WebSocket连接成功\n")
	
	// 发送欢迎消息
	conn.WriteMessage(websocket.TextMessage, []byte("Hello WebSocket!"))
}

func main() {
	http.HandleFunc("/ws", handleWebSocket)
	
	fmt.Println("测试WebSocket服务器启动在 :8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
