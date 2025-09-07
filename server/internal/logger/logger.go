package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

// LogLevel 日志级别
type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
	FATAL
)

// Logger 日志器结构
type Logger struct {
	debugLogger *log.Logger
	infoLogger  *log.Logger
	warnLogger  *log.Logger
	errorLogger *log.Logger
	fatalLogger *log.Logger
	file        *os.File
	level       LogLevel
}

var (
	// 全局日志器实例
	globalLogger *Logger
)

// 日志级别字符串映射
var levelStrings = map[LogLevel]string{
	DEBUG: "DEBUG",
	INFO:  "INFO",
	WARN:  "WARN",
	ERROR: "ERROR",
	FATAL: "FATAL",
}

// 日志级别颜色映射
var levelColors = map[LogLevel]string{
	DEBUG: "\033[36m", // 青色
	INFO:  "\033[32m", // 绿色
	WARN:  "\033[33m", // 黄色
	ERROR: "\033[31m", // 红色
	FATAL: "\033[35m", // 紫色
}

const resetColor = "\033[0m"

// cleanupOldLogs 清理旧日志文件，只保留最近3个
func cleanupOldLogs(logDir string) error {
	fmt.Printf("开始清理日志文件，目录: %s\n", logDir)
	
	// 读取日志目录中的所有文件
	files, err := os.ReadDir(logDir)
	if err != nil {
		return err
	}

	fmt.Printf("找到 %d 个文件\n", len(files))

	// 过滤出日志文件并按修改时间排序
	var logFiles []os.FileInfo
	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), "log_") && strings.HasSuffix(file.Name(), ".log") {
			info, err := file.Info()
			if err != nil {
				continue
			}
			logFiles = append(logFiles, info)
		}
	}

	fmt.Printf("找到 %d 个日志文件\n", len(logFiles))

	// 按修改时间排序（最新的在前）
	sort.Slice(logFiles, func(i, j int) bool {
		return logFiles[i].ModTime().After(logFiles[j].ModTime())
	})

	// 删除超过3个的旧日志文件
	deletedCount := 0
	for i := 3; i < len(logFiles); i++ {
		oldLogPath := filepath.Join(logDir, logFiles[i].Name())
		if err := os.Remove(oldLogPath); err != nil {
			// 记录错误但不中断初始化
			fmt.Printf("删除旧日志文件失败: %s, 错误: %v\n", oldLogPath, err)
		} else {
			fmt.Printf("已删除旧日志文件: %s\n", oldLogPath)
			deletedCount++
		}
	}

	fmt.Printf("清理完成，删除了 %d 个日志文件\n", deletedCount)
	return nil
}

// InitLogger 初始化日志器
func InitLogger(logDir string, level LogLevel) error {
	// 创建日志目录
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return fmt.Errorf("创建日志目录失败: %v", err)
	}

	// 清理旧日志文件，只保留最近3个
	if err := cleanupOldLogs(logDir); err != nil {
		return fmt.Errorf("清理旧日志文件失败: %v", err)
	}

	// 生成日志文件名
	timestamp := time.Now().Format("20060102_150405")
	logFileName := fmt.Sprintf("log_%s.log", timestamp)
	logFilePath := filepath.Join(logDir, logFileName)

	// 创建日志文件
	file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return fmt.Errorf("创建日志文件失败: %v", err)
	}

	// 创建多输出写入器（同时输出到文件和控制台）
	multiWriter := io.MultiWriter(file, os.Stdout)

	// 创建日志器
	logger := &Logger{
		debugLogger: log.New(multiWriter, "", 0),
		infoLogger:  log.New(multiWriter, "", 0),
		warnLogger:  log.New(multiWriter, "", 0),
		errorLogger: log.New(multiWriter, "", 0),
		fatalLogger: log.New(multiWriter, "", 0),
		file:        file,
		level:       level,
	}

	globalLogger = logger

	// 记录日志器初始化信息
	logger.Info("日志系统初始化完成", "log_file", logFilePath, "level", levelStrings[level])

	return nil
}

// GetLogger 获取全局日志器实例
func GetLogger() *Logger {
	if globalLogger == nil {
		// 如果没有初始化，使用默认配置
		InitLogger("./logs", INFO)
	}
	return globalLogger
}

// Close 关闭日志器
func (l *Logger) Close() error {
	if l.file != nil {
		l.Info("日志系统关闭")
		return l.file.Close()
	}
	return nil
}

