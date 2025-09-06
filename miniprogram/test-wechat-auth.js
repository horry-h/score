// 测试微信授权功能
const app = getApp();

// 测试微信授权API
function testWeChatAuth() {
  console.log('开始测试微信授权功能...');
  
  // 测试wx.getUserProfile
  wx.getUserProfile({
    desc: '用于测试微信授权功能',
    success: (res) => {
      console.log('✅ 微信授权成功');
      console.log('用户信息:', res.userInfo);
      console.log('昵称:', res.userInfo.nickName);
      console.log('头像:', res.userInfo.avatarUrl);
      
      // 测试更新表单数据
      const page = getCurrentPages()[0];
      if (page && page.setData) {
        page.setData({
          'loginForm.nickname': res.userInfo.nickName,
          'loginForm.avatarUrl': res.userInfo.avatarUrl
        });
        console.log('✅ 表单数据更新成功');
      }
    },
    fail: (error) => {
      console.log('❌ 微信授权失败:', error);
      console.log('错误信息:', error.errMsg);
    }
  });
}

// 测试授权按钮点击
function testAuthButtonClick() {
  console.log('测试授权按钮点击...');
  
  const page = getCurrentPages()[0];
  if (page && page.authorizeWeChat) {
    page.authorizeWeChat().then(() => {
      console.log('✅ 授权按钮点击成功');
    }).catch((error) => {
      console.log('❌ 授权按钮点击失败:', error);
    });
  } else {
    console.log('❌ 无法找到授权方法');
  }
}

// 测试表单数据更新
function testFormDataUpdate() {
  console.log('测试表单数据更新...');
  
  const page = getCurrentPages()[0];
  if (page) {
    // 模拟更新表单数据
    page.setData({
      loginForm: {
        nickname: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg'
      }
    });
    
    console.log('✅ 表单数据更新成功');
    console.log('当前表单数据:', page.data.loginForm);
  } else {
    console.log('❌ 无法获取当前页面');
  }
}

// 测试微信登录流程
function testWeChatLoginFlow() {
  console.log('测试微信登录流程...');
  
  // 1. 获取微信登录code
  wx.login({
    success: (res) => {
      console.log('✅ 获取微信登录code成功:', res.code);
      
      // 2. 获取用户信息
      wx.getUserProfile({
        desc: '用于测试登录流程',
        success: (userInfoRes) => {
          console.log('✅ 获取用户信息成功:', userInfoRes.userInfo);
          
          // 3. 调用后台登录API
          const api = require('./utils/api');
          api.login(res.code, userInfoRes.userInfo.nickName, userInfoRes.userInfo.avatarUrl)
            .then((response) => {
              console.log('✅ 后台登录成功:', response);
            })
            .catch((error) => {
              console.log('❌ 后台登录失败:', error);
            });
        },
        fail: (error) => {
          console.log('❌ 获取用户信息失败:', error);
        }
      });
    },
    fail: (error) => {
      console.log('❌ 获取微信登录code失败:', error);
    }
  });
}

// 检查微信授权状态
function checkWeChatAuthStatus() {
  console.log('检查微信授权状态...');
  
  wx.getSetting({
    success: (res) => {
      console.log('微信授权设置:', res.authSetting);
      
      if (res.authSetting['scope.userInfo']) {
        console.log('✅ 用户已授权获取用户信息');
      } else {
        console.log('❌ 用户未授权获取用户信息');
      }
    },
    fail: (error) => {
      console.log('❌ 获取授权设置失败:', error);
    }
  });
}

// 运行所有测试
function runWeChatAuthTests() {
  console.log('=== 微信授权功能测试开始 ===');
  
  try {
    checkWeChatAuthStatus();
    testWeChatAuth();
    testFormDataUpdate();
    testAuthButtonClick();
    testWeChatLoginFlow();
    
    console.log('=== 微信授权功能测试完成 ===');
  } catch (error) {
    console.error('测试过程中出现错误:', error);
  }
}

// 导出测试函数
module.exports = {
  testWeChatAuth,
  testAuthButtonClick,
  testFormDataUpdate,
  testWeChatLoginFlow,
  checkWeChatAuthStatus,
  runWeChatAuthTests
};
