// create-room.js
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    roomName: '',
    loading: false
  },

  async onLoad() {
    // 立即调用wx.login获取用户openid，确保用户信息可用
    try {
      console.log('开始获取用户登录信息...');
      const userInfo = await app.autoLogin();
      console.log('获取用户信息成功:', userInfo);
      
      // 保存到全局数据
      app.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
      
    } catch (error) {
      console.error('获取用户登录信息失败:', error);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
      return;
    }
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
          title: '房间创建成功！',
          icon: 'success'
        });
        
        // 保存最近房间信息
        wx.setStorageSync('recentRoom', roomData);
        console.log("保存的房间数据:", roomData)
        
        // 跳转到房间页面，优先使用room_id
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?roomId=${roomData.room_id}`,
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

  // 返回主页
  goToHome() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },
});
