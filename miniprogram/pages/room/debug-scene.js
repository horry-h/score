// 调试二维码扫描参数的脚本
// 可以在房间页面的onLoad方法中调用这个函数来调试

function debugSceneParams(options) {
  console.log('=== 二维码扫描调试信息 ===');
  console.log('原始options:', options);
  console.log('options.scene:', options.scene);
  console.log('options.roomId:', options.roomId);
  console.log('options.roomCode:', options.roomCode);
  
  if (options.scene) {
    console.log('开始解析scene参数...');
    const sceneParams = parseSceneParams(options.scene);
    console.log('解析后的scene参数:', sceneParams);
    
    if (sceneParams.roomId) {
      console.log('从scene获取到roomId:', sceneParams.roomId);
      console.log('roomId类型:', typeof sceneParams.roomId);
    } else {
      console.log('scene参数中没有找到roomId');
    }
  } else {
    console.log('没有scene参数');
  }
  
  console.log('=== 调试信息结束 ===');
}

function parseSceneParams(scene) {
  const params = {};
  if (scene) {
    console.log('开始解析scene字符串:', scene);
    const pairs = scene.split('&');
    console.log('分割后的键值对:', pairs);
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      console.log('处理键值对:', key, '=', value);
      if (key && value) {
        params[key] = decodeURIComponent(value);
        console.log('设置参数:', key, '=', params[key]);
      }
    }
  }
  return params;
}

module.exports = {
  debugSceneParams,
  parseSceneParams
};
