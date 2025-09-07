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
        
        const rooms = this.data.page === 1 ? newRooms : [...this.data.rooms, ...newRooms];
        
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

  // 上拉加载更多
  onReachBottom() {
    this.loadMore();
  },

  // 返回主页
  goToHome() {
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },
});
