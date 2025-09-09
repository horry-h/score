// userCache.js - 用户信息缓存管理工具
const api = require('./api')

class UserCache {
  constructor() {
    this.cacheKey = 'userInfo'
    this.cacheTimestampKey = 'userInfo_timestamp'
    this.cacheExpireTime = 24 * 60 * 60 * 1000 // 24小时过期
  }

  // 获取缓存的用户信息
  getCachedUserInfo() {
    try {
      const userInfo = wx.getStorageSync(this.cacheKey)
      const timestamp = wx.getStorageSync(this.cacheTimestampKey)
      
      if (!userInfo || !timestamp) {
        return null
      }
      
      // 检查是否过期
      const now = Date.now()
      if (now - timestamp > this.cacheExpireTime) {
        console.log('用户信息缓存已过期，清除缓存')
        this.clearCache()
        return null
      }
      
      console.log('使用缓存的用户信息:', userInfo)
      return userInfo
    } catch (error) {
      console.error('获取缓存用户信息失败:', error)
      return null
    }
  }

  // 保存用户信息到缓存
  setCachedUserInfo(userInfo) {
    try {
      wx.setStorageSync(this.cacheKey, userInfo)
      wx.setStorageSync(this.cacheTimestampKey, Date.now())
      console.log('用户信息已缓存:', userInfo)
    } catch (error) {
      console.error('保存用户信息到缓存失败:', error)
    }
  }

  // 清除缓存
  clearCache() {
    try {
      wx.removeStorageSync(this.cacheKey)
      wx.removeStorageSync(this.cacheTimestampKey)
      console.log('用户信息缓存已清除')
    } catch (error) {
      console.error('清除用户信息缓存失败:', error)
    }
  }

  // 获取用户信息（优先从缓存，缓存失效时从服务器获取）
  async getUserInfo(userId) {
    try {
      // 首先尝试从缓存获取
      const cachedUserInfo = this.getCachedUserInfo()
      if (cachedUserInfo && cachedUserInfo.user_id === userId) {
        return cachedUserInfo
      }

      // 缓存失效或不存在，从服务器获取
      console.log('从服务器获取用户信息，userId:', userId)
      const response = await api.getUserInfo(userId)
      
      if (response.code === 200 && response.data) {
        let userData
        try {
          userData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
        } catch (parseError) {
          console.error('解析用户信息失败:', parseError)
          return null
        }

        // 标准化用户信息格式
        const standardizedUserInfo = {
          user_id: userData.id || userData.user_id,
          nickName: userData.nickname || userData.nickName || '微信用户',
          avatarUrl: userData.avatar_url || userData.avatarUrl || '/images/default-avatar.png',
          openid: userData.openid || userData.Openid,
          nickname: userData.nickname || userData.nickName,
          avatar_url: userData.avatar_url || userData.avatarUrl,
          created_at: userData.created_at,
          updated_at: userData.updated_at
        }

        // 保存到缓存
        this.setCachedUserInfo(standardizedUserInfo)
        
        return standardizedUserInfo
      } else {
        console.error('从服务器获取用户信息失败:', response)
        return null
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return null
    }
  }

  // 更新用户信息（同时更新缓存）
  async updateUserInfo(userId, nickname, avatarUrl) {
    try {
      const response = await api.updateUser(userId, nickname, avatarUrl)
      
      if (response.code === 200) {
        // 获取更新后的用户信息
        const updatedUserInfo = await this.getUserInfo(userId)
        if (updatedUserInfo) {
          // 更新缓存
          this.setCachedUserInfo(updatedUserInfo)
          return updatedUserInfo
        }
      }
      
      return null
    } catch (error) {
      console.error('更新用户信息失败:', error)
      return null
    }
  }

  // 检查缓存是否有效
  isCacheValid() {
    try {
      const timestamp = wx.getStorageSync(this.cacheTimestampKey)
      if (!timestamp) {
        return false
      }
      
      const now = Date.now()
      return (now - timestamp) <= this.cacheExpireTime
    } catch (error) {
      console.error('检查缓存有效性失败:', error)
      return false
    }
  }

  // 强制刷新缓存（从服务器重新获取）
  async refreshCache(userId) {
    try {
      console.log('强制刷新用户信息缓存，userId:', userId)
      this.clearCache()
      return await this.getUserInfo(userId)
    } catch (error) {
      console.error('刷新用户信息缓存失败:', error)
      return null
    }
  }
}

// 创建单例实例
const userCache = new UserCache()

module.exports = userCache
