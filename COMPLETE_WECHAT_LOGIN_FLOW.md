# 完整微信登录流程实现说明

## 需求描述

根据[微信官方登录文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)，完善微信小程序登录流程，实现完整的用户认证体系。

## 微信官方登录流程

### 登录流程时序

根据微信官方文档，完整的登录流程如下：

1. **小程序端**: 调用 `wx.login()` 获取临时登录凭证code
2. **小程序端**: 将code发送到开发者服务器
3. **服务端**: 调用 `auth.code2Session` 接口，换取用户唯一标识OpenID和会话密钥session_key
4. **服务端**: 根据用户标识生成自定义登录态
5. **服务端**: 将自定义登录态返回给小程序端
6. **小程序端**: 保存自定义登录态，用于后续业务逻辑

## 实现方案

### 1. 服务端实现

#### 微信服务 (WeChatService)

**文件**: `server/internal/service/wechat.go`

**核心功能**:
- 调用微信官方API获取openid和session_key
- 生成自定义登录态
- 验证登录态有效性

**关键方法**:
```go
// 通过code获取微信用户openid和session_key
func (w *WeChatService) GetOpenID(code string) (*WeChatLoginResponse, error)

// 生成自定义登录态
func (w *WeChatService) GenerateCustomSession(userID int64, openID string) *CustomSession

// 验证自定义登录态
func (w *WeChatService) ValidateCustomSession(sessionID string) (*CustomSession, error)
```

#### 登录响应数据结构

```go
type WeChatLoginResponse struct {
    OpenID     string `json:"openid"`
    SessionKey string `json:"session_key"`
    UnionID    string `json:"unionid"`
    ErrCode    int    `json:"errcode"`
    ErrMsg     string `json:"errmsg"`
}

type CustomSession struct {
    SessionID string    `json:"session_id"`
    UserID    int64     `json:"user_id"`
    OpenID    string    `json:"openid"`
    ExpiresAt time.Time `json:"expires_at"`
}
```

#### 完整的登录逻辑

**文件**: `server/internal/service/mahjong.go`

```go
func (s *MahjongService) Login(ctx context.Context, req *LoginRequest) (*Response, error) {
    // 1. 通过微信code获取openid
    wechatResp, err := s.wechatService.GetOpenID(req.Code)
    if err != nil {
        return &Response{Code: 500, Message: "获取微信用户信息失败: " + err.Error()}, nil
    }
    
    openid := wechatResp.OpenID
    if openid == "" {
        return &Response{Code: 500, Message: "获取openid失败"}, nil
    }
    
    // 2. 检查用户是否存在，创建或更新用户
    // ... 用户管理逻辑
    
    // 3. 生成自定义登录态
    customSession := s.wechatService.GenerateCustomSession(userID, openid)
    
    // 4. 创建登录响应数据
    loginData := map[string]interface{}{
        "user":       user,
        "session_id": customSession.SessionID,
        "expires_at": customSession.ExpiresAt.Unix(),
    }
    
    userData, _ := json.Marshal(loginData)
    return &Response{Code: 200, Message: "登录成功", Data: string(userData)}, nil
}
```

#### 登录态验证

```go
func (s *MahjongService) ValidateSession(ctx context.Context, sessionID string) (*Response, error) {
    if sessionID == "" {
        return &Response{Code: 401, Message: "未登录"}, nil
    }
    
    // 验证自定义登录态
    customSession, err := s.wechatService.ValidateCustomSession(sessionID)
    if err != nil {
        return &Response{Code: 401, Message: "登录态无效"}, nil
    }
    
    // 检查是否过期
    if time.Now().After(customSession.ExpiresAt) {
        return &Response{Code: 401, Message: "登录态已过期"}, nil
    }
    
    // 返回用户信息
    // ...
}
```

### 2. 前端实现

#### 登录流程

**文件**: `miniprogram/app.js`

```javascript
async login(nickname = '微信用户', avatarUrl = '') {
  try {
    // 1. 获取微信登录code
    const loginRes = await this.wxLogin()
    if (!loginRes.code) {
      throw new Error('获取微信登录code失败')
    }
    
    // 2. 调用后端登录接口
    const response = await api.login(loginRes.code, nickname, avatarUrl)
    
    if (response.code === 200) {
      // 3. 解析登录响应数据
      const loginData = JSON.parse(response.data)
      const user = loginData.user
      const sessionID = loginData.session_id
      const expiresAt = loginData.expires_at
      
      // 4. 保存用户信息和登录态
      const userData = {
        ...user,
        user_id: user.id,
        nickName: nickname,
        avatarUrl: avatarUrl,
        session_id: sessionID,
        expires_at: expiresAt
      }
      
      wx.setStorageSync('userInfo', userData)
      wx.setStorageSync('sessionID', sessionID)
      this.globalData.userInfo = userData
      
      return userData
    } else {
      throw new Error(response.message || '登录失败')
    }
  } catch (error) {
    console.error('登录失败:', error)
    throw error
  }
}
```

#### 登录态验证

```javascript
async validateSession() {
  try {
    const sessionID = wx.getStorageSync('sessionID')
    if (!sessionID) {
      return false
    }
    
    const response = await api.validateSession(sessionID)
    if (response.code === 200) {
      // 更新用户信息
      const userData = JSON.parse(response.data)
      this.globalData.userInfo = userData
      wx.setStorageSync('userInfo', userData)
      return true
    } else {
      // 登录态无效，清除本地数据
      wx.removeStorageSync('sessionID')
      wx.removeStorageSync('userInfo')
      this.globalData.userInfo = null
      return false
    }
  } catch (error) {
    console.error('验证登录态失败:', error)
    return false
  }
}
```

