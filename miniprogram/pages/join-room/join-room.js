// join-room.js
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    roomCode: '',
    loading: false
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
      wx.showToast({
        title: '请输入6位房间号',
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
      wx.showLoading({ title: '加入中...' });

      const response = await api.joinRoom(userInfo.user_id, roomCode);
      
      if (response.code === 200) {
        console.log("加入房间响应:", response)
        
        // 解析data字段中的JSON字符串
        let roomData;
        try {
          roomData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          console.log("解析后的房间数据:", roomData)
        } catch (error) {
          console.error("解析房间数据失败:", error)
          wx.hideLoading();
          wx.showToast({
            title: '房间数据解析失败',
            icon: 'none'
          });
          return;
        }
        
        wx.hideLoading();
        wx.showToast({
          title: '加入房间成功',
          icon: 'success'
        });
        
        // 保存最近房间信息
        wx.setStorageSync('recentRoom', roomData);
        console.log("保存的房间数据:", roomData)
        console.log("房间号:", roomData.room_code)
        
        // 跳转到房间页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?roomCode=${roomData.room_code}`,
          });
        }, 1500);
      } else {
        wx.hideLoading();
        wx.showToast({
          title: response.message || '加入房间失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('加入房间失败:', error);
      wx.showToast({
        title: '加入房间失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
