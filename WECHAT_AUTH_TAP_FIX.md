# 微信授权API调用限制修复说明

## 问题描述

小程序在调用`wx.getUserProfile`时出现错误：
```
getUserProfile:fail can only be invoked by user TAP gesture.
```

## 问题分析

### 错误原因

微信小程序的`wx.getUserProfile` API有严格的调用限制：
- **只能在用户主动点击（TAP手势）时调用**
- **不能在程序自动调用或异步回调中调用**
- **必须在用户交互事件中直接调用**

### 问题场景

1. **app.js中的自动调用**: 在`login()`方法中自动调用`getUserProfile`
2. **异步回调中的调用**: 在Promise链中调用`getUserProfile`
3. **非用户交互触发**: 程序启动时自动调用

## 解决方案

### 修复策略

1. **分离微信授权逻辑**: 将微信授权从登录流程中分离出来
2. **只在用户点击时调用**: 确保`getUserProfile`只在用户主动点击时调用
3. **使用默认值**: 在非授权情况下使用默认的昵称和头像

### 修复内容

#### 1. 修改app.js中的login方法

**修改前**:
```javascript
async login() {
  // 获取微信登录code
  const loginRes = await this.wxLogin()
  
  // 自动获取用户信息（这里会出错）
  const userInfo = await this.getUserInfo()
  
  // 调用后端登录接口
  const response = await api.login(loginRes.code, userInfo.nickName, userInfo.avatarUrl)
  // ...
}
```

**修改后**:
```javascript
async login(nickname = '微信用户', avatarUrl = '') {
  // 获取微信登录code
  const loginRes = await this.wxLogin()
  
  // 直接使用传入的昵称和头像URL
  const response = await api.login(loginRes.code, nickname, avatarUrl)
  // ...
}
```

#### 2. 修改index.js中的saveUserInfo方法

**修改前**:
```javascript
async saveUserInfo() {
  // 调用登录API（会自动调用getUserProfile）
  const loginRes = await app.login()
  // ...
}
```

**修改后**:
```javascript
async saveUserInfo() {
  const { nickname, avatarUrl } = this.data.loginForm
  
  // 调用登录API，传入昵称和头像URL
  const loginRes = await app.login(nickname, avatarUrl)
  // ...
}
```

#### 3. 修改profile.js中的saveUserInfo方法

**修改前**:
```javascript
if (isNewUser) {
  // 新用户登录（会自动调用getUserProfile）
  const loginRes = await app.login()
  // ...
}
```

**修改后**:
```javascript
if (isNewUser) {
  // 新用户登录，传入昵称和头像URL
  const loginRes = await app.login(userInfo.nickname, userInfo.avatar_url)
  // ...
}
```

## 微信授权流程

### 新的授权流程

1. **用户点击"微信授权"按钮**
2. **调用`wx.getUserProfile`**（在用户点击事件中）
3. **获取用户信息后更新表单**
4. **用户点击"保存"按钮**
5. **调用`app.login(nickname, avatarUrl)`**
6. **完成登录流程**

### 授权按钮事件

```javascript
// 微信授权按钮点击事件
async authorizeWeChat() {
  try {
    const userInfoRes = await new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: resolve,
        fail: reject
      })
    })
    
    // 更新表单数据
    this.setData({
      'loginForm.nickname': userInfoRes.userInfo.nickName || '微信用户',
      'loginForm.avatarUrl': userInfoRes.userInfo.avatarUrl || ''
    })
    
    wx.showToast({
      title: '微信信息授权成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('授权微信信息失败:', error)
    wx.showModal({
      title: '授权失败',
      content: '无法获取微信信息，请手动输入昵称',
      confirmText: '确定',
      showCancel: false
    })
  }
}
```

## 用户体验优化

### 1. 默认值处理

- **昵称默认值**: "微信用户"
- **头像默认值**: 空字符串
- **用户可以选择**: 手动输入昵称或点击微信授权

### 2. 错误处理

- **授权失败**: 显示提示，引导用户手动输入
- **网络错误**: 显示错误信息，提供重试选项
- **用户拒绝**: 使用默认值，不影响登录流程

### 3. 交互优化

- **清晰的按钮**: "微信授权"按钮明确标识功能
- **即时反馈**: 授权成功后立即更新表单
- **备选方案**: 授权失败时提供手动输入选项

## 测试验证

### 测试场景

1. **正常授权流程**:
   - 点击"微信授权"按钮
   - 确认授权
   - 查看表单是否更新
   - 点击"保存"按钮
   - 验证登录是否成功

2. **授权失败场景**:
   - 点击"微信授权"按钮
   - 拒绝授权
   - 验证是否显示错误提示
   - 手动输入昵称
   - 验证登录是否成功

3. **手动输入场景**:
   - 直接输入昵称
   - 点击"保存"按钮
   - 验证登录是否成功

### 预期结果

- ✅ 微信授权只在用户点击时触发
- ✅ 授权成功后表单数据正确更新
- ✅ 授权失败时提供备选方案
- ✅ 登录流程正常完成
- ✅ 不再出现"can only be invoked by user TAP gesture"错误

## 相关文件

- ✅ `miniprogram/app.js` - 修改login方法
- ✅ `miniprogram/pages/index/index.js` - 修改saveUserInfo方法
- ✅ `miniprogram/pages/profile/profile.js` - 修改saveUserInfo方法
- ✅ `WECHAT_AUTH_TAP_FIX.md` - 修复说明文档

## 总结

通过将微信授权从自动调用改为用户主动触发，解决了`wx.getUserProfile`的调用限制问题：

1. **问题根源**: 微信API调用限制，只能在用户点击时调用
2. **解决方案**: 分离授权逻辑，只在用户交互时调用
3. **用户体验**: 保持原有功能，增加错误处理和备选方案
4. **代码优化**: 简化登录流程，提高代码可维护性

修复后，微信授权功能将正常工作，不再出现API调用限制错误。🎉
