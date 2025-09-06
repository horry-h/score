package config

import (
	"os"
	"strconv"
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
	return &Config{
		Database: DatabaseConfig{
			Host:     "localhost",
			Port:     3306,
			Username: "root",
			Password: "123456",
			Database: "mahjong_score",
		},
		HTTP: HTTPConfig{
			Port: 8080,
		},
		WeChat: WeChatConfig{
			AppID:     "wx367870ff70acb37b",
			AppSecret: "7127a700e080747019e13a01ec48816f",
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
