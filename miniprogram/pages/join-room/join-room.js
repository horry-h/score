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
    // 如果从其他页面传入roomId，也自动填入
    if (options.roomId) {
      this.setData({
        roomCode: options.roomId,
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
    
    if (!roomCode || roomCode.trim() === '') {
      wx.showToast({
        title: '请输入房间号',
        icon: 'none'
      });
      return;
    }

    // 验证房间号是否为有效数字
    const roomId = parseInt(roomCode);
    if (isNaN(roomId) || roomId <= 0) {
      wx.showToast({
        title: '请输入有效的房间号',
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

      const response = await api.joinRoom(userInfo.user_id, roomId);
      
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
        
        // 跳转到房间页面，优先使用room_id
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?roomId=${roomData.room_id}`,
          });
        }, 1500);
      } else {
        wx.hideLoading();
        
        // 处理不同的错误情况
        if (response.message === '房间已结算') {
          wx.showModal({
            title: '房间已结束',
            content: '该房间已经结算，无法加入',
            showCancel: false,
            confirmText: '知道了'
          });
        } else if (response.message === '已在房间中') {
          // 用户已经在房间中，直接进入房间
          wx.showToast({
            title: '您已在此房间中',
            icon: 'success'
          });
          
          // 解析返回的房间数据并跳转
          let roomData;
          try {
            console.log("已在房间中，原始响应:", response);
            console.log("response.data类型:", typeof response.data);
            console.log("response.data内容:", response.data);
            
            roomData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            console.log("已在房间中，解析后的房间数据:", roomData);
            console.log("房间ID:", roomData.id, "类型:", typeof roomData.id);
            
            // 检查房间ID是否有效
            if (!roomData.id || roomData.id === 0) {
              console.error("房间ID无效:", roomData.id);
              wx.showToast({
                title: '房间信息异常',
                icon: 'none'
              });
              return;
            }
            
            // 保存最近房间信息
            wx.setStorageSync('recentRoom', roomData);
            
            // 直接跳转到房间页面
            setTimeout(() => {
              const roomId = roomData.id;
              console.log("准备跳转到房间页面，roomId:", roomId);
              wx.redirectTo({
                url: `/pages/room/room?roomId=${roomId}`,
              });
            }, 1500);
          } catch (error) {
            console.error("解析房间数据失败:", error);
            // 如果解析失败，尝试通过API获取房间信息
            setTimeout(async () => {
              try {
                const roomResponse = await api.getRoom(roomId);
                if (roomResponse.code === 200) {
                  let roomData;
                  try {
                    roomData = typeof roomResponse.data === 'string' ? JSON.parse(roomResponse.data) : roomResponse.data;
                    wx.redirectTo({
                      url: `/pages/room/room?roomId=${roomData.id}`,
                    });
                  } catch (error) {
                    console.error("解析房间数据失败:", error);
                  }
                }
              } catch (error) {
                console.error("获取房间信息失败:", error);
              }
            }, 1500);
          }
        } else {
          wx.showToast({
            title: response.message || '加入房间失败',
            icon: 'none'
          });
        }
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

  // 返回主页
  goToHome() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },
});
