// index.js
const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: '微信用户'
    },
    recentRoom: null,
    loading: false,
    showLoginModal: false,
    loginForm: {
      nickname: '微信用户',
      avatarUrl: ''
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
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo: userInfo
      })
    }
  },

  // 加载最近房间信息
  async loadRecentRoom() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.user_id) {
      return
    }

    try {
      this.setData({ loading: true })
      const response = await api.getRecentRoom(userInfo.user_id)
      
      if (response.code === 200 && response.data) {
        this.setData({
          recentRoom: response.data
        })
      } else {
        this.setData({
          recentRoom: null
        })
      }
    } catch (error) {
      console.error('加载最近房间失败:', error)
      this.setData({
        recentRoom: null
      })
    } finally {
      this.setData({ loading: false })
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
        url: `/pages/room/room?roomId=${this.data.recentRoom.room_id}`
      })
    }
  },

  // 创建房间
  createRoom() {
    // 检查用户是否已登录
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.user_id) {
      this.showLoginModal()
      return
    }
    
    wx.navigateTo({
      url: '/pages/create-room/create-room'
    })
  },

  // 加入房间
  joinRoom() {
    // 检查用户是否已登录
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.user_id) {
      this.showLoginModal()
      return
    }
    
    wx.navigateTo({
      url: '/pages/join-room/join-room'
    })
  },

  // 查看历史房间
  goToHistory() {
    // 检查用户是否已登录
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.user_id) {
      this.showLoginModal()
      return
    }
    
    wx.navigateTo({
      url: '/pages/history/history'
    })
  },

  // 显示登录浮窗
  showLoginModal() {
    this.setData({
      showLoginModal: true,
      loginForm: {
        nickname: '微信用户',
        avatarUrl: ''
      }
    })
  },

  // 隐藏登录浮窗
  hideLoginModal() {
    this.setData({
      showLoginModal: false
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      'loginForm.nickname': e.detail.value
    })
  },

  // 选择头像
  async chooseAvatar() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      
      this.setData({
        'loginForm.avatarUrl': res.tempFilePaths[0]
      })
      
      wx.showToast({
        title: '头像选择成功',
        icon: 'success'
      })
    } catch (error) {
      console.error('选择头像失败:', error)
      wx.showToast({
        title: '选择头像失败',
        icon: 'none'
      })
    }
  },

  // 授权微信信息
  async authorizeWeChat() {
    try {
      // 首先获取用户信息
      const userInfoRes = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: resolve,
          fail: reject
        })
      })
      
      console.log('获取到的微信用户信息:', userInfoRes.userInfo)
      
      // 更新表单数据
      this.setData({
        'loginForm.nickname': userInfoRes.userInfo.nickName || '微信用户',
        'loginForm.avatarUrl': userInfoRes.userInfo.avatarUrl || ''
      })
      
      wx.showToast({
        title: '微信信息授权成功',
        icon: 'success'
      })
      
      console.log('更新后的表单数据:', this.data.loginForm)
    } catch (error) {
      console.error('授权微信信息失败:', error)
      
      // 如果授权失败，提供备选方案
      wx.showModal({
        title: '授权失败',
        content: '无法获取微信信息，请手动输入昵称',
        confirmText: '确定',
        showCancel: false
      })
    }
  },

  // 保存用户信息
  async saveUserInfo() {
    const { nickname, avatarUrl } = this.data.loginForm
    
    if (!nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })
      
      // 调用登录API，传入昵称和头像URL
      const loginRes = await app.login(nickname, avatarUrl)
      if (loginRes) {
        // 更新本地用户信息
        const updatedUserInfo = {
          ...loginRes,
          user_id: loginRes.id, // 添加user_id字段，使用后端返回的id
          nickname: nickname,
          avatarUrl: avatarUrl
        }
        
        wx.setStorageSync('userInfo', updatedUserInfo)
        app.globalData.userInfo = updatedUserInfo
        
        // 清除欢迎弹窗标记，因为用户已经登录
        wx.removeStorageSync('hasShownWelcome')
        
        this.setData({
          userInfo: updatedUserInfo,
          showLoginModal: false
        })
        
        wx.hideLoading()
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        
        // 重新加载最近房间
        this.loadRecentRoom()
      } else {
        wx.hideLoading()
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('保存用户信息失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  }
})
