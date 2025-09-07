package config

import (
	"os"
	"strconv"
)

type Config struct {
	Database DatabaseConfig
	HTTP     HTTPConfig
	WeChat   WeChatConfig
	COS      COSConfig
	Log      LogConfig
	Service  ServiceConfig
}

type DatabaseConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	Database string
}

type HTTPConfig struct {
	Port     int
	CertFile string
	KeyFile  string
}

type WeChatConfig struct {
	AppID     string
	AppSecret string
}

type COSConfig struct {
	Bucket    string
	Region    string
	SecretID  string
	SecretKey string
}

type LogConfig struct {
	Level string
	Dir   string
}

type ServiceConfig struct {
	Name    string
	User    string
	WorkDir string
}

func Load() *Config {
	return &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvAsInt("DB_PORT", 3306),
			Username: getEnv("DB_USERNAME", "root"),
			Password: getEnv("DB_PASSWORD", "123456"),
			Database: getEnv("DB_NAME", "mahjong_score"),
		},
		HTTP: HTTPConfig{
			Port:     getEnvAsInt("HTTP_PORT", 8080),
			CertFile: getEnv("SSL_CERT_FILE", "/etc/ssl/certs/aipaint.cloud.crt"),
			KeyFile:  getEnv("SSL_KEY_FILE", "/etc/ssl/private/aipaint.cloud.key"),
		},
		WeChat: WeChatConfig{
			AppID:     getEnv("WECHAT_APP_ID", "wx367870ff70acb37b"),
			AppSecret: getEnv("WECHAT_APP_SECRET", "7127a700e080747019e13a01ec48816f"),
		},
		COS: COSConfig{
			Bucket:    getEnv("COS_BUCKET", "avatar-1251760642"),
			Region:    getEnv("COS_REGION", "ap-guangzhou"),
			SecretID:  getEnv("COS_SECRET_ID", "AKIDiV6Zrww476xcCUPL8kAMWY1NXURHwPfl"),
			SecretKey: getEnv("COS_SECRET_KEY", "ykKgtJoIbhdXHqCMJ3bx62wieVAfx2vc"),
		},
		Log: LogConfig{
			Level: getEnv("LOG_LEVEL", "INFO"),
			Dir:   getEnv("LOG_DIR", "/root/horry/score/server/logs"),
		},
		Service: ServiceConfig{
			Name:    getEnv("SERVICE_NAME", "mahjong-server"),
			User:    getEnv("SERVICE_USER", "root"),
			WorkDir: getEnv("SERVICE_WORK_DIR", "/root/horry/score/server"),
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
