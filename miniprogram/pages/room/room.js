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
    loading: false,
    qrCodeData: null,
    qrCodeLoading: false
  },

  onLoad(options) {
    console.log('房间页面onLoad，接收到的参数:', options);
    
    const { roomId, roomCode } = options;
    console.log('roomId值:', roomId, '类型:', typeof roomId);
    console.log('roomCode值:', roomCode, '类型:', typeof roomCode);
    
    // 优先使用roomId，如果没有则使用roomCode
    if (roomId && roomId !== 'undefined' && roomId !== 'null' && roomId.trim() !== '') {
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
      
      console.log('使用roomId进入房间:', parsedRoomId);
      this.setData({ roomId: parsedRoomId });
      this.loadRoomData();
    } else if (roomCode && roomCode !== 'undefined' && roomCode !== 'null' && roomCode.trim() !== '') {
      console.log('使用roomCode进入房间:', roomCode);
      this.setData({ roomCode: roomCode });
      this.loadRoomData();
    } else {
      console.error('未接收到有效的roomId或roomCode参数:', { roomId, roomCode });
      wx.showToast({
        title: '缺少房间信息',
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
      console.log('loadRoomData开始，当前roomCode:', this.data.roomCode);
      
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      if (!userInfo || !userInfo.user_id) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      // 检查是否有有效的房间标识
      if (!this.data.roomId && !this.data.roomCode) {
        console.error('房间标识无效，roomId:', this.data.roomId, 'roomCode:', this.data.roomCode);
        wx.showToast({
          title: '房间信息无效',
          icon: 'none'
        });
        return;
      }

      this.setData({ 
        currentUserId: userInfo.user_id,
        loading: true 
      });

      wx.showLoading({ title: '加载中...' });
      
      console.log('开始加载房间数据，roomId:', this.data.roomId, 'roomCode:', this.data.roomCode);
      
      // 先获取房间信息
      console.log('调用api.getRoom，参数:', { roomId: this.data.roomId, roomCode: this.data.roomCode });
      const roomResponse = await api.getRoom(this.data.roomId, this.data.roomCode);
      console.log('getRoom响应:', roomResponse);
      
      if (roomResponse.code === 200) {
        // 解析JSON字符串
        let roomData;
        try {
          roomData = typeof roomResponse.data === 'string' ? JSON.parse(roomResponse.data) : roomResponse.data;
          console.log('解析后的房间数据:', roomData);
        } catch (error) {
          console.error('解析房间数据失败:', error);
          wx.hideLoading();
          wx.showToast({
            title: '房间数据解析失败',
            icon: 'none'
          });
          return;
        }
        
        this.setData({
          roomInfo: roomData,
        });
        
        // 如果使用roomCode进入，需要获取roomId用于后续API调用
        if (this.data.roomCode && !this.data.roomId) {
          this.setData({ roomId: roomData.id });
          console.log('从roomCode获取到roomId:', roomData.id);
        }
        
        // 现在加载玩家信息和转移记录
        const [playersResponse, transfersResponse] = await Promise.all([
          api.getRoomPlayers(this.data.roomId),
          api.getRoomTransfers(this.data.roomId),
        ]);
        
        if (playersResponse.code === 200) {
          // 解析玩家数据JSON字符串
          let playersData;
          try {
            playersData = typeof playersResponse.data === 'string' ? JSON.parse(playersResponse.data) : playersResponse.data;
            console.log('解析后的玩家数据:', playersData);
          } catch (error) {
            console.error('解析玩家数据失败:', error);
            playersData = [];
          }
          this.setData({
            players: playersData,
          });
        }

        if (transfersResponse.code === 200) {
          // 解析转移记录JSON字符串
          let transfersData;
          try {
            transfersData = typeof transfersResponse.data === 'string' ? JSON.parse(transfersResponse.data) : transfersResponse.data;
            console.log('解析后的转移记录数据:', transfersData);
          } catch (error) {
            console.error('解析转移记录数据失败:', error);
            transfersData = [];
          }
          this.setData({
            transfers: transfersData,
          });
        }
      } else {
        wx.hideLoading();
        wx.showToast({
          title: roomResponse.message || '加载房间信息失败',
          icon: 'none'
        });
        return;
      }

      wx.hideLoading();
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
    // 自动生成二维码
    this.generateQRCode();
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
    const roomId = this.data.roomInfo.id;
    if (roomId) {
      wx.setClipboardData({
        data: roomId.toString(),
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
    // 自动生成二维码
    this.generateQRCode();
    
    return {
      title: `麻将记分房间 ${this.data.roomInfo.id}`,
      path: `/pages/join-room/join-room?roomId=${this.data.roomInfo.id}`,
    };
  },

  // 生成二维码
  async generateQRCode() {
    if (this.data.qrCodeLoading) {
      return;
    }

    this.setData({ qrCodeLoading: true });

    try {
      const response = await api.generateQRCode(this.data.roomId);
      console.log('生成二维码响应:', response);

      if (response.code === 200) {
        const qrData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        this.setData({
          qrCodeData: qrData.qr_code
        });
        wx.showToast({
          title: '二维码生成成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: response.message || '生成失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ qrCodeLoading: false });
    }
  },

  // 返回主页
  goToHome() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },
});
