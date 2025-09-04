// join-room.js
const apiService = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError } = require('../../utils/util');

Page({
  data: {
    roomCode: '',
  },

  onLoad(options) {
    // 如果从分享链接进入，自动填入房间号
    if (options.roomCode) {
      this.setData({
        roomCode: options.roomCode,
      });
    }
  },

  // 房间号输入
  onRoomCodeInput(e) {
    this.setData({
      roomCode: e.detail.value,
    });
  },

  // 加入房间
  async joinRoom() {
    const { roomCode } = this.data;
    
    if (!roomCode || roomCode.length !== 6) {
      showError('请输入6位房间号');
      return;
    }

    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        showError('请先登录');
        return;
      }

      showLoading('加入中...');
      const response = await apiService.joinRoom(userInfo.id, roomCode);
      hideLoading();

      if (response.code === 200) {
        const roomData = JSON.parse(response.data);
        showSuccess('加入房间成功');
        
        // 跳转到房间页面
        wx.redirectTo({
          url: `/pages/room/room?roomId=${roomData.room_id}`,
        });
      } else {
        showError(response.message || '加入房间失败');
      }
    } catch (error) {
      hideLoading();
      console.error('加入房间失败:', error);
      showError('加入房间失败');
    }
  },
});
