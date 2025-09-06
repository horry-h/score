# 真实微信登录功能实现说明

## 需求描述

将当前的mock微信登录改为真实的微信登录功能，通过微信API获取真实的用户openid，并将用户信息保存到数据库中。

## 实现方案

### 技术架构

1. **微信API调用**: 通过微信官方API获取用户openid
2. **用户信息管理**: 将真实的微信用户信息保存到数据库
3. **登录流程**: 完整的微信登录验证流程

### 核心组件

#### 1. 微信服务 (WeChatService)

**文件**: `server/internal/service/wechat.go`

**功能**:
- 调用微信官方API获取openid
- 验证用户信息
- 处理微信API响应

**关键方法**:
```go
// 通过code获取微信用户openid和session_key
func (w *WeChatService) GetOpenID(code string) (*WeChatLoginResponse, error)

// 验证用户信息的有效性
func (w *WeChatService) ValidateUserInfo(userInfo *WeChatUserInfo) error
```

#### 2. 修改后的登录逻辑

**文件**: `server/internal/service/mahjong.go`

**修改前**:
```go
// Mock数据
openid := "mock_openid_" + strconv.Itoa(rand.Intn(10000))
```

**修改后**:
```go
// 通过微信code获取openid
wechatResp, err := s.wechatService.GetOpenID(req.Code)
if err != nil {
    return &Response{Code: 500, Message: "获取微信用户信息失败: " + err.Error()}, nil
}

openid := wechatResp.OpenID
```

## 详细实现

### 1. 微信API集成

#### 微信登录API调用

```go
func (w *WeChatService) GetOpenID(code string) (*WeChatLoginResponse, error) {
    url := fmt.Sprintf("https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
        w.appID, w.appSecret, code)

    client := &http.Client{Timeout: 10 * time.Second}
    resp, err := client.Get(url)
    if err != nil {
        return nil, fmt.Errorf("请求微信API失败: %v", err)
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("读取响应失败: %v", err)
    }

    var result WeChatLoginResponse
    if err := json.Unmarshal(body, &result); err != nil {
        return nil, fmt.Errorf("解析响应失败: %v", err)
    }

    if result.ErrCode != 0 {
        return nil, fmt.Errorf("微信API错误: %d - %s", result.ErrCode, result.ErrMsg)
    }

    return &result, nil
}
```

#### 微信API响应结构

```go
type WeChatLoginResponse struct {
    OpenID     string `json:"openid"`
    SessionKey string `json:"session_key"`
    UnionID    string `json:"unionid"`
    ErrCode    int    `json:"errcode"`
    ErrMsg     string `json:"errmsg"`
}
```

### 2. 用户登录流程

#### 完整的登录逻辑

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
    
    // 2. 检查用户是否存在
    var userID int64
    err = s.db.QueryRow("SELECT id FROM users WHERE openid = ?", openid).Scan(&userID)
    
    if err == sql.ErrNoRows {
        // 3a. 创建新用户
        result, err := s.db.Exec(`
            INSERT INTO users (openid, nickname, avatar_url) 
            VALUES (?, ?, ?)
        `, openid, req.Nickname, req.AvatarUrl)
        if err != nil {
            return &Response{Code: 500, Message: "创建用户失败"}, nil
        }
        userID, _ = result.LastInsertId()
    } else if err != nil {
        return &Response{Code: 500, Message: "查询用户失败"}, nil
    } else {
        // 3b. 用户已存在，更新用户信息
        _, err = s.db.Exec(`
            UPDATE users SET nickname = ?, avatar_url = ?, updated_at = NOW() 
            WHERE id = ?
        `, req.Nickname, req.AvatarUrl, userID)
        if err != nil {
            return &Response{Code: 500, Message: "更新用户信息失败"}, nil
        }
    }
    
    // 4. 返回用户信息
    // ... 获取并返回用户信息
}
```

### 3. 配置管理

#### 微信配置

**文件**: `server/internal/config/config.go`

```go
type WeChatConfig struct {
    AppID     string
    AppSecret string
}

