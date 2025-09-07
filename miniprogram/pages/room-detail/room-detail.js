// room-detail.js
const apiService = require('../../utils/api');
const { showLoading, hideLoading, showError, formatTimestamp, formatScore } = require('../../utils/util');

Page({
  data: {
    roomId: null,
    roomInfo: {},
    players: [],
    transfers: [],
    settlements: [],
    gameDuration: '',
  },

  onLoad(options) {
    const { roomId } = options;
    if (roomId) {
      this.setData({ roomId: parseInt(roomId) });
      this.loadRoomDetail();
    }
  },

  // 加载房间详情
  async loadRoomDetail() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        showError('请先登录');
        return;
      }

      showLoading('加载中...');
      const response = await apiService.getRoomDetail(this.data.roomId, userInfo.user_id);
      hideLoading();

      if (response.code === 200) {
        const detail = JSON.parse(response.data);
        const { room, transfers, settlements } = detail;
        
        // 计算游戏时长
        const gameDuration = this.calculateGameDuration(room.created_at, room.settled_at);
        
        this.setData({
          roomInfo: room,
          players: room.players || [],
          transfers: transfers || [],
          settlements: settlements || [],
          gameDuration,
        });
      } else {
        showError(response.message || '加载房间详情失败');
      }
    } catch (error) {
      hideLoading();
      console.error('加载房间详情失败:', error);
      showError('加载房间详情失败');
    }
  },

  // 计算游戏时长
  calculateGameDuration(startTime, endTime) {
    if (!startTime || !endTime) return '';
    
    const start = new Date(startTime * 1000);
    const end = new Date(endTime * 1000);
    const diff = end - start;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  },

  // 返回历史房间
  backToHistory() {
    wx.navigateBack();
  },

  // 返回主页
  goToHome() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },
});
