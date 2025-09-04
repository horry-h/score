// room.js
const apiService = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError, showConfirm, copyToClipboard, formatTimestamp, formatScore } = require('../../utils/util');

Page({
  data: {
    roomId: null,
    roomInfo: {},
    players: [],
    transfers: [],
    currentUserId: null,
    showShareModal: false,
  },

  onLoad(options) {
    const { roomId } = options;
    if (roomId) {
      this.setData({ roomId: parseInt(roomId) });
      this.loadRoomData();
    }
  },

  onShow() {
    if (this.data.roomId) {
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

      this.setData({ currentUserId: userInfo.id });

      showLoading('加载中...');
      
      // 并行加载房间信息、玩家信息和转移记录
      const [roomResponse, playersResponse, transfersResponse] = await Promise.all([
        apiService.getRoom(this.data.roomId),
        apiService.getRoomPlayers(this.data.roomId),
        apiService.getRoomTransfers(this.data.roomId),
      ]);

      hideLoading();

      if (roomResponse.code === 200) {
        this.setData({
          roomInfo: JSON.parse(roomResponse.data),
        });
      }

      if (playersResponse.code === 200) {
        this.setData({
          players: JSON.parse(playersResponse.data),
        });
      }

      if (transfersResponse.code === 200) {
        this.setData({
          transfers: JSON.parse(transfersResponse.data),
        });
      }
    } catch (error) {
      hideLoading();
      console.error('加载房间数据失败:', error);
      showError('加载房间数据失败');
    }
  },

  // 快速转移
  async quickTransfer(e) {
    const player = e.currentTarget.dataset.player;
    const { currentUserId } = this.data;

    if (player.user_id === currentUserId) {
      showError('不能给自己转移分数');
      return;
    }

    try {
      const amount = await this.showTransferInput(player.user.nickname, player.current_score);
      if (!amount || amount <= 0) return;

      showLoading('转移中...');
      const response = await apiService.transferScore(
        this.data.roomId,
        currentUserId,
        player.user_id,
        amount
      );
      hideLoading();

      if (response.code === 200) {
        showSuccess('转移成功');
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

  // 显示转移输入框
  showTransferInput(playerName, currentScore) {
    return new Promise((resolve) => {
      wx.showModal({
        title: '转移分数',
        content: `向 ${playerName} 转移分数\n当前分数：${formatScore(currentScore)}\n请输入转移分数：`,
        editable: true,
        placeholderText: '50',
        success: (res) => {
          if (res.confirm && res.content) {
            const amount = parseInt(res.content);
            if (isNaN(amount) || amount <= 0) {
              showError('请输入有效的分数');
              resolve(null);
            } else {
              resolve(amount);
            }
          } else {
            resolve(null);
          }
        },
        fail: () => {
          resolve(null);
        },
      });
    });
  },

  // 跳转到详细转移页面
  goToTransfer() {
    wx.navigateTo({
      url: `/pages/transfer/transfer?roomId=${this.data.roomId}`,
    });
  },

  // 结算房间
  async settleRoom() {
    const confirmed = await showConfirm('确定要结算房间吗？结算后房间将结束，无法再进行分数转移。', '确认结算');
    if (!confirmed) return;

    try {
      showLoading('结算中...');
      const response = await apiService.settleRoom(this.data.roomId, this.data.currentUserId);
      hideLoading();

      if (response.code === 200) {
        showSuccess('结算成功');
        this.loadRoomData(); // 重新加载数据
      } else {
        showError(response.message || '结算失败');
      }
    } catch (error) {
      hideLoading();
      console.error('结算房间失败:', error);
      showError('结算失败');
    }
  },

  // 分享房间
  shareRoom() {
    this.setData({ showShareModal: true });
  },

  // 隐藏分享模态框
  hideShareModal() {
    this.setData({ showShareModal: false });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 分享给微信好友
  shareToWeChat() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
    showSuccess('请使用右上角分享功能');
    this.hideShareModal();
  },

  // 复制房间号
  copyRoomCode() {
    const roomCode = this.data.roomInfo.room_code;
    if (roomCode) {
      copyToClipboard(roomCode);
      this.hideShareModal();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadRoomData();
    wx.stopPullDownRefresh();
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `麻将记分房间 ${this.data.roomInfo.room_code}`,
      path: `/pages/join-room/join-room?roomCode=${this.data.roomInfo.room_code}`,
    };
  },
});
