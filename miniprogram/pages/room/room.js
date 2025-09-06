// room.js
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    roomId: null,
    roomInfo: {},
    players: [],
    transfers: [],
    currentUserId: null,
    showShareModal: false,
    loading: false
  },

  onLoad(options) {
    const { roomId } = options;
    console.log('房间页面onLoad，接收到的参数:', options);
    console.log('roomId值:', roomId, '类型:', typeof roomId);
    
    if (roomId) {
      const parsedRoomId = parseInt(roomId);
      console.log('解析后的roomId:', parsedRoomId);
      
      if (isNaN(parsedRoomId)) {
        console.error('roomId解析失败，不是有效数字:', roomId);
        wx.showToast({
          title: '房间ID无效',
          icon: 'none'
        });
        return;
      }
      
      this.setData({ roomId: parsedRoomId });
      this.loadRoomData();
    } else {
      console.error('未接收到roomId参数');
      wx.showToast({
        title: '缺少房间ID',
        icon: 'none'
      });
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
      console.log('loadRoomData开始，当前roomId:', this.data.roomId);
      
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      if (!userInfo || !userInfo.user_id) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      if (!this.data.roomId || isNaN(this.data.roomId)) {
        console.error('roomId无效:', this.data.roomId);
        wx.showToast({
          title: '房间ID无效',
          icon: 'none'
        });
        return;
      }

      this.setData({ 
        currentUserId: userInfo.user_id,
        loading: true 
      });

      wx.showLoading({ title: '加载中...' });
      
      console.log('开始加载房间数据，roomId:', this.data.roomId);
      
      // 并行加载房间信息、玩家信息和转移记录
      const [roomResponse, playersResponse, transfersResponse] = await Promise.all([
        api.getRoom(this.data.roomId),
        api.getRoomPlayers(this.data.roomId),
        api.getRoomTransfers(this.data.roomId),
      ]);

      wx.hideLoading();

      if (roomResponse.code === 200) {
        this.setData({
          roomInfo: roomResponse.data,
        });
      }

      if (playersResponse.code === 200) {
        this.setData({
          players: playersResponse.data,
        });
      }

      if (transfersResponse.code === 200) {
        this.setData({
          transfers: transfersResponse.data,
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('加载房间数据失败:', error);
      wx.showToast({
        title: '加载房间数据失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 快速转移
  async quickTransfer(e) {
    const player = e.currentTarget.dataset.player;
    const { currentUserId } = this.data;

    if (player.user_id === currentUserId) {
      wx.showToast({
        title: '不能给自己转移分数',
        icon: 'none'
      });
      return;
    }

    try {
      const amount = await this.showTransferInput(player.user.nickname, player.current_score);
      if (!amount || amount <= 0) return;

      wx.showLoading({ title: '转移中...' });
      const response = await api.transferScore(
        this.data.roomId,
        currentUserId,
        player.user_id,
        amount
      );
      wx.hideLoading();

      if (response.code === 200) {
        wx.showToast({
          title: '转移成功',
          icon: 'success'
        });
        this.loadRoomData(); // 重新加载数据
      } else {
        wx.showToast({
          title: response.message || '转移失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('转移分数失败:', error);
      wx.showToast({
        title: '转移失败',
        icon: 'none'
      });
    }
  },

  // 显示转移输入框
  showTransferInput(playerName, currentScore) {
    return new Promise((resolve) => {
      wx.showModal({
        title: '转移分数',
        content: `向 ${playerName} 转移分数\n当前分数：${currentScore}\n请输入转移分数：`,
        editable: true,
        placeholderText: '50',
        success: (res) => {
          if (res.confirm && res.content) {
            const amount = parseInt(res.content);
            if (isNaN(amount) || amount <= 0) {
              wx.showToast({
                title: '请输入有效的分数',
                icon: 'none'
              });
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
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认结算',
        content: '确定要结算房间吗？结算后房间将结束，无法再进行分数转移。',
        success: (res) => {
          resolve(res.confirm);
        },
        fail: () => {
          resolve(false);
        }
      });
    });
    
    if (!confirmed) return;

    try {
      wx.showLoading({ title: '结算中...' });
      const response = await api.settleRoom(this.data.roomId, this.data.currentUserId);
      wx.hideLoading();

      if (response.code === 200) {
        wx.showToast({
          title: '结算成功',
          icon: 'success'
        });
        this.loadRoomData(); // 重新加载数据
      } else {
        wx.showToast({
          title: response.message || '结算失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('结算房间失败:', error);
      wx.showToast({
        title: '结算失败',
        icon: 'none'
      });
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
    wx.showToast({
      title: '请使用右上角分享功能',
      icon: 'success'
    });
    this.hideShareModal();
  },

  // 复制房间号
  copyRoomCode() {
    const roomCode = this.data.roomInfo.room_code;
    if (roomCode) {
      wx.setClipboardData({
        data: roomCode,
        success: () => {
          wx.showToast({
            title: '房间号已复制',
            icon: 'success'
          });
          this.hideShareModal();
        }
      });
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
