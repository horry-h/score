package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mahjong-server/internal/config"
	"mahjong-server/internal/database"
	"mahjong-server/internal/handler"
	"mahjong-server/internal/logger"
	"mahjong-server/internal/service"
)

func main() {
	// 初始化日志系统
	if err := logger.InitLogger("./logs", logger.INFO); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.GetLogger().Close()

	logger.Info("麻将记分服务启动", "version", "1.0.0", "pid", os.Getpid())

	// 加载配置
	cfg := config.Load()
	logger.Info("配置加载完成", "http_port", cfg.HTTP.Port, "database_host", cfg.Database.Host)

	// 初始化数据库
	db, err := database.InitDB(cfg.Database)
	if err != nil {
		logger.Fatal("数据库初始化失败", "error", err.Error())
	}
	defer func() {
		if err := db.Close(); err != nil {
			logger.Error("关闭数据库连接失败", "error", err.Error())
		} else {
			logger.Info("数据库连接已关闭")
		}
	}()

	logger.Info("数据库连接成功")

	// 创建微信服务
	wechatService := service.NewWeChatService(cfg.WeChat.AppID, cfg.WeChat.AppSecret)
	logger.Info("微信服务初始化完成", "app_id", cfg.WeChat.AppID)

	// 创建HTTP处理器
	httpHandler := handler.NewHTTPHandler(db, wechatService)

	// 添加CORS支持和请求日志
	corsHandler := func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			
			// 设置CORS头
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				logger.LogHTTPRequest(r.Method, r.URL.Path, r.RemoteAddr, http.StatusOK, time.Since(start))
				return
			}

			// 包装ResponseWriter以捕获状态码
			wrapper := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
			h.ServeHTTP(wrapper, r)
			
			// 记录请求日志
			logger.LogHTTPRequest(r.Method, r.URL.Path, r.RemoteAddr, wrapper.statusCode, time.Since(start))
		})
	}

	// 启动HTTP服务器（由Nginx处理HTTPS）
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.HTTP.Port),
		Handler:      corsHandler(httpHandler),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	// 设置优雅关闭
	go func() {
		logger.Info("HTTP服务器启动", "port", cfg.HTTP.Port, "message", "HTTPS由Nginx处理")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("HTTP服务器启动失败", "error", err.Error())
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("收到关闭信号，开始优雅关闭...")

	// 优雅关闭服务器
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("服务器关闭失败", "error", err.Error())
	} else {
		logger.Info("服务器已优雅关闭")
	}
}

// responseWriter 包装http.ResponseWriter以捕获状态码
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
