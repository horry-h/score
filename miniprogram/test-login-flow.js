// 测试登录流程
const app = getApp();

// 模拟用户登录流程测试
function testLoginFlow() {
  console.log('开始测试登录流程...');
  
  // 1. 检查用户是否已登录
  const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
  if (userInfo && userInfo.user_id) {
    console.log('✅ 用户已登录:', userInfo);
    return true;
  }
  
  console.log('❌ 用户未登录，需要引导登录');
  return false;
}

// 模拟创建房间前的登录检查
function testCreateRoomLoginCheck() {
  console.log('测试创建房间登录检查...');
  
  const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
  if (!userInfo || !userInfo.user_id) {
    console.log('显示登录引导弹窗...');
    wx.showModal({
      title: '需要登录',
      content: '请先完善个人信息后再创建房间',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          console.log('用户选择去登录，跳转到个人信息页面');
          wx.navigateTo({
            url: '/pages/profile/profile'
          });
        } else {
          console.log('用户取消登录');
        }
      }
    });
    return false;
  }
  
  console.log('✅ 用户已登录，可以创建房间');
  return true;
}

// 模拟个人信息页面登录流程
function testProfileLoginFlow() {
  console.log('测试个人信息页面登录流程...');
  
  // 检查是否是新用户
  const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
  if (!userInfo || !userInfo.user_id) {
    console.log('新用户，显示授权提示...');
    wx.showModal({
      title: '完善个人信息',
      content: '为了更好的使用体验，建议您授权微信信息或自定义昵称',
      confirmText: '授权微信',
      cancelText: '稍后设置',
      success: (res) => {
        if (res.confirm) {
          console.log('用户选择授权微信信息');
          // 这里会调用授权微信信息的逻辑
        } else {
          console.log('用户选择稍后设置');
        }
      }
    });
    return false;
  }
  
  console.log('✅ 用户已登录，显示个人信息编辑界面');
  return true;
}

// 运行所有测试
function runLoginFlowTests() {
  console.log('=== 登录流程测试开始 ===');
  
  const test1 = testLoginFlow();
  const test2 = testCreateRoomLoginCheck();
  const test3 = testProfileLoginFlow();
  
  console.log('=== 登录流程测试结果 ===');
  console.log('用户登录状态检查:', test1 ? '✅ 通过' : '❌ 失败');
  console.log('创建房间登录检查:', test2 ? '✅ 通过' : '❌ 需要登录');
  console.log('个人信息页面流程:', test3 ? '✅ 通过' : '❌ 需要设置');
  
  return {
    userLoggedIn: test1,
    canCreateRoom: test2,
    profileReady: test3
  };
}

// 导出测试函数
module.exports = {
  testLoginFlow,
  testCreateRoomLoginCheck,
  testProfileLoginFlow,
  runLoginFlowTests
};
