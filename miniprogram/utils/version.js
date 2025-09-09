// version.js - 小程序版本相关工具函数

/**
 * 获取当前小程序版本信息
 * @returns {Object} 版本信息对象
 */
function getCurrentVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return {
      envVersion: accountInfo.miniProgram.envVersion, // develop, trial, release
      version: accountInfo.miniProgram.version, // 版本号
      appId: accountInfo.miniProgram.appId
    };
  } catch (error) {
    console.error('获取小程序版本信息失败:', error);
    return {
      envVersion: 'release', // 默认返回正式版
      version: '1.0.0',
      appId: ''
    };
  }
}

/**
 * 根据版本生成分享路径
 * @param {string} basePath - 基础路径，如 '/pages/index/index'
 * @param {Object} params - 路径参数对象
 * @returns {string} 完整的分享路径
 */
function generateSharePath(basePath, params = {}) {
  const version = getCurrentVersion();
  
  // 构建查询参数
  const queryParams = {
    ...params,
    version: version.envVersion // 添加版本参数
  };
  
  // 将参数转换为查询字符串
  const queryString = Object.keys(queryParams)
    .filter(key => queryParams[key] !== undefined && queryParams[key] !== null)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');
  
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * 获取版本显示名称
 * @returns {string} 版本显示名称
 */
function getVersionDisplayName() {
  const version = getCurrentVersion();
  const versionMap = {
    'develop': '开发版',
    'trial': '体验版', 
    'release': '正式版'
  };
  return versionMap[version.envVersion] || '正式版';
}

/**
 * 检查是否为开发版本
 * @returns {boolean} 是否为开发版本
 */
function isDevelopVersion() {
  const version = getCurrentVersion();
  return version.envVersion === 'develop';
}

/**
 * 检查是否为体验版本
 * @returns {boolean} 是否为体验版本
 */
function isTrialVersion() {
  const version = getCurrentVersion();
  return version.envVersion === 'trial';
}

/**
 * 检查是否为正式版本
 * @returns {boolean} 是否为正式版本
 */
function isReleaseVersion() {
  const version = getCurrentVersion();
  return version.envVersion === 'release';
}

module.exports = {
  getCurrentVersion,
  generateSharePath,
  getVersionDisplayName,
  isDevelopVersion,
  isTrialVersion,
  isReleaseVersion
};
