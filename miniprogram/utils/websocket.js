// websocket.js - WebSocket连接管理工具
class WebSocketManager {
  constructor() {
    this.socket = null
    this.roomId = null
    this.userId = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectInterval = 3000
    this.heartbeatInterval = null
    this.messageHandlers = new Map()
    this.connectionHandlers = new Map()
  }

  // 连接到WebSocket服务器
  connect(roomId, userId) {
    if (this.socket && this.isConnected) {
      console.log('WebSocket已连接，无需重复连接')
      return Promise.resolve()
    }

    this.roomId = roomId
    this.userId = userId

    return new Promise((resolve, reject) => {
      try {
        // 构建WebSocket URL
        const wsUrl = `wss://www.aipaint.cloud/ws?room_id=${roomId}&user_id=${userId}`
        console.log('正在连接WebSocket:', wsUrl)

        this.socket = wx.connectSocket({
          url: wsUrl,
          success: () => {
            console.log('WebSocket连接请求已发送')
          },
          fail: (error) => {
            console.error('WebSocket连接失败:', error)
            reject(error)
          }
        })

        // 监听连接打开事件
        this.socket.onOpen(() => {
          console.log('WebSocket连接已建立')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.emit('connected')
          resolve()
        })

        // 监听消息事件
        this.socket.onMessage((res) => {
          try {
            const message = JSON.parse(res.data)
            console.log('收到WebSocket消息:', message)
            this.handleMessage(message)
          } catch (error) {
            console.error('解析WebSocket消息失败:', error)
          }
        })

        // 监听连接关闭事件
        this.socket.onClose((res) => {
          console.log('WebSocket连接已关闭:', res)
          this.isConnected = false
          this.stopHeartbeat()
          this.emit('disconnected', res)
          
          // 如果不是主动关闭，尝试重连
          if (res.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect()
          }
        })

        // 监听连接错误事件
        this.socket.onError((error) => {
          console.error('WebSocket连接错误:', error)
          this.isConnected = false
          this.stopHeartbeat()
          this.emit('error', error)
        })

      } catch (error) {
        console.error('创建WebSocket连接失败:', error)
        reject(error)
      }
    })
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      console.log('主动断开WebSocket连接')
      this.stopHeartbeat()
      this.socket.close({
        code: 1000,
        reason: '主动断开连接'
      })
      this.socket = null
      this.isConnected = false
    }
  }

  // 发送消息
  send(data) {
    if (this.socket && this.isConnected) {
      try {
        const message = JSON.stringify(data)
        this.socket.send({
          data: message,
          success: () => {
            console.log('WebSocket消息发送成功:', data)
          },
          fail: (error) => {
            console.error('WebSocket消息发送失败:', error)
          }
        })
      } catch (error) {
        console.error('WebSocket消息序列化失败:', error)
      }
    } else {
      console.warn('WebSocket未连接，无法发送消息')
    }
  }

  // 处理接收到的消息
  handleMessage(message) {
    const { type, data } = message
    
    // 触发对应类型的消息处理器
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type)
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`处理${type}消息时出错:`, error)
        }
      })
    }

    // 触发通用消息处理器
    this.emit('message', message)
  }

  // 注册消息处理器
  onMessage(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, [])
    }
    this.messageHandlers.get(type).push(handler)
  }

  // 移除消息处理器
  offMessage(type, handler) {
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type)
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  // 注册连接事件处理器
  on(event, handler) {
    if (!this.connectionHandlers.has(event)) {
      this.connectionHandlers.set(event, [])
    }
    this.connectionHandlers.get(event).push(handler)
  }

  // 移除连接事件处理器
  off(event, handler) {
    if (this.connectionHandlers.has(event)) {
      const handlers = this.connectionHandlers.get(event)
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  // 触发事件
  emit(event, data) {
    if (this.connectionHandlers.has(event)) {
      const handlers = this.connectionHandlers.get(event)
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`处理${event}事件时出错:`, error)
        }
      })
    }
  }

  // 启动心跳
  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' })
      }
    }, 30000) // 每30秒发送一次心跳
  }

  // 停止心跳
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // 安排重连
  scheduleReconnect() {
    this.reconnectAttempts++
    console.log(`WebSocket重连尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
    
    setTimeout(() => {
      if (this.roomId && this.userId) {
        this.connect(this.roomId, this.userId).catch(error => {
          console.error('WebSocket重连失败:', error)
        })
      }
    }, this.reconnectInterval)
  }

  // 获取连接状态
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      roomId: this.roomId,
      userId: this.userId,
      reconnectAttempts: this.reconnectAttempts
    }
  }
}

// 创建全局WebSocket管理器实例
const wsManager = new WebSocketManager()

module.exports = wsManager
