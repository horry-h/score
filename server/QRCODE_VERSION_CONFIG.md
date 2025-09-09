# 小程序二维码版本配置说明

## 概述
现在小程序二维码生成支持动态版本配置，版本信息由小程序端自动传入，确保生成的二维码指向对应版本的小程序。

## 实现原理

1. **前端获取版本**：小程序使用 `wx.getAccountInfoSync()` 获取当前运行环境的版本信息
2. **API传递版本**：生成二维码时，将版本信息传递给服务器
3. **动态生成**：服务器根据传入的版本信息生成对应版本的二维码

## 版本说明

- **develop**: 开发版，用于开发调试
- **trial**: 体验版，用于测试体验  
- **release**: 正式版，用于生产环境

## 技术实现

### 前端代码
```javascript
// 获取当前小程序版本信息
const accountInfo = wx.getAccountInfoSync();
const envVersion = accountInfo.miniProgram.envVersion;

// 生成二维码时传入版本信息
const response = await api.generateQRCode(roomId, envVersion);
```

### 后端API
```go
type GenerateQRCodeRequest struct {
    RoomId     int64  `json:"room_id"`
    EnvVersion string `json:"env_version"` // 小程序版本
}
```

## 使用场景

### 开发版小程序
- 用户扫描二维码 → 进入开发版小程序
- 适用于开发调试阶段

### 体验版小程序  
- 用户扫描二维码 → 进入体验版小程序
- 适用于测试体验阶段

### 正式版小程序
- 用户扫描二维码 → 进入正式版小程序
- 适用于生产环境

## 优势

1. **自动化**：无需手动配置，版本信息自动获取
2. **准确性**：确保二维码版本与当前小程序版本一致
3. **灵活性**：支持多版本并行开发
4. **维护性**：减少配置错误，降低维护成本

## 注意事项

1. 不同版本的小程序需要分别上传到微信后台
2. 体验版和正式版需要微信审核通过后才能使用
3. 版本信息由微信小程序运行时环境自动提供
4. 确保小程序代码在不同版本环境下都能正常运行
