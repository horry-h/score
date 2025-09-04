// create-room.js
const apiService = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError } = require('../../utils/util');

Page({
  data: {
    roomName: '',
  },

  // 房间名称输入
  onRoomNameInput(e) {
    this.setData({
      roomName: e.detail.value,
    });
  },

  // 创建房间
  async createRoom() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        showError('请先登录');
        return;
      }

      showLoading('创建中...');
      const response = await apiService.createRoom(userInfo.id, this.data.roomName);
      hideLoading();

      if (response.code === 200) {
        const roomData = JSON.parse(response.data);
        showSuccess(`房间创建成功！\n房间号：${roomData.room_code}`);
        
        // 跳转到房间页面
        wx.redirectTo({
          url: `/pages/room/room?roomId=${roomData.room_id}`,
        });
      } else {
        showError(response.message || '创建房间失败');
      }
    } catch (error) {
      hideLoading();
      console.error('创建房间失败:', error);
      showError('创建房间失败');
    }
  },
});
