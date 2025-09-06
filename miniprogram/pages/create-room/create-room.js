// create-room.js
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    roomName: '',
    loading: false
  },

  // 房间名称输入
  onRoomNameInput(e) {
    this.setData({
      roomName: e.detail.value,
    });
  },

  // 创建房间
  async createRoom() {
    if (!this.data.roomName.trim()) {
      wx.showToast({
        title: '请输入房间名称',
        icon: 'none'
      });
      return;
    }

    try {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      if (!userInfo || !userInfo.user_id) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      this.setData({ loading: true });
      wx.showLoading({ title: '创建中...' });

      const response = await api.createRoom(userInfo.user_id, this.data.roomName);
      
      if (response.code === 200) {
        wx.hideLoading();
        wx.showToast({
          title: '房间创建成功！',
          icon: 'success'
        });
        
        // 保存最近房间信息
        wx.setStorageSync('recentRoom', response.data);
        
        // 跳转到房间页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?roomCode=${response.data.room_code}`,
          });
        }, 1500);
      } else {
        wx.hideLoading();
        wx.showToast({
          title: response.message || '创建房间失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('创建房间失败:', error);
      wx.showToast({
        title: '创建房间失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
