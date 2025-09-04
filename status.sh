#!/bin/bash

# 部署状态检查脚本
# 使用方法: ./status.sh

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="score-server"
SERVER_IP="124.156.196.117"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Score项目部署状态检查${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查项目目录
echo -e "${YELLOW}项目目录:${NC}"
echo -e "  当前目录: $(pwd)"
if [ -f "deploy.sh" ] && [ -d "server" ]; then
    echo -e "  ${GREEN}✅ 项目结构正确${NC}"
else
    echo -e "  ${RED}❌ 项目结构错误${NC}"
    exit 1
fi

# 检查Go环境
echo -e "\n${YELLOW}Go环境:${NC}"
if command -v go &> /dev/null; then
    echo -e "  ${GREEN}✅ Go已安装: $(go version)${NC}"
else
    echo -e "  ${RED}❌ Go未安装${NC}"
fi

# 检查MySQL
echo -e "\n${YELLOW}MySQL服务:${NC}"
if systemctl is-active --quiet mysql; then
    echo -e "  ${GREEN}✅ MySQL服务运行中${NC}"
else
    echo -e "  ${RED}❌ MySQL服务未运行${NC}"
fi

# 检查数据库
echo -e "\n${YELLOW}数据库:${NC}"
DB_EXISTS=$(mysql -e "SHOW DATABASES LIKE 'mahjong_score';" 2>/dev/null | grep -c "mahjong_score" || echo "0")
if [ "$DB_EXISTS" -gt 0 ]; then
    echo -e "  ${GREEN}✅ 数据库 mahjong_score 存在${NC}"
    
    # 检查表结构
    TABLE_COUNT=$(mysql -u mahjong_user -pMahjong2024! mahjong_score -e "SHOW TABLES;" 2>/dev/null | wc -l || echo "0")
    if [ "$TABLE_COUNT" -gt 1 ]; then
        echo -e "  ${GREEN}✅ 数据库表结构完整 (${TABLE_COUNT} 个表)${NC}"
    else
        echo -e "  ${YELLOW}⚠️  数据库表结构可能不完整${NC}"
    fi
else
    echo -e "  ${RED}❌ 数据库 mahjong_score 不存在${NC}"
fi

# 检查应用服务
echo -e "\n${YELLOW}应用服务:${NC}"
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "  ${GREEN}✅ 服务运行中${NC}"
    echo -e "  服务状态: $(systemctl is-active $SERVICE_NAME)"
    echo -e "  启动时间: $(systemctl show $SERVICE_NAME --property=ActiveEnterTimestamp --value)"
else
    echo -e "  ${RED}❌ 服务未运行${NC}"
fi

# 检查端口监听
echo -e "\n${YELLOW}端口监听:${NC}"
if netstat -tlnp 2>/dev/null | grep -q ":8080"; then
    echo -e "  ${GREEN}✅ 端口 8080 正在监听${NC}"
else
    echo -e "  ${RED}❌ 端口 8080 未监听${NC}"
fi

# 检查防火墙
echo -e "\n${YELLOW}防火墙:${NC}"
if ufw status | grep -q "8080"; then
    echo -e "  ${GREEN}✅ 防火墙已开放端口 8080${NC}"
else
    echo -e "  ${YELLOW}⚠️  防火墙可能未配置端口 8080${NC}"
fi

# 健康检查
echo -e "\n${YELLOW}健康检查:${NC}"
if curl -f -s http://localhost:8080/api/v1/health > /dev/null; then
    echo -e "  ${GREEN}✅ API健康检查通过${NC}"
    echo -e "  服务地址: http://${SERVER_IP}:8080"
    echo -e "  健康检查: http://${SERVER_IP}:8080/api/v1/health"
else
    echo -e "  ${RED}❌ API健康检查失败${NC}"
fi

# 检查环境配置
echo -e "\n${YELLOW}环境配置:${NC}"
if [ -f ".env" ]; then
    echo -e "  ${GREEN}✅ 环境配置文件存在${NC}"
    if grep -q "WECHAT_APPID=your_wechat_appid" .env; then
        echo -e "  ${YELLOW}⚠️  需要配置微信小程序AppID和AppSecret${NC}"
    else
        echo -e "  ${GREEN}✅ 微信配置已设置${NC}"
    fi
else
    echo -e "  ${RED}❌ 环境配置文件不存在${NC}"
fi

# 显示最近日志
echo -e "\n${YELLOW}最近日志 (最后5行):${NC}"
journalctl -u $SERVICE_NAME --no-pager -n 5 2>/dev/null || echo "  无法获取日志"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  状态检查完成${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}常用命令:${NC}"
echo -e "  查看服务状态: systemctl status $SERVICE_NAME"
echo -e "  查看服务日志: journalctl -u $SERVICE_NAME -f"
echo -e "  重启服务: systemctl restart $SERVICE_NAME"
echo -e "  更新代码: ./update.sh"
