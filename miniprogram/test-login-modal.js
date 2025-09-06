// 测试登录浮窗功能
const app = getApp();

// 模拟登录浮窗测试
function testLoginModal() {
  console.log('开始测试登录浮窗功能...');
  
  // 1. 测试显示登录浮窗
  console.log('测试显示登录浮窗...');
  const page = getCurrentPages()[0];
  if (page && page.showLoginModal) {
    page.showLoginModal();
    console.log('✅ 登录浮窗显示成功');
  } else {
    console.log('❌ 无法显示登录浮窗');
  }
}

// 测试登录浮窗的各个功能
function testLoginModalFunctions() {
  console.log('测试登录浮窗功能...');
  
  const page = getCurrentPages()[0];
  if (!page) {
    console.log('❌ 无法获取当前页面');
    return;
  }
  
  // 测试昵称输入
  console.log('测试昵称输入...');
  if (page.onNicknameInput) {
    page.onNicknameInput({ detail: { value: '测试用户' } });
    console.log('✅ 昵称输入功能正常');
  } else {
    console.log('❌ 昵称输入功能异常');
  }
  
  // 测试头像选择
  console.log('测试头像选择...');
  if (page.chooseAvatar) {
    // 模拟选择头像
    page.chooseAvatar().then(() => {
      console.log('✅ 头像选择功能正常');
    }).catch((error) => {
      console.log('❌ 头像选择功能异常:', error);
    });
  } else {
    console.log('❌ 头像选择功能异常');
  }
  
  // 测试微信授权
  console.log('测试微信授权...');
  if (page.authorizeWeChat) {
    page.authorizeWeChat().then(() => {
      console.log('✅ 微信授权功能正常');
    }).catch((error) => {
      console.log('❌ 微信授权功能异常:', error);
    });
  } else {
    console.log('❌ 微信授权功能异常');
  }
}

// 测试登录流程
function testLoginFlow() {
  console.log('测试完整登录流程...');
  
  // 1. 清除用户信息
  wx.removeStorageSync('userInfo');
  app.globalData.userInfo = null;
  console.log('✅ 清除用户信息');
  
  // 2. 模拟点击创建房间
  const page = getCurrentPages()[0];
  if (page && page.createRoom) {
    page.createRoom();
    console.log('✅ 触发创建房间，应该显示登录浮窗');
  } else {
    console.log('❌ 无法触发创建房间');
  }
}

// 测试保存用户信息
function testSaveUserInfo() {
  console.log('测试保存用户信息...');
  
  const page = getCurrentPages()[0];
  if (!page) {
    console.log('❌ 无法获取当前页面');
    return;
  }
  
  // 设置测试数据
  page.setData({
    loginForm: {
      nickname: '测试用户',
      avatarUrl: 'https://example.com/avatar.jpg'
    }
  });
  
  // 测试保存
  if (page.saveUserInfo) {
    page.saveUserInfo().then(() => {
      console.log('✅ 保存用户信息功能正常');
    }).catch((error) => {
      console.log('❌ 保存用户信息功能异常:', error);
    });
  } else {
    console.log('❌ 保存用户信息功能异常');
  }
}

// 运行所有测试
function runLoginModalTests() {
  console.log('=== 登录浮窗测试开始 ===');
  
  try {
    testLoginModal();
    testLoginModalFunctions();
    testLoginFlow();
    testSaveUserInfo();
    
    console.log('=== 登录浮窗测试完成 ===');
  } catch (error) {
    console.error('测试过程中出现错误:', error);
  }
}

// 导出测试函数
module.exports = {
  testLoginModal,
  testLoginModalFunctions,
  testLoginFlow,
  testSaveUserInfo,
  runLoginModalTests
};