### 3. API接口

#### 登录接口

**POST** `/api/v1/login`

**请求参数**:
```json
{
  "code": "微信临时登录凭证",
  "nickname": "用户昵称",
  "avatar_url": "用户头像URL"
}
```

**响应数据**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": "{\"user\":{\"id\":1,\"openid\":\"真实openid\",\"nickname\":\"用户昵称\",\"avatar_url\":\"头像URL\",\"created_at\":1694000000,\"updated_at\":1694000000},\"session_id\":\"自定义登录态ID\",\"expires_at\":1694000000}"
}
```

#### 验证登录态接口

**POST** `/api/v1/validateSession`

**请求参数**:
```json
{
  "session_id": "自定义登录态ID"
}
```

**响应数据**:
```json
{
  "code": 200,
  "message": "验证成功",
  "data": "{\"id\":1,\"openid\":\"真实openid\",\"nickname\":\"用户昵称\",\"avatar_url\":\"头像URL\",\"created_at\":1694000000,\"updated_at\":1694000000}"
}
```

## 安全考虑

### 1. 微信API安全

- **AppSecret保护**: AppSecret存储在服务器端，不在前端暴露
- **HTTPS通信**: 所有API调用使用HTTPS
- **超时设置**: 设置合理的请求超时时间

### 2. 会话安全

- **Session Key保护**: 会话密钥不发送到小程序端
- **自定义登录态**: 生成安全的自定义登录态
- **过期机制**: 设置合理的登录态过期时间

### 3. 数据验证

- **输入验证**: 验证所有输入参数
- **错误处理**: 完善的错误处理机制
- **日志记录**: 记录关键操作日志

## 数据流程

### 1. 用户首次登录

```
1. 用户点击微信授权
   ↓
2. 小程序调用wx.getUserProfile获取用户信息
   ↓
3. 小程序调用wx.login获取临时code
   ↓
4. 小程序发送code+用户信息到服务端
   ↓
5. 服务端调用微信API获取openid
   ↓
6. 服务端创建用户记录
   ↓
7. 服务端生成自定义登录态
   ↓
8. 服务端返回用户信息+登录态
   ↓
9. 小程序保存用户信息和登录态
```

### 2. 用户后续访问

```
1. 小程序启动时验证登录态
   ↓
2. 发送session_id到服务端验证
   ↓
3. 服务端验证登录态有效性
   ↓
4. 返回用户信息或要求重新登录
```

## 错误处理

### 1. 微信API错误

```go
if result.ErrCode != 0 {
    return nil, fmt.Errorf("微信API错误: %d - %s", result.ErrCode, result.ErrMsg)
}
```

### 2. 网络错误

```go
client := &http.Client{Timeout: 10 * time.Second}
resp, err := client.Get(url)
if err != nil {
    return nil, fmt.Errorf("请求微信API失败: %v", err)
}
```

### 3. 登录态验证错误

```go
if time.Now().After(customSession.ExpiresAt) {
    return &Response{Code: 401, Message: "登录态已过期"}, nil
}
```

## 测试验证

### 1. 登录流程测试

1. **新用户登录**: 验证完整的登录流程
2. **已存在用户登录**: 验证用户信息更新
3. **登录态验证**: 验证登录态的有效性
4. **过期处理**: 验证登录态过期后的处理

### 2. 错误场景测试

1. **微信API错误**: 模拟微信API返回错误
2. **网络错误**: 模拟网络连接失败
3. **无效code**: 测试无效的临时登录凭证
4. **登录态过期**: 测试过期登录态的处理

## 部署配置

### 1. 微信小程序配置

在微信公众平台配置：
- **AppID**: 小程序唯一标识
- **AppSecret**: 小程序密钥
- **服务器域名**: 配置合法域名

### 2. 服务端配置

```go
WeChat: WeChatConfig{
    AppID:     "wx367870ff70acb37b",
    AppSecret: "7127a700e080747019e13a01ec48816f",
}
```

## 相关文件

- ✅ `server/internal/service/wechat.go` - 微信服务实现
- ✅ `server/internal/service/mahjong.go` - 登录逻辑实现
- ✅ `server/internal/handler/http.go` - HTTP接口处理
- ✅ `server/internal/service/types.go` - 数据结构定义
- ✅ `miniprogram/app.js` - 前端登录逻辑
- ✅ `miniprogram/utils/api.js` - API接口封装
- ✅ `COMPLETE_WECHAT_LOGIN_FLOW.md` - 完整实现说明

## 总结

通过实现完整的微信登录流程，提供了符合微信官方规范的认证体系：

1. **官方规范**: 完全按照微信官方文档实现登录流程
2. **安全可靠**: 保护AppSecret和会话密钥，生成安全的自定义登录态
3. **完整流程**: 从微信授权到登录态验证的完整流程
4. **错误处理**: 完善的错误处理和用户反馈机制
5. **会话管理**: 支持登录态验证和过期处理

修复后，用户将获得安全、可靠的微信登录体验，完全符合微信官方的登录规范。🎉
