# Makefile for Mahjong Server

.PHONY: build run clean deps test migrate docker-build docker-run docker-compose-up docker-compose-down

# 构建应用
build:
	go build -o bin/mahjong-server main.go

# 运行应用
run:
	go run main.go

# 清理构建文件
clean:
	rm -rf bin/

# 安装依赖
deps:
	go mod tidy
	go mod download

# 运行测试
test:
	go test ./...

# 启动开发环境
dev:
	air

# 数据库迁移
migrate:
	mysql -u root -p mahjong_score < database.sql

# Docker相关命令
docker-build:
	docker build -t mahjong-server .

docker-run:
	docker run -p 8080:8080 --env-file .env mahjong-server

docker-compose-up:
	docker-compose up -d

docker-compose-down:
	docker-compose down
