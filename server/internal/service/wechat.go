package service

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type WeChatService struct {
	appID     string
	appSecret string
}

// 会话信息
type SessionInfo struct {
	OpenID     string    `json:"openid"`
	SessionKey string    `json:"session_key"`
	UnionID    string    `json:"unionid"`
	ExpiresAt  time.Time `json:"expires_at"`
}

// 自定义登录态
type CustomSession struct {
	SessionID string    `json:"session_id"`
	UserID    int64     `json:"user_id"`
	OpenID    string    `json:"openid"`
	ExpiresAt time.Time `json:"expires_at"`
}

type WeChatLoginResponse struct {
	OpenID     string `json:"openid"`
	SessionKey string `json:"session_key"`
	UnionID    string `json:"unionid"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

type WeChatUserInfo struct {
	OpenID    string `json:"openid"`
	NickName  string `json:"nickname"`
	Gender    int    `json:"sex"`
	Province  string `json:"province"`
	City      string `json:"city"`
	Country   string `json:"country"`
	AvatarURL string `json:"headimgurl"`
	UnionID   string `json:"unionid"`
}

func NewWeChatService(appID, appSecret string) *WeChatService {
	return &WeChatService{
		appID:     appID,
		appSecret: appSecret,
	}
}

// 通过code获取微信用户openid和session_key
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

// 验证微信用户信息（通过encryptedData和iv解密）
func (w *WeChatService) DecryptUserInfo(encryptedData, iv, sessionKey string) (*WeChatUserInfo, error) {
	// 这里需要实现AES解密逻辑
	// 由于微信小程序已经不再支持getUserInfo，我们主要使用wx.getUserProfile获取的用户信息
	// 所以这个方法暂时返回nil，实际用户信息由前端直接传递
	return nil, nil
}

// 验证用户信息的有效性
func (w *WeChatService) ValidateUserInfo(userInfo *WeChatUserInfo) error {
	if userInfo.OpenID == "" {
		return fmt.Errorf("openid不能为空")
	}
	if userInfo.NickName == "" {
		return fmt.Errorf("昵称不能为空")
	}
	return nil
}

// 生成自定义登录态
func (w *WeChatService) GenerateCustomSession(userID int64, openID string) *CustomSession {
	// 生成唯一的session_id
	sessionID := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%d_%s_%d", userID, openID, time.Now().UnixNano()))))
	
	// 设置过期时间（7天）
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	
	return &CustomSession{
		SessionID: sessionID,
		UserID:    userID,
		OpenID:    openID,
		ExpiresAt: expiresAt,
	}
}

// 验证自定义登录态
func (w *WeChatService) ValidateCustomSession(sessionID string) (*CustomSession, error) {
	// 这里应该从数据库或缓存中获取session信息
	// 为了简化，这里返回一个示例
	// 实际实现中应该查询数据库验证session的有效性
	
	if sessionID == "" {
		return nil, fmt.Errorf("session_id不能为空")
	}
	
	// 实际实现中应该：
	// 1. 从数据库查询session信息
	// 2. 检查是否过期
	// 3. 返回用户信息
	
	return nil, fmt.Errorf("session验证功能待实现")
}

// 创建会话信息
func (w *WeChatService) CreateSession(openID, sessionKey, unionID string) *SessionInfo {
	return &SessionInfo{
		OpenID:     openID,
		SessionKey: sessionKey,
		UnionID:    unionID,
		ExpiresAt:  time.Now().Add(24 * time.Hour), // 微信session_key有效期24小时
	}
}
