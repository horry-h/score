// transfer.js
const apiService = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError, formatScore } = require('../../utils/util');

Page({
  data: {
    roomId: null,
    players: [],
    currentUser: null,
    selectedPlayer: null,
    transferAmount: 50,
    showConfirm: false,
  },

  onLoad(options) {
    const { roomId } = options;
    if (roomId) {
      this.setData({ roomId: parseInt(roomId) });
      this.loadRoomData();
    }
  },

  // 加载房间数据
  async loadRoomData() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        showError('请先登录');
        return;
      }

      showLoading('加载中...');
      const response = await apiService.getRoomPlayers(this.data.roomId);
      hideLoading();

      if (response.code === 200) {
        const players = JSON.parse(response.data);
        const currentUser = players.find(p => p.user_id === userInfo.id);
        
        this.setData({
          players,
          currentUser,
        });
      } else {
        showError(response.message || '加载玩家信息失败');
      }
    } catch (error) {
      hideLoading();
      console.error('加载房间数据失败:', error);
      showError('加载房间数据失败');
    }
  },

  // 发起转移
  initiateTransfer(e) {
    const player = e.currentTarget.dataset.player;
    const { currentUser } = this.data;

    if (player.user_id === currentUser.user_id) {
      showError('不能给自己转移分数');
      return;
    }

    this.setData({
      selectedPlayer: player,
      showConfirm: true,
    });
  },

  // 转移分数输入
  onAmountInput(e) {
    this.setData({
      transferAmount: parseInt(e.detail.value) || 0,
    });
  },

  // 确认转移
  async confirmTransfer() {
    const { selectedPlayer, transferAmount, currentUser } = this.data;

    if (!transferAmount || transferAmount <= 0) {
      showError('请输入有效的转移分数');
      return;
    }

    try {
      showLoading('转移中...');
      const response = await apiService.transferScore(
        this.data.roomId,
        currentUser.user_id,
        selectedPlayer.user_id,
        transferAmount
      );
      hideLoading();

      if (response.code === 200) {
        showSuccess('转移成功');
        this.cancelTransfer();
        this.loadRoomData(); // 重新加载数据
      } else {
        showError(response.message || '转移失败');
      }
    } catch (error) {
      hideLoading();
      console.error('转移分数失败:', error);
      showError('转移失败');
    }
  },

  // 取消转移
  cancelTransfer() {
    this.setData({
      showConfirm: false,
      selectedPlayer: null,
      transferAmount: 50,
    });
  },
});
