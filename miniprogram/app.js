// app.js
const api = require('./utils/api')
const eventBus = require('./utils/eventBus')
const userCache = require('./utils/userCache')
const version = require('./utils/version')

App({
  // 注册过滤器
  formatScore(score) {
    if (score === null || score === undefined) return '0'
    return score.toString()
  },

  formatTimestamp(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  async onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 初始化用户信息
    this.initUserInfo()
    
    // 静默自动登录
    await this.silentAutoLogin()
  },

  // 初始化用户信息
  initUserInfo() {
    const userInfo = userCache.getCachedUserInfo()
    if (userInfo) {
      this.globalData.userInfo = userInfo
    }
  },

  // 自动登录方法（获取openid并查询数据库）
  async autoLogin() {
    try {
      // 获取微信登录code
      const loginRes = await this.wxLogin()
      if (!loginRes.code) {
        throw new Error('获取微信登录code失败')
      }
      
      // 调用后端自动登录接口（只传递code，让后端处理用户信息）
      const response = await api.autoLogin(loginRes.code)
      
      if (response.code === 200) {
        // 解析登录响应数据
        const loginData = JSON.parse(response.data)
        const user = loginData.user
        const sessionID = loginData.session_id
        const expiresAt = loginData.expires_at
        
        // 保存用户信息到本地存储和全局数据
        const userData = {
          ...user,
          user_id: user.id, // 添加user_id字段，使用后端返回的id
          nickName: user.nickname || '微信用户',
          avatarUrl: user.avatar_url || '/images/default-avatar.png',
          session_id: sessionID,
          expires_at: expiresAt
        }
        
        // 使用缓存管理工具保存用户信息
        userCache.setCachedUserInfo(userData)
        wx.setStorageSync('sessionID', sessionID)
        this.globalData.userInfo = userData
        
        return userData
      } else {
        throw new Error(response.message || '自动登录失败')
      }
    } catch (error) {
      console.error('自动登录失败:', error)
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

  // 静默自动登录
  async silentAutoLogin() {
    try {
      // 检查是否已经有用户信息
      const existingUserInfo = this.globalData.userInfo || userCache.getCachedUserInfo()
      if (existingUserInfo && existingUserInfo.user_id) {
        console.log('用户已登录，跳过静默自动登录')
        return
      }

      console.log('开始静默自动登录...')
      
      // 静默调用自动登录
      const userInfo = await this.autoLogin()
      console.log('静默自动登录成功:', userInfo)
      
      // 标记已显示过欢迎弹窗，避免后续弹窗
      wx.setStorageSync('hasShownWelcome', true)
      
    } catch (error) {
      console.error('静默自动登录失败:', error)
      // 静默失败，不显示任何提示，让用户正常使用
      // 但确保全局数据中有基本的用户信息结构
      if (!this.globalData.userInfo) {
        this.globalData.userInfo = null
      }
    }
  },

  // 验证登录态
  async validateSession() {
    try {
      const sessionID = wx.getStorageSync('sessionID')
      if (!sessionID) {
        return false
      }
      
      const response = await api.validateSession(sessionID)
      if (response.code === 200) {
        // 更新用户信息
        const userData = JSON.parse(response.data)
        this.globalData.userInfo = userData
        userCache.setCachedUserInfo(userData)
        return true
      } else {
        // 登录态无效，清除本地数据
        wx.removeStorageSync('sessionID')
        userCache.clearCache()
        this.globalData.userInfo = null
        return false
      }
    } catch (error) {
      console.error('验证登录态失败:', error)
      return false
    }
  },

  // 全局分享配置
  onShareAppMessage() {
    const sharePath = version.generateSharePath('/pages/index/index');
    
    return {
      title: `记分助手 (${version.getVersionDisplayName()})`,
      path: sharePath
    }
  },

  globalData: {
    userInfo: null
  }
})
