// 微信授权调试脚本
const app = getApp();

// 调试微信授权问题
function debugWeChatAuth() {
  console.log('=== 微信授权调试开始 ===');
  
  // 1. 检查微信版本
  console.log('微信版本信息:', wx.getSystemInfoSync());
  
  // 2. 检查授权设置
  wx.getSetting({
    success: (res) => {
      console.log('当前授权设置:', res.authSetting);
      
      // 检查用户信息授权状态
      if (res.authSetting['scope.userInfo'] === true) {
        console.log('✅ 用户已授权获取用户信息');
      } else if (res.authSetting['scope.userInfo'] === false) {
        console.log('❌ 用户拒绝授权获取用户信息');
      } else {
        console.log('⚠️ 用户信息授权状态未知');
      }
    },
    fail: (error) => {
      console.log('❌ 获取授权设置失败:', error);
    }
  });
  
  // 3. 测试wx.getUserProfile
  console.log('测试wx.getUserProfile...');
  wx.getUserProfile({
    desc: '用于调试微信授权功能',
    success: (res) => {
      console.log('✅ wx.getUserProfile成功');
      console.log('返回数据:', res);
      console.log('用户信息:', res.userInfo);
      console.log('昵称:', res.userInfo.nickName);
      console.log('头像URL:', res.userInfo.avatarUrl);
      console.log('性别:', res.userInfo.gender);
      console.log('国家:', res.userInfo.country);
      console.log('省份:', res.userInfo.province);
      console.log('城市:', res.userInfo.city);
      console.log('语言:', res.userInfo.language);
    },
    fail: (error) => {
      console.log('❌ wx.getUserProfile失败');
      console.log('错误信息:', error);
      console.log('错误码:', error.errCode);
      console.log('错误消息:', error.errMsg);
    }
  });
  
  // 4. 测试wx.getUserInfo (已废弃，但可以对比)
  console.log('测试wx.getUserInfo (已废弃)...');
  wx.getUserInfo({
    success: (res) => {
      console.log('✅ wx.getUserInfo成功 (已废弃):', res.userInfo);
    },
    fail: (error) => {
      console.log('❌ wx.getUserInfo失败 (已废弃):', error);
    }
  });
}

// 测试授权按钮点击
function testAuthButton() {
  console.log('=== 测试授权按钮点击 ===');
  
  const page = getCurrentPages()[0];
  if (!page) {
    console.log('❌ 无法获取当前页面');
    return;
  }
  
  console.log('当前页面数据:', page.data);
  console.log('登录表单数据:', page.data.loginForm);
  
  // 模拟点击授权按钮
  if (page.authorizeWeChat) {
    console.log('调用authorizeWeChat方法...');
    page.authorizeWeChat().then(() => {
      console.log('✅ authorizeWeChat执行成功');
      console.log('更新后的表单数据:', page.data.loginForm);
    }).catch((error) => {
      console.log('❌ authorizeWeChat执行失败:', error);
    });
  } else {
    console.log('❌ 找不到authorizeWeChat方法');
  }
}

// 测试表单数据更新
function testFormUpdate() {
  console.log('=== 测试表单数据更新 ===');
  
  const page = getCurrentPages()[0];
  if (!page) {
    console.log('❌ 无法获取当前页面');
    return;
  }
  
  // 模拟更新表单数据
  const testData = {
    nickname: '测试用户' + Date.now(),
    avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/test.jpg'
  };
  
  console.log('准备更新表单数据:', testData);
  
  page.setData({
    'loginForm.nickname': testData.nickname,
    'loginForm.avatarUrl': testData.avatarUrl
  });
  
  console.log('✅ 表单数据更新完成');
  console.log('当前表单数据:', page.data.loginForm);
}

// 检查页面状态
function checkPageState() {
  console.log('=== 检查页面状态 ===');
  
  const page = getCurrentPages()[0];
  if (!page) {
    console.log('❌ 无法获取当前页面');
    return;
  }
  
  console.log('页面路径:', page.route);
  console.log('页面数据:', page.data);
  console.log('登录浮窗状态:', page.data.showLoginModal);
  console.log('登录表单数据:', page.data.loginForm);
  console.log('用户信息:', page.data.userInfo);
  
  // 检查方法是否存在
  const methods = ['showLoginModal', 'hideLoginModal', 'authorizeWeChat', 'saveUserInfo'];
  methods.forEach(method => {
    if (page[method]) {
      console.log(`✅ 方法 ${method} 存在`);
    } else {
      console.log(`❌ 方法 ${method} 不存在`);
    }
  });
}

// 运行完整调试
function runFullDebug() {
  console.log('=== 开始完整调试 ===');
  
  checkPageState();
  debugWeChatAuth();
  testFormUpdate();
  testAuthButton();
  
  console.log('=== 调试完成 ===');
}

// 导出调试函数
module.exports = {
  debugWeChatAuth,
  testAuthButton,
  testFormUpdate,
  checkPageState,
  runFullDebug
};
