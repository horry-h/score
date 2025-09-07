package database

import (
	"database/sql"
	"fmt"
	"time"

	"mahjong-server/internal/config"
	"mahjong-server/internal/logger"

	_ "github.com/go-sql-driver/mysql"
)

func InitDB(cfg config.DatabaseConfig) (*sql.DB, error) {
	start := time.Now()
	
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.Username, cfg.Password, cfg.Host, cfg.Port, cfg.Database)

	logger.Info("正在连接数据库", "host", cfg.Host, "port", cfg.Port, "database", cfg.Database)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		logger.Error("数据库连接失败", "error", err.Error(), "duration_ms", time.Since(start).Milliseconds())
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		logger.Error("数据库ping失败", "error", err.Error(), "duration_ms", time.Since(start).Milliseconds())
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// 设置连接池参数
	db.SetMaxOpenConns(100)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(0)

	logger.Info("数据库连接成功", "duration_ms", time.Since(start).Milliseconds(), 
		"max_open_conns", 100, "max_idle_conns", 10)

	return db, nil
}
