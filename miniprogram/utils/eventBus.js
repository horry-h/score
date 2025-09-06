// 简单的全局事件总线
class EventBus {
  constructor() {
    this.events = {}
  }

  // 监听事件
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  // 触发事件
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        callback(data)
      })
    }
  }

  // 移除事件监听
  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback)
    }
  }
}

// 创建全局事件总线实例
const eventBus = new EventBus()

module.exports = eventBus
