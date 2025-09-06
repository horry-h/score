// app.js
const api = require('./utils/api')

App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 初始化用户信息
    this.initUserInfo()
    
    // 检查是否需要引导用户登录
    this.checkUserLogin()
  },

  // 初始化用户信息
  initUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
    }
  },

  // 用户登录（不包含微信授权）
  async login(nickname = '微信用户', avatarUrl = '') {
    try {
      // 获取微信登录code
      const loginRes = await this.wxLogin()
      if (!loginRes.code) {
        throw new Error('获取微信登录code失败')
      }
      
      // 调用后端登录接口
      const response = await api.login(loginRes.code, nickname, avatarUrl)
      
      if (response.code === 200) {
        // 保存用户信息到本地存储和全局数据
        const userData = {
          ...response.data,
          nickName: nickname,
          avatarUrl: avatarUrl
        }
        
        wx.setStorageSync('userInfo', userData)
        this.globalData.userInfo = userData
        
        return userData
      } else {
        throw new Error(response.message || '登录失败')
      }
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  },

  // 微信登录
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      })
    })
  },

  // 获取用户信息
  getUserInfo() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          console.log('app.js获取到的微信用户信息:', res.userInfo)
          resolve(res.userInfo)
        },
        fail: (error) => {
          console.error('app.js获取微信用户信息失败:', error)
          // 如果用户拒绝授权，使用默认信息
          resolve({
            nickName: '微信用户',
            avatarUrl: ''
          })
        }
      })
    })
  },

  // 检查用户登录状态
  checkUserLogin() {
    const userInfo = this.globalData.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.user_id) {
      // 用户未登录，延迟显示引导提示
      setTimeout(() => {
        wx.showModal({
          title: '欢迎使用麻将记分',
          content: '请先完善个人信息，然后就可以开始创建房间或加入房间了',
          confirmText: '知道了',
          cancelText: '稍后',
          showCancel: false
        })
      }, 1000) // 延迟1秒显示，让首页先加载完成
    }
  },

  globalData: {
    userInfo: null
  }
})
