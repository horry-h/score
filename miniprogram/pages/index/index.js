// index.js
const api = require('../../utils/api')

Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: '微信用户1234'
    },
    recentRoom: {
      roomId: '888888',
      time: '2024-01-15 14:30',
      score: 150,
      playerCount: 4,
      transferCount: 8
    }
  },

  onLoad() {
    this.loadUserInfo()
    this.loadRecentRoom()
  },

  onShow() {
    // 每次显示页面时刷新最近房间信息
    this.loadRecentRoom()
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo: userInfo
      })
    }
  },

  // 加载最近房间信息
  loadRecentRoom() {
    // 从本地存储获取最近房间信息
    const recentRoom = wx.getStorageSync('recentRoom')
    if (recentRoom) {
      this.setData({
        recentRoom: recentRoom
      })
    }
  },

  // 跳转到个人信息页面
  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    })
  },

  // 进入最近房间
  enterRecentRoom() {
    if (this.data.recentRoom) {
      wx.navigateTo({
        url: `/pages/room/room?roomId=${this.data.recentRoom.roomId}`
      })
    }
  },

  // 创建房间
  createRoom() {
    wx.navigateTo({
      url: '/pages/create-room/create-room'
    })
  },

  // 加入房间
  joinRoom() {
    wx.navigateTo({
      url: '/pages/join-room/join-room'
    })
  },

  // 查看历史房间
  goToHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    })
  }
})