// getCallerInfo 获取调用者信息，跳过logger.go中的函数调用
func (l *Logger) getCallerInfo() (pc uintptr, file string, line int, ok bool) {
	// 从调用栈中查找第一个不在logger.go中的调用者
	// 调用栈：实际调用 -> Debug/Info/Error等 -> log -> formatMessage -> getCallerInfo
	// 所以我们需要跳过前4层
	for i := 4; i < 10; i++ {
		pc, file, line, ok = runtime.Caller(i)
		if !ok {
			break
		}
		// 检查文件名是否包含logger.go
		if !strings.Contains(file, "logger.go") {
			return pc, file, line, ok
		}
	}
	return 0, "", 0, false
}

// formatMessage 格式化日志消息
func (l *Logger) formatMessage(level LogLevel, message string, fields ...interface{}) string {
	// 获取调用者信息，跳过logger.go中的函数调用
	_, file, line, ok := l.getCallerInfo()
	if !ok {
		file = "unknown"
		line = 0
	} else {
		// 只保留文件名，不包含路径
		file = filepath.Base(file)
	}

	// 构建时间戳
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")

	// 构建基础消息
	baseMsg := fmt.Sprintf("[%s] [%s] [%s:%d] %s",
		timestamp,
		levelStrings[level],
		file,
		line,
		message)

	// 添加字段信息
	if len(fields) > 0 {
		var fieldStrs []string
		for i := 0; i < len(fields); i += 2 {
			if i+1 < len(fields) {
				fieldStrs = append(fieldStrs, fmt.Sprintf("%v=%v", fields[i], fields[i+1]))
			}
		}
		if len(fieldStrs) > 0 {
			baseMsg += " | " + strings.Join(fieldStrs, " ")
		}
	}

	return baseMsg
}

// log 通用日志方法
func (l *Logger) log(level LogLevel, message string, fields ...interface{}) {
	if level < l.level {
		return
	}

	formattedMsg := l.formatMessage(level, message, fields...)

	// 根据级别选择对应的日志器
	switch level {
	case DEBUG:
		l.debugLogger.Println(formattedMsg)
	case INFO:
		l.infoLogger.Println(formattedMsg)
	case WARN:
		l.warnLogger.Println(formattedMsg)
	case ERROR:
		l.errorLogger.Println(formattedMsg)
	case FATAL:
		l.fatalLogger.Println(formattedMsg)
	}
}

// Debug 调试日志
func (l *Logger) Debug(message string, fields ...interface{}) {
	l.log(DEBUG, message, fields...)
}

// Info 信息日志
func (l *Logger) Info(message string, fields ...interface{}) {
	l.log(INFO, message, fields...)
}

// Warn 警告日志
func (l *Logger) Warn(message string, fields ...interface{}) {
	l.log(WARN, message, fields...)
}

// Error 错误日志
func (l *Logger) Error(message string, fields ...interface{}) {
	l.log(ERROR, message, fields...)
}

// Fatal 致命错误日志
func (l *Logger) Fatal(message string, fields ...interface{}) {
	l.log(FATAL, message, fields...)
	os.Exit(1)
}

// 全局日志函数
func Debug(message string, fields ...interface{}) {
	GetLogger().Debug(message, fields...)
}

func Info(message string, fields ...interface{}) {
	GetLogger().Info(message, fields...)
}

func Warn(message string, fields ...interface{}) {
	GetLogger().Warn(message, fields...)
}

func Error(message string, fields ...interface{}) {
	GetLogger().Error(message, fields...)
}

func Fatal(message string, fields ...interface{}) {
	GetLogger().Fatal(message, fields...)
}

// LogHTTPRequest 记录HTTP请求日志
func LogHTTPRequest(method, path, remoteAddr string, statusCode int, duration time.Duration, fields ...interface{}) {
	allFields := []interface{}{
		"method", method,
		"path", path,
		"remote_addr", remoteAddr,
		"status_code", statusCode,
		"duration_ms", duration.Milliseconds(),
	}
	allFields = append(allFields, fields...)
	
	if statusCode >= 400 {
		GetLogger().Error("HTTP请求错误", allFields...)
	} else {
		GetLogger().Info("HTTP请求", allFields...)
	}
}

// LogDatabase 记录数据库操作日志
func LogDatabase(operation, table string, duration time.Duration, err error, fields ...interface{}) {
	allFields := []interface{}{
		"operation", operation,
		"table", table,
		"duration_ms", duration.Milliseconds(),
	}
	allFields = append(allFields, fields...)
	
	if err != nil {
		allFields = append(allFields, "error", err.Error())
		GetLogger().Error("数据库操作失败", allFields...)
	} else {
		GetLogger().Debug("数据库操作成功", allFields...)
	}
}

// LogBusiness 记录业务逻辑日志
func LogBusiness(operation string, userID interface{}, fields ...interface{}) {
	allFields := []interface{}{
		"operation", operation,
		"user_id", userID,
	}
	allFields = append(allFields, fields...)
	GetLogger().Info("业务操作", allFields...)
}
