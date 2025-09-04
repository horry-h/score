package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Database DatabaseConfig
	HTTP     HTTPConfig
	WeChat   WeChatConfig
}

type DatabaseConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	Database string
}


type HTTPConfig struct {
	Port int
}

type WeChatConfig struct {
	AppID     string
	AppSecret string
}

func Load() *Config {
	// 加载.env文件
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: 无法加载.env文件: %v", err)
	}

	return &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvAsInt("DB_PORT", 3306),
			Username: getEnv("DB_USERNAME", "root"),
			Password: getEnv("DB_PASSWORD", ""),
			Database: getEnv("DB_DATABASE", "mahjong_score"),
		},
		HTTP: HTTPConfig{
			Port: getEnvAsInt("HTTP_PORT", 8080),
		},
		WeChat: WeChatConfig{
			AppID:     getEnv("WECHAT_APPID", ""),
			AppSecret: getEnv("WECHAT_APPSECRET", ""),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