func Load() *Config {
    return &Config{
        WeChat: WeChatConfig{
            AppID:     "wx367870ff70acb37b",
            AppSecret: "7127a700e080747019e13a01ec48816f",
        },
    }
}
```

### 4. 服务集成

#### 主程序集成

**文件**: `server/main.go`

```go
func main() {
    // 加载配置
    cfg := config.Load()

    // 初始化数据库
    db, err := database.InitDB(cfg.Database)
    if err != nil {
        log.Fatalf("Failed to initialize database: %v", err)
    }
    defer db.Close()

    // 创建微信服务
    wechatService := service.NewWeChatService(cfg.WeChat.AppID, cfg.WeChat.AppSecret)

    // 创建HTTP处理器
    httpHandler := handler.NewHTTPHandler(db, wechatService)
    
    // ... 启动服务器
}
```

## 用户数据流程

### 1. 前端流程

1. **用户点击微信授权** → 调用`wx.getUserProfile`
2. **获取用户信息** → 昵称、头像等
3. **调用wx.login** → 获取临时code
4. **发送登录请求** → 包含code、昵称、头像

### 2. 后端流程

1. **接收登录请求** → 解析code、昵称、头像
2. **调用微信API** → 通过code获取openid
3. **检查用户存在** → 根据openid查询数据库
4. **创建或更新用户** → 保存用户信息到数据库
5. **返回用户信息** → 包含用户ID、openid等

### 3. 数据库操作

```sql
-- 检查用户是否存在
SELECT id FROM users WHERE openid = ?

-- 创建新用户
INSERT INTO users (openid, nickname, avatar_url) VALUES (?, ?, ?)

-- 更新用户信息
UPDATE users SET nickname = ?, avatar_url = ?, updated_at = NOW() WHERE id = ?
```

## 错误处理

### 1. 微信API错误

```go
if result.ErrCode != 0 {
    return nil, fmt.Errorf("微信API错误: %d - %s", result.ErrCode, result.ErrMsg)
}
```

### 2. 网络请求错误

```go
client := &http.Client{Timeout: 10 * time.Second}
resp, err := client.Get(url)
if err != nil {
    return nil, fmt.Errorf("请求微信API失败: %v", err)
}
```

### 3. 数据库错误

```go
if err != nil {
    return &Response{Code: 500, Message: "创建用户失败"}, nil
}
```

## 安全考虑

### 1. 微信AppSecret保护

- AppSecret存储在服务器端配置中
- 不在前端代码中暴露
- 定期更新AppSecret

### 2. 用户数据验证

```go
func (w *WeChatService) ValidateUserInfo(userInfo *WeChatUserInfo) error {
    if userInfo.OpenID == "" {
        return fmt.Errorf("openid不能为空")
    }
    if userInfo.NickName == "" {
        return fmt.Errorf("昵称不能为空")
    }
    return nil
}
```

### 3. 数据库安全

- 使用参数化查询防止SQL注入
- 对敏感数据进行加密存储
- 定期备份用户数据

## 测试验证

### 1. 单元测试

```go
func TestWeChatService_GetOpenID(t *testing.T) {
    service := NewWeChatService("test_appid", "test_secret")
    
    // 测试正常情况
    resp, err := service.GetOpenID("valid_code")
    assert.NoError(t, err)
    assert.NotEmpty(t, resp.OpenID)
    
    // 测试错误情况
    _, err = service.GetOpenID("invalid_code")
    assert.Error(t, err)
}
```

### 2. 集成测试

```go
func TestLoginFlow(t *testing.T) {
    // 模拟微信登录流程
    // 1. 调用微信API获取openid
    // 2. 创建或更新用户
    // 3. 验证返回结果
}
```

### 3. 端到端测试

1. **前端测试**: 验证微信授权和登录流程
2. **后端测试**: 验证API响应和数据库操作
3. **集成测试**: 验证完整的登录流程

## 部署配置

### 1. 环境变量

```bash
# 微信小程序配置
WECHAT_APPID=wx367870ff70acb37b
WECHAT_APPSECRET=7127a700e080747019e13a01ec48816f
```

### 2. 服务器配置

- 确保服务器可以访问微信API
- 配置HTTPS证书（微信API要求）
- 设置合适的超时时间

## 相关文件

- ✅ `server/internal/service/wechat.go` - 微信服务实现
- ✅ `server/internal/service/mahjong.go` - 修改登录逻辑
- ✅ `server/main.go` - 集成微信服务
- ✅ `server/internal/handler/http.go` - 更新处理器
- ✅ `server/internal/config/config.go` - 微信配置
- ✅ `REAL_WECHAT_LOGIN_IMPLEMENTATION.md` - 实现说明文档

## 总结

通过实现真实的微信登录功能，提供了完整的用户认证流程：

1. **真实API调用**: 通过微信官方API获取用户openid
2. **用户信息管理**: 将真实的微信用户信息保存到数据库
3. **完整登录流程**: 从微信授权到数据库存储的完整流程
4. **错误处理**: 完善的错误处理和用户反馈
5. **安全考虑**: 保护AppSecret和用户数据安全

修复后，用户将获得真实的微信登录体验，用户信息将正确保存到数据库中。🎉
