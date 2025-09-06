// profile.js
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    userInfo: {
      user_id: null,
      nickname: '',
      avatar_url: '',
    },
    isNewUser: false,
    loading: false
  },

  onLoad() {
    this.initUserInfo();
  },

  // 初始化用户信息
  initUserInfo() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    } else {
      // 新用户，设置默认昵称
      this.setData({
        userInfo: {
          nickname: '微信用户',
          avatar_url: '',
        },
        isNewUser: true,
      });
      
      // 新用户进入时自动提示授权微信信息
      wx.showModal({
        title: '完善个人信息',
        content: '为了更好的使用体验，建议您授权微信信息或自定义昵称',
        confirmText: '授权微信',
        cancelText: '稍后设置',
        success: (res) => {
          if (res.confirm) {
            this.authorizeWeChat();
          }
        }
      });
    }
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      'userInfo.nickname': e.detail.value,
    });
  },

  // 选择头像 - 使用微信官方组件
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      'userInfo.avatar_url': avatarUrl
    })
    console.log('选择的头像:', avatarUrl)
    wx.showToast({
      title: '头像更新成功',
      icon: 'success'
    })
  },

  // 昵称输入完成
  onNicknameBlur(e) {
    const nickname = e.detail.value
    this.setData({
      'userInfo.nickname': nickname
    })
    console.log('输入的昵称:', nickname)
  },

  // 授权微信信息
  async authorizeWeChat() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: resolve,
          fail: reject
        });
      });
      
      this.setData({
        'userInfo.nickname': res.userInfo.nickName,
        'userInfo.avatar_url': res.userInfo.avatarUrl,
      });
      
      wx.showToast({
        title: '微信信息授权成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('授权微信信息失败:', error);
      wx.showToast({
        title: '授权微信信息失败',
        icon: 'none'
      });
    }
  },

  // 保存用户信息
  async saveUserInfo() {
    const { userInfo, isNewUser } = this.data;
    
    if (!userInfo.nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    try {
      this.setData({ loading: true });
      wx.showLoading({ title: '保存中...' });
      
      let response;
      if (isNewUser) {
        // 新用户登录，传入昵称和头像URL
        const loginRes = await app.login(userInfo.nickname, userInfo.avatar_url);
        if (loginRes) {
          response = { code: 200, data: loginRes };
        } else {
          throw new Error('登录失败');
        }
      } else {
        // 更新用户信息
        response = await api.updateUser(userInfo.user_id, userInfo.nickname, userInfo.avatar_url);
      }
      
      wx.hideLoading();
      
      if (response.code === 200) {
        if (isNewUser) {
          // 保存用户信息到本地
          const newUserInfo = {
            ...response.data,
            user_id: response.data.id // 添加user_id字段，使用后端返回的id
          };
          wx.setStorageSync('userInfo', newUserInfo);
          app.globalData.userInfo = newUserInfo;
          
          // 清除欢迎弹窗标记，因为用户已经登录
          wx.removeStorageSync('hasShownWelcome');
          
          this.setData({
            userInfo: newUserInfo,
            isNewUser: false,
          });
        }
        
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 延迟返回主页
        setTimeout(() => {
          this.backToHome();
        }, 1500);
      } else {
        wx.showToast({
          title: response.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('保存用户信息失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 返回主页
  backToHome() {
    wx.switchTab({
      url: '/pages/index/index',
    });
  },
});
