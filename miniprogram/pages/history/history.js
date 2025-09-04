// history.js
const apiService = require('../../utils/api');
const { showLoading, hideLoading, showError, formatTimestamp, formatScore } = require('../../utils/util');

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
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        showError('请先登录');
        return;
      }

      this.setData({ loading: true });
      showLoading('加载中...');

      const response = await apiService.getUserRooms(
        userInfo.id,
        this.data.page,
        this.data.pageSize
      );

      hideLoading();
      this.setData({ loading: false });

      if (response.code === 200) {
        const newRooms = JSON.parse(response.data);
        const rooms = this.data.page === 1 ? newRooms : [...this.data.rooms, ...newRooms];
        
        this.setData({
          rooms,
          hasMore: newRooms.length === this.data.pageSize,
        });
      } else {
        showError(response.message || '加载房间列表失败');
      }
    } catch (error) {
      hideLoading();
      this.setData({ loading: false });
      console.error('加载房间列表失败:', error);
      showError('加载房间列表失败');
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
      // 进行中的房间，直接进入
      wx.navigateTo({
        url: `/pages/room/room?roomId=${room.room_id}`,
      });
    } else {
      // 已结算的房间，查看详情
      wx.navigateTo({
        url: `/pages/room-detail/room-detail?roomId=${room.room_id}`,
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
});
