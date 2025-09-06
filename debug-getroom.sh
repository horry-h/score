#!/bin/bash
# 调试GetRoom API问题

echo "=== 调试GetRoom API问题 ==="

echo "1. 测试健康检查API:"
curl -s "http://124.156.196.117:8080/api/v1/health" | jq .

echo -e "\n2. 测试GetRoom API (room_id=1):"
curl -s "http://124.156.196.117:8080/api/v1/getRoom?room_id=1" | jq .

echo -e "\n3. 测试GetRoom API (room_code):"
curl -s "http://124.156.196.117:8080/api/v1/getRoom?room_code=1757148526034968" | jq .

echo -e "\n4. 检查数据库中的房间数据:"
ssh root@124.156.196.117 "mysql -u root -p123456 mahjong_score -e 'SELECT id, room_code, room_name, creator_id, status, created_at, settled_at FROM rooms WHERE id = 1;'"

echo -e "\n5. 检查后端服务日志:"
ssh root@124.156.196.117 "journalctl -u score-server -n 10 --no-pager"

echo -e "\n=== 调试完成 ==="
