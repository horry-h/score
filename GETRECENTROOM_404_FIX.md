# getRecentRoom 404错误修复说明

## 问题描述

小程序调用`getRecentRoom`接口时出现404错误：

```
api.js:21 GET http://124.156.196.117:8080/api/v1/getRecentRoom?user_id=20 404 (Not Found)
```

## 问题分析

### 1. 接口状态检查

通过测试发现：
- ✅ 服务器正在运行（health接口正常）
- ✅ 接口路由存在（`/api/v1/getRecentRoom`）
- ✅ 处理方法存在（`handleGetRecentRoom`）
- ✅ 业务逻辑实现存在（`GetRecentRoom`）

### 2. 根本原因

问题在于**HTTP状态码和业务逻辑状态码的混淆**：

1. **后端问题**: `writeResponse`方法直接使用业务逻辑的code作为HTTP状态码
2. **前端问题**: API请求只检查HTTP状态码200，没有处理业务逻辑状态码

### 3. 具体表现

```bash
# 测试结果
curl -s -w "HTTP Status: %{http_code}\n" "http://124.156.196.117:8080/api/v1/getRecentRoom?user_id=20"
{"code":404,"message":"没有最近房间","data":""}
HTTP Status: 404  # ❌ 应该是200
```

## 修复方案

### 1. 后端修复

**文件**: `server/internal/handler/http.go`

**问题代码**:
```go
// 写入响应
func (h *HTTPHandler) writeResponse(w http.ResponseWriter, response *service.Response) {
	w.WriteHeader(int(response.Code))  // ❌ 直接使用业务逻辑code作为HTTP状态码
	json.NewEncoder(w).Encode(response)
}
```

**修复后**:
```go
// 写入响应
func (h *HTTPHandler) writeResponse(w http.ResponseWriter, response *service.Response) {
	// 对于业务逻辑错误，返回HTTP 200状态码，在响应体中包含业务状态码
	if response.Code == 404 {
		w.WriteHeader(http.StatusOK)
	} else if response.Code >= 400 {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	json.NewEncoder(w).Encode(response)
}
```

### 2. 前端修复

**文件**: `miniprogram/utils/api.js`

**问题代码**:
```javascript
success: (response) => {
  if (response.statusCode === 200) {
    resolve(response.data);  // ❌ 没有检查业务逻辑状态码
  } else {
    reject(new Error(`请求失败: ${response.statusCode}`));
  }
},
```

**修复后**:
```javascript
success: (response) => {
  if (response.statusCode === 200) {
    // 检查业务逻辑状态码
    if (response.data && response.data.code === 200) {
      resolve(response.data);
    } else {
      // 业务逻辑错误，但HTTP请求成功
      const errorMsg = response.data ? response.data.message : '请求失败';
      reject(new Error(errorMsg));
    }
  } else {
    reject(new Error(`请求失败: ${response.statusCode}`));
  }
},
```

## 修复原理

### HTTP状态码 vs 业务逻辑状态码

1. **HTTP状态码**: 表示HTTP请求本身的状态
   - 200: 请求成功
   - 404: 资源不存在
   - 500: 服务器内部错误

2. **业务逻辑状态码**: 表示业务逻辑的执行结果
   - 200: 业务操作成功
   - 404: 业务数据不存在（如"没有最近房间"）
   - 500: 业务操作失败

### 正确的处理方式

1. **后端**: 所有业务逻辑响应都应该返回HTTP 200状态码
2. **前端**: 检查HTTP状态码200后，再检查业务逻辑状态码

## 测试验证

### 修复前
```bash
curl -s -w "HTTP Status: %{http_code}\n" "http://124.156.196.117:8080/api/v1/getRecentRoom?user_id=20"
{"code":404,"message":"没有最近房间","data":""}
HTTP Status: 404  # ❌ 错误
```

### 修复后（预期）
```bash
curl -s -w "HTTP Status: %{http_code}\n" "http://124.156.196.117:8080/api/v1/getRecentRoom?user_id=20"
{"code":404,"message":"没有最近房间","data":""}
HTTP Status: 200  # ✅ 正确
```

## 部署步骤

1. **重新构建后端**:
   ```bash
   cd server
   go build -o mahjong-server .
   ```

2. **重启服务器**:
   ```bash
   # 在服务器上执行
   sudo systemctl restart score-server
   ```

3. **验证修复**:
   ```bash
   curl -s -w "HTTP Status: %{http_code}\n" "http://124.156.196.117:8080/api/v1/getRecentRoom?user_id=20"
   ```

## 相关文件

- ✅ `server/internal/handler/http.go` - 修复HTTP状态码处理
- ✅ `miniprogram/utils/api.js` - 修复前端API错误处理
- ✅ `GETRECENTROOM_404_FIX.md` - 修复说明文档

## 总结

通过修复HTTP状态码和业务逻辑状态码的混淆问题，解决了`getRecentRoom`接口的404错误。现在：

1. **后端**: 正确返回HTTP 200状态码，业务逻辑状态码在响应体中
2. **前端**: 正确处理业务逻辑错误，提供更好的用户体验
3. **一致性**: 所有API接口都遵循相同的状态码处理规范

**修复完成！** 需要重启服务器以应用修复。🎉
