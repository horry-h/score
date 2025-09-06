// index.js
const api = require('../../utils/api')
const eventBus = require('../../utils/eventBus')
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
    showProfileModal: false,
    showJoinRoomModal: false,
    roomCode: '',
    loginForm: {
      nickname: '微信用户',
      avatarUrl: ''
    },
    profileForm: {
      nickname: '微信用户',
      avatarUrl: ''
    }
  },

  async onLoad() {
    // 首先尝试自动登录
    await this.autoLogin()
    
    // 然后加载用户信息和最近房间
    this.loadUserInfo()
    this.loadRecentRoom()
    
    // 监听全局事件，显示个人信息浮窗
    eventBus.on('showProfileModal', () => {
      this.showProfileModal()
    })
    
    // 启用分享功能
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  onShow() {
    // 每次显示页面时刷新用户信息和最近房间信息
    this.loadUserInfo()
    this.loadRecentRoom()
  },

  // 自动登录
  async autoLogin() {
    try {
      // 检查是否已经有用户信息
      const existingUserInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      if (existingUserInfo && existingUserInfo.user_id) {
        console.log('用户已登录，跳过自动登录')
        return
      }

      console.log('开始自动登录...')
      const userInfo = await app.autoLogin()
      console.log('自动登录成功:', userInfo)
      
      // 更新页面显示
      this.setData({
        userInfo: {
          user_id: userInfo.user_id,
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        }
      })
      
    } catch (error) {
      console.error('自动登录失败:', error)
      // 自动登录失败不影响页面正常显示，用户仍可以手动登录
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      // 首先尝试从本地存储获取用户ID
      const localUserInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      
      if (localUserInfo && localUserInfo.user_id) {
        // 从数据库获取最新的用户信息
        const response = await api.getUserInfo(localUserInfo.user_id)
        
        if (response.code === 200 && response.data) {
          let userData;
          try {
            userData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          } catch (error) {
            console.error('解析用户数据失败:', error)
            userData = response.data;
          }
          
          // 使用数据库中的信息，如果没有则使用默认值
          const updatedUserInfo = {
            user_id: localUserInfo.user_id,
            nickName: userData.nickname || '微信用户',
            avatarUrl: userData.avatar_url || '/images/default-avatar.png'
          }
          
          // 更新本地存储和全局数据
          app.globalData.userInfo = updatedUserInfo
          wx.setStorageSync('userInfo', updatedUserInfo)
          
          this.setData({
            userInfo: updatedUserInfo
          })
          
          console.log('从数据库加载用户信息成功:', updatedUserInfo)
          return
        }
      }
      
      // 如果数据库中没有数据，使用本地存储的信息或默认值
      if (localUserInfo) {
        this.setData({
          userInfo: {
            user_id: localUserInfo.user_id,
            nickName: localUserInfo.nickName || '微信用户',
            avatarUrl: localUserInfo.avatarUrl || '/images/default-avatar.png'
          }
        })
      } else {
        // 完全没有用户信息，显示默认值
        this.setData({
          userInfo: {
            nickName: '微信用户',
            avatarUrl: '/images/default-avatar.png'
          }
        })
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
      
      // 出错时使用本地存储的信息或默认值
      const localUserInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      if (localUserInfo) {
        this.setData({
          userInfo: {
            user_id: localUserInfo.user_id,
            nickName: localUserInfo.nickName || '微信用户',
            avatarUrl: localUserInfo.avatarUrl || '/images/default-avatar.png'
          }
        })
      } else {
        this.setData({
          userInfo: {
            nickName: '微信用户',
            avatarUrl: '/images/default-avatar.png'
          }
        })
      }
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
      
      console.log('getRecentRoom响应:', response)
      
      if (response.code === 200 && response.data) {
        console.log('最近房间原始数据:', response.data)
        
        // 解析JSON字符串
        let recentRoomData;
        try {
          recentRoomData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          console.log('解析后的最近房间数据:', recentRoomData)
          console.log('room_id值:', recentRoomData.room_id, '类型:', typeof recentRoomData.room_id)
        } catch (error) {
          console.error('解析最近房间数据失败:', error)
          this.setData({
            recentRoom: null
          })
          return
        }
        
        // 只展示未结算的房间 (status === 1)
        if (recentRoomData && recentRoomData.status === 1) {
          this.setData({
            recentRoom: recentRoomData
          })
        } else {
          console.log('最近房间已结算，不展示')
          this.setData({
            recentRoom: null
          })
        }
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

  // 显示个人信息浮窗
  goToProfile() {
    this.setData({
      showProfileModal: true,
      profileForm: {
        nickname: this.data.userInfo.nickName || '微信用户',
        avatarUrl: this.data.userInfo.avatarUrl || ''
      }
    })
  },

  // 进入最近房间
  enterRecentRoom() {
    console.log('enterRecentRoom被调用，recentRoom:', this.data.recentRoom)
    
    if (this.data.recentRoom) {
      console.log('准备跳转，room_id:', this.data.recentRoom.room_id)
      console.log('准备跳转，room_code:', this.data.recentRoom.room_code)
      console.log('recentRoom完整数据:', JSON.stringify(this.data.recentRoom))
      
      // 优先使用room_id，如果没有则使用room_code
      const roomId = this.data.recentRoom.room_id
      const roomCode = this.data.recentRoom.room_code
      
      console.log('提取的roomId:', roomId, '类型:', typeof roomId)
      console.log('提取的roomCode:', roomCode, '类型:', typeof roomCode)
      
      if (roomId && roomId !== 'undefined' && roomId !== 'null' && roomId !== 0) {
        // 使用room_id进行跳转
        const url = `/pages/room/room?roomId=${roomId}`
        console.log('使用roomId跳转，URL:', url)
        
        wx.navigateTo({
          url: url
        })
      } else if (roomCode && roomCode !== 'undefined' && roomCode !== 'null' && roomCode !== '') {
        // 如果没有room_id，使用room_code
        const url = `/pages/room/room?roomCode=${roomCode}`
        console.log('使用roomCode跳转，URL:', url)
        
        wx.navigateTo({
          url: url
        })
      } else {
        console.error('room_id和room_code都无效:', { roomId, roomCode })
        wx.showToast({
          title: '房间信息无效',
          icon: 'none'
        })
      }
    } else {
      console.error('recentRoom为空，无法跳转')
      wx.showToast({
        title: '没有最近房间',
        icon: 'none'
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
    
    // 显示加入房间浮窗
    this.setData({
      showJoinRoomModal: true,
      roomCode: ''
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

  // 选择头像 - 使用微信官方组件
  onChooseAvatar(e) {
    console.log('头像选择事件:', e)
    const { avatarUrl } = e.detail
    if (avatarUrl) {
      this.setData({
        'loginForm.avatarUrl': avatarUrl
      })
      console.log('选择的头像:', avatarUrl)
      wx.showToast({
        title: '头像选择成功',
        icon: 'success'
      })
    } else {
      console.log('头像选择失败或取消')
      wx.showToast({
        title: '头像选择失败',
        icon: 'none'
      })
    }
  },

  // 昵称输入完成
  onNicknameBlur(e) {
    const nickname = e.detail.value
    this.setData({
      'loginForm.nickname': nickname
    })
    console.log('输入的昵称:', nickname)
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
      
      // 调用更新用户信息API
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      if (!userInfo || !userInfo.user_id) {
        wx.hideLoading()
        wx.showToast({
          title: '用户信息异常，请重新进入',
          icon: 'error'
        })
        return
      }
      
      const response = await api.updateUser(userInfo.user_id, nickname, avatarUrl)
      if (response.code === 200) {
        // 更新本地用户信息
        const updatedUserInfo = {
          ...userInfo,
          nickName: nickname,
          avatarUrl: avatarUrl
        }
        
        wx.setStorageSync('userInfo', updatedUserInfo)
        app.globalData.userInfo = updatedUserInfo
        
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
  },

  // 显示个人信息浮窗
  showProfileModal() {
    // 获取当前用户信息
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}
    
    this.setData({
      showProfileModal: true,
      profileForm: {
        nickname: userInfo.nickName || userInfo.nickname || '微信用户',
        avatarUrl: userInfo.avatarUrl || ''
      }
    })
    
    console.log('显示个人信息浮窗，当前用户信息:', userInfo)
    console.log('profileForm数据:', this.data.profileForm)
  },

  // 隐藏个人信息浮窗
  hideProfileModal() {
    this.setData({
      showProfileModal: false
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 阻止事件冒泡
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      'profileForm.nickname': e.detail.value
    })
  },

  // 选择头像 - 个人信息浮窗
  async onProfileChooseAvatar(e) {
    console.log('头像选择事件:', e)
    console.log('事件详情:', e.detail)
    
    // 先显示一个简单的提示，确认事件被触发
    wx.showToast({
      title: '头像选择事件已触发',
      icon: 'none'
    })
    
    const { avatarUrl } = e.detail
    if (avatarUrl) {
      try {
        wx.showLoading({ title: '上传头像中...' })
        
        // 引入COS上传工具
        const cosUploader = require('../../utils/cos.js')
        
        // 获取当前用户信息
        const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
        if (!userInfo || !userInfo.openid) {
          wx.hideLoading()
          wx.showToast({
            title: '用户信息无效',
            icon: 'none'
          })
          return
        }
        
        // 上传头像到COS，使用openid作为文件名
        const uploadResult = await cosUploader.uploadAvatar(avatarUrl, userInfo.openid)
        
        wx.hideLoading()
        
        if (uploadResult.success) {
          // 上传成功，使用COS的URL
          this.setData({
            'profileForm.avatarUrl': uploadResult.url
          })
          console.log('头像上传到COS成功:', uploadResult.url)
          wx.showToast({
            title: '头像上传成功',
            icon: 'success'
          })
        } else {
          // 上传失败，使用临时URL作为备选
          this.setData({
            'profileForm.avatarUrl': avatarUrl
          })
          console.log('COS上传失败，使用临时URL:', avatarUrl)
          wx.showToast({
            title: '头像选择成功（临时）',
            icon: 'success'
          })
        }
      } catch (error) {
        wx.hideLoading()
        console.error('头像上传失败:', error)
        // 上传失败时使用临时URL
        this.setData({
          'profileForm.avatarUrl': avatarUrl
        })
        wx.showToast({
          title: '头像选择成功（临时）',
          icon: 'success'
        })
      }
    } else {
      console.log('头像选择失败或取消')
      wx.showToast({
        title: '头像选择失败',
        icon: 'none'
      })
    }
  },

  // 昵称输入 - 个人信息浮窗
  onProfileNicknameInput(e) {
    this.setData({
      'profileForm.nickname': e.detail.value
    })
  },

  // 昵称输入完成 - 个人信息浮窗
  onProfileNicknameBlur(e) {
    const nickname = e.detail.value
    this.setData({
      'profileForm.nickname': nickname
    })
    console.log('输入的昵称:', nickname)
  },

  // 微信授权
  async authorizeWeChat() {
    try {
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
        'profileForm.nickname': userInfoRes.userInfo.nickName || '微信用户',
        'profileForm.avatarUrl': userInfoRes.userInfo.avatarUrl || ''
      })
      
      wx.showToast({
        title: '微信信息授权成功',
        icon: 'success'
      })
      
      console.log('更新后的表单数据:', this.data.profileForm)
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

  // 保存个人信息
  async saveProfileInfo() {
    const { nickname, avatarUrl } = this.data.profileForm
    
    if (!nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })
      
      // 调用更新用户信息API
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      if (!userInfo || !userInfo.user_id) {
        wx.hideLoading()
        wx.showToast({
          title: '用户信息异常，请重新进入',
          icon: 'error'
        })
        return
      }
      
      const response = await api.updateUser(userInfo.user_id, nickname, avatarUrl)
      if (response.code === 200) {
        // 更新本地用户信息
        const updatedUserInfo = {
          ...userInfo,
          nickName: nickname,
          avatarUrl: avatarUrl
        }
        
        wx.setStorageSync('userInfo', updatedUserInfo)
        app.globalData.userInfo = updatedUserInfo
        
        this.setData({
          userInfo: updatedUserInfo,
          showProfileModal: false
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
      console.error('保存个人信息失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 隐藏加入房间浮窗
  hideJoinRoomModal() {
    this.setData({
      showJoinRoomModal: false,
      roomCode: ''
    })
  },

  // 房间号输入
  onRoomCodeInput(e) {
    this.setData({
      roomCode: e.detail.value
    })
  },

  // 确认加入房间
  async confirmJoinRoom() {
    const { roomCode } = this.data
    
    if (!roomCode || roomCode.trim() === '') {
      wx.showToast({
        title: '请输入房间号',
        icon: 'none'
      })
      return
    }

    // 验证房间号是否为有效数字
    const roomId = parseInt(roomCode)
    if (isNaN(roomId) || roomId <= 0) {
      wx.showToast({
        title: '请输入有效的房间号',
        icon: 'none'
      })
      return
    }

    try {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      if (!userInfo || !userInfo.user_id) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        return
      }

      this.setData({ loading: true })
      wx.showLoading({ title: '加入中...' })

      const response = await api.joinRoom(userInfo.user_id, roomId)
      
      if (response.code === 200) {
        console.log("加入房间响应:", response)
        
        // 解析data字段中的JSON字符串
        let roomData;
        try {
          roomData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          console.log("解析后的房间数据:", roomData)
        } catch (error) {
          console.error("解析房间数据失败:", error)
          wx.hideLoading()
          wx.showToast({
            title: '房间数据解析失败',
            icon: 'none'
          })
          return
        }
        
        wx.hideLoading()
        wx.showToast({
          title: '加入房间成功',
          icon: 'success'
        })
        
        // 保存最近房间信息
        wx.setStorageSync('recentRoom', roomData);
        console.log("保存的房间数据:", roomData)
        
        // 隐藏浮窗
        this.setData({
          showJoinRoomModal: false,
          roomCode: ''
        })
        
        // 跳转到房间页面，优先使用room_id
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?roomId=${roomData.room_id}`,
          });
        }, 1500);
      } else {
        wx.hideLoading()
        
        // 处理不同的错误情况
        if (response.message === '房间已结算') {
          wx.showModal({
            title: '房间已结束',
            content: '该房间已经结算，无法加入',
            showCancel: false,
            confirmText: '知道了'
          })
        } else if (response.message === '已在房间中') {
          // 用户已经在房间中，直接进入房间
          wx.showToast({
            title: '您已在此房间中',
            icon: 'success'
          })
          
          // 解析返回的房间数据并跳转
          let roomData;
          try {
            console.log("已在房间中，原始响应:", response);
            roomData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            console.log("已在房间中，解析后的房间数据:", roomData);
            
            // 检查房间ID是否有效
            if (!roomData.room_id || roomData.room_id === 0) {
              console.error("房间ID无效:", roomData.room_id);
              wx.showToast({
                title: '房间信息异常',
                icon: 'none'
              });
              return;
            }
            
            // 保存最近房间信息
            wx.setStorageSync('recentRoom', roomData);
            
            // 隐藏浮窗
            this.setData({
              showJoinRoomModal: false,
              roomCode: ''
            })
            
            // 直接跳转到房间页面
            setTimeout(() => {
              const roomId = roomData.room_id;
              console.log("准备跳转到房间页面，roomId:", roomId);
              wx.redirectTo({
                url: `/pages/room/room?roomId=${roomId}`,
              });
            }, 1500);
          } catch (error) {
            console.error("解析房间数据失败:", error);
            wx.showToast({
              title: '房间信息解析失败',
              icon: 'none'
            });
          }
        } else {
          wx.showToast({
            title: response.message || '加入房间失败',
            icon: 'none'
          })
        }
      }
    } catch (error) {
      wx.hideLoading()
      console.error('加入房间失败:', error)
      wx.showToast({
        title: '加入房间失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 分享给好友
  onShareAppMessage() {
    return {
      title: '麻将记分',
      path: '/pages/index/index'
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '麻将记分',
      path: '/pages/index/index'
    }
  }
})
