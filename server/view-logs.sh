#!/bin/bash

# 日志查看脚本
# 方便查看和管理服务日志

set -e

LOG_DIR="./logs"

echo "=== 麻将记分服务日志查看工具 ==="

# 检查日志目录是否存在
if [ ! -d "$LOG_DIR" ]; then
    echo "日志目录不存在: $LOG_DIR"
    echo "请先启动服务以生成日志文件"
    exit 1
fi

# 显示可用的日志文件
echo "可用的日志文件:"
ls -lh "$LOG_DIR"/log_*.log 2>/dev/null || {
    echo "没有找到日志文件"
    exit 1
}

echo ""
echo "请选择操作:"
echo "1. 查看最新日志文件"
echo "2. 实时监控最新日志"
echo "3. 查看指定日志文件"
echo "4. 搜索日志内容"
echo "5. 清理旧日志文件"
echo "6. 退出"

read -p "请输入选择 (1-6): " choice

case $choice in
    1)
        # 查看最新日志文件
        LATEST_LOG=$(ls -t "$LOG_DIR"/log_*.log | head -1)
        echo "查看最新日志文件: $(basename $LATEST_LOG)"
        echo "=========================================="
        cat "$LATEST_LOG"
        ;;
    2)
        # 实时监控最新日志
        LATEST_LOG=$(ls -t "$LOG_DIR"/log_*.log | head -1)
        echo "实时监控日志文件: $(basename $LATEST_LOG)"
        echo "按 Ctrl+C 退出监控"
        echo "=========================================="
        tail -f "$LATEST_LOG"
        ;;
    3)
        # 查看指定日志文件
        echo ""
        echo "日志文件列表:"
        ls -1 "$LOG_DIR"/log_*.log | nl
        echo ""
        read -p "请输入文件编号: " file_num
        LOG_FILE=$(ls -1 "$LOG_DIR"/log_*.log | sed -n "${file_num}p")
        if [ -z "$LOG_FILE" ]; then
            echo "无效的文件编号"
            exit 1
        fi
        echo "查看日志文件: $(basename $LOG_FILE)"
        echo "=========================================="
        cat "$LOG_FILE"
        ;;
    4)
        # 搜索日志内容
        echo ""
        read -p "请输入搜索关键词: " keyword
        if [ -z "$keyword" ]; then
            echo "搜索关键词不能为空"
            exit 1
        fi
        echo "在所有日志文件中搜索: $keyword"
        echo "=========================================="
        grep -r "$keyword" "$LOG_DIR" --include="*.log" || echo "没有找到匹配的内容"
        ;;
    5)
        # 清理旧日志文件
        echo ""
        read -p "请输入要保留的天数 (默认7天): " days
        days=${days:-7}
        echo "清理 $days 天前的日志文件..."
        find "$LOG_DIR" -name "log_*.log" -type f -mtime +$days -delete
        echo "清理完成"
        ;;
    6)
        echo "退出"
        exit 0
        ;;
    *)
        echo "无效选择"
        exit 1
        ;;
esac
