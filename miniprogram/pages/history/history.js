// history.js
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    rooms: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
  },

  onLoad() {
    this.loadRooms();
  },

  // 加载房间列表
  async loadRooms() {
    if (this.data.loading) return;

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
      wx.showLoading({ title: '加载中...' });

      const response = await api.getUserRooms(
        userInfo.user_id,
        this.data.page,
        this.data.pageSize
      );

      wx.hideLoading();
      this.setData({ loading: false });

      if (response.code === 200) {
        // 解析房间列表JSON字符串
        let newRooms;
        try {
          newRooms = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          console.log('解析后的房间列表数据:', newRooms);
        } catch (error) {
          console.error('解析房间列表数据失败:', error);
          newRooms = [];
        }
        
        // 处理房间数据，格式化时间和分数
        const processedRooms = newRooms.map(room => ({
          ...room,
          formatted_time: this.formatTimestamp(room.created_at),
          formatted_score: this.formatScore(room.final_score)
        }));
        
        const rooms = this.data.page === 1 ? processedRooms : [...this.data.rooms, ...processedRooms];
        
        this.setData({
          rooms,
          hasMore: newRooms.length === this.data.pageSize,
        });
      } else {
        wx.showToast({
          title: response.message || '加载房间列表失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      this.setData({ loading: false });
      console.error('加载房间列表失败:', error);
      wx.showToast({
        title: '加载房间列表失败',
        icon: 'none'
      });
    }
  },

  // 加载更多
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({
      page: this.data.page + 1,
    });
    this.loadRooms();
  },

  // 查看房间详情
  viewRoomDetail(e) {
    const room = e.currentTarget.dataset.room;
    
    if (room.status === 1) {
      // 进行中的房间，直接进入，优先使用room_id
      wx.navigateTo({
        url: `/pages/room/room?roomId=${room.room_id}`,
      });
    } else {
      // 已结算的房间，也跳转到room页面，但会显示已结算状态
      wx.navigateTo({
        url: `/pages/room/room?roomId=${room.room_id}`,
      });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      rooms: [],
      hasMore: true,
    });
    this.loadRooms();
    wx.stopPullDownRefresh();
  },

  // 上拉加载更多（保留作为备用）
  onReachBottom() {
    this.loadMore();
  },

  // 返回主页
  goToHome() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },

  // 格式化时间戳为可读时间
  formatTimestamp(timestamp) {
    if (!timestamp) return '未知时间';
    
    try {
      // 如果是Unix时间戳（秒），需要转换为毫秒
      const date = new Date(timestamp * 1000);
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return '时间格式错误';
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hour}:${minute}`;
    } catch (error) {
      console.error('时间格式化失败:', error);
      return '时间解析失败';
    }
  },

  // 格式化分数
  formatScore(score) {
    if (score === null || score === undefined) return '0';
    
    // 确保分数完整显示，不省略
    const num = parseInt(score);
    if (isNaN(num)) return '0';
    
    // 显示正负号和完整数字
    return num > 0 ? `+${num}` : num.toString();
  }
});
