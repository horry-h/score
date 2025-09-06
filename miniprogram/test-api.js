// 测试API连接
const api = require('./utils/api');

// 测试健康检查
async function testHealth() {
  try {
    console.log('测试健康检查...');
    const response = await api.request('/api/v1/health');
    console.log('健康检查响应:', response);
    return response;
  } catch (error) {
    console.error('健康检查失败:', error);
    return null;
  }
}

// 测试用户登录
async function testLogin() {
  try {
    console.log('测试用户登录...');
    const response = await api.login('test_code', '测试用户', 'https://example.com/avatar.jpg');
    console.log('登录响应:', response);
    return response;
  } catch (error) {
    console.error('登录测试失败:', error);
    return null;
  }
}

// 测试创建房间
async function testCreateRoom() {
  try {
    console.log('测试创建房间...');
    const response = await api.createRoom(1, '测试房间');
    console.log('创建房间响应:', response);
    return response;
  } catch (error) {
    console.error('创建房间测试失败:', error);
    return null;
  }
}

// 运行所有测试
async function runTests() {
  console.log('开始API测试...');
  
  const healthResult = await testHealth();
  if (healthResult && healthResult.code === 200) {
    console.log('✅ 健康检查通过');
  } else {
    console.log('❌ 健康检查失败');
  }
  
  const loginResult = await testLogin();
  if (loginResult && loginResult.code === 200) {
    console.log('✅ 登录测试通过');
  } else {
    console.log('❌ 登录测试失败');
  }
  
  const createRoomResult = await testCreateRoom();
  if (createRoomResult && createRoomResult.code === 200) {
    console.log('✅ 创建房间测试通过');
  } else {
    console.log('❌ 创建房间测试失败');
  }
  
  console.log('API测试完成');
}

// 导出测试函数
module.exports = {
  testHealth,
  testLogin,
  testCreateRoom,
  runTests
};
