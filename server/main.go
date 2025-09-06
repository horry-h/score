package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"mahjong-server/internal/config"
	"mahjong-server/internal/database"
	"mahjong-server/internal/handler"
	"mahjong-server/internal/service"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 初始化数据库
	db, err := database.InitDB(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// 创建微信服务
	wechatService := service.NewWeChatService(cfg.WeChat.AppID, cfg.WeChat.AppSecret)

	// 创建HTTP处理器
	httpHandler := handler.NewHTTPHandler(db, wechatService)

	// 添加CORS支持
	corsHandler := func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			h.ServeHTTP(w, r)
		})
	}

	// 启动HTTP服务器
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.HTTP.Port),
		Handler:      corsHandler(httpHandler),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	log.Printf("HTTP server listening on port %d", cfg.HTTP.Port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start HTTP server: %v", err)
	}
}
