// profile.js
const apiService = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError, getUserInfo, chooseImage, generateDefaultNickname } = require('../../utils/util');

Page({
  data: {
    userInfo: {
      id: null,
      nickname: '',
      avatar_url: '',
    },
    isNewUser: false,
  },

  onLoad() {
    this.initUserInfo();
  },

  // 初始化用户信息
  initUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    } else {
      // 新用户，设置默认昵称
      const defaultNickname = generateDefaultNickname('mock_openid');
      this.setData({
        userInfo: {
          nickname: defaultNickname,
          avatar_url: '',
        },
        isNewUser: true,
      });
    }
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      'userInfo.nickname': e.detail.value,
    });
  },

  // 更换头像
  async changeAvatar() {
    try {
      const tempFilePath = await chooseImage();
      
      // 这里应该上传图片到服务器，简化处理直接设置
      this.setData({
        'userInfo.avatar_url': tempFilePath,
      });
      
      showSuccess('头像更新成功');
    } catch (error) {
      console.error('选择头像失败:', error);
      showError('选择头像失败');
    }
  },

  // 授权微信信息
  async authorizeWeChat() {
    try {
      const userInfo = await getUserInfo();
      
      this.setData({
        'userInfo.nickname': userInfo.nickName,
        'userInfo.avatar_url': userInfo.avatarUrl,
      });
      
      showSuccess('微信信息授权成功');
    } catch (error) {
      console.error('授权微信信息失败:', error);
      showError('授权微信信息失败');
    }
  },

  // 保存用户信息
  async saveUserInfo() {
    const { userInfo, isNewUser } = this.data;
    
    if (!userInfo.nickname.trim()) {
      showError('请输入昵称');
      return;
    }

    try {
      showLoading('保存中...');
      
      let response;
      if (isNewUser) {
        // 新用户登录
        response = await apiService.login('mock_code', userInfo.nickname, userInfo.avatar_url);
      } else {
        // 更新用户信息
        response = await apiService.updateUser(userInfo.id, userInfo.nickname, userInfo.avatar_url);
      }
      
      hideLoading();
      
      if (response.code === 200) {
        if (isNewUser) {
          // 保存用户信息到本地
          const newUserInfo = JSON.parse(response.data);
          wx.setStorageSync('userInfo', newUserInfo);
          this.setData({
            userInfo: newUserInfo,
            isNewUser: false,
          });
        }
        
        showSuccess('保存成功');
        
        // 延迟返回主页
        setTimeout(() => {
          this.backToHome();
        }, 1500);
      } else {
        showError(response.message || '保存失败');
      }
    } catch (error) {
      hideLoading();
      console.error('保存用户信息失败:', error);
      showError('保存失败');
    }
  },

  // 返回主页
  backToHome() {
    wx.switchTab({
      url: '/pages/index/index',
    });
  },
});
