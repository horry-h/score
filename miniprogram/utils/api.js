// API服务模块
const API_BASE_URL = 'https://www.aipaint.cloud'; // 后端服务地址

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // 通用请求方法
  async request(url, options = {}) {
    const defaultOptions = {
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
      },
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.baseURL}${url}`,
        ...finalOptions,
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
        fail: (error) => {
          console.error('API请求错误:', error);
          reject(error);
        }
      });
    });
  }

  // 用户相关API
  async autoLogin(code) {
    return this.request('/api/v1/autoLogin', {
      method: 'POST',
      data: {
        code,
      },
    });
  }

  async login(code, nickname, avatarUrl) {
    return this.request('/api/v1/login', {
      method: 'POST',
      data: {
        code,
        nickname,
        avatar_url: avatarUrl,
      },
    });
  }

  async getUserInfo(userId) {
    return this.request(`/api/v1/getUser?user_id=${userId}`, {
      method: 'GET',
    });
  }

  async updateUser(userId, nickname, avatarUrl) {
    return this.request('/api/v1/updateUser', {
      method: 'POST',
      data: {
        user_id: userId,
        nickname,
        avatar_url: avatarUrl,
      },
    });
  }

  async getUser(userId) {
    return this.request(`/api/v1/getUser?user_id=${userId}`);
  }

  // 房间相关API
  async createRoom(creatorId, roomName) {
    return this.request('/api/v1/createRoom', {
      method: 'POST',
      data: {
        creator_id: creatorId,
        room_name: roomName,
      },
    });
  }

  async joinRoom(userId, roomId) {
    return this.request('/api/v1/joinRoom', {
      method: 'POST',
      data: {
        user_id: userId,
        room_id: roomId,
      },
    });
  }

  async getRoom(roomId, roomCode) {
    // 优先使用roomId，如果没有则使用roomCode
    const params = roomId ? `room_id=${roomId}` : `room_code=${roomCode}`;
    const url = `/api/v1/getRoom?${params}`;
    console.log('getRoom API调用:', { roomId, roomCode, params, url });
    return this.request(url);
  }

  async getRoomPlayers(roomId) {
    return this.request(`/api/v1/getRoomPlayers?room_id=${roomId}`);
  }

  async getRoomTransfers(roomId) {
    return this.request(`/api/v1/getRoomTransfers?room_id=${roomId}`);
  }

  // 分数转移API
  async transferScore(roomId, fromUserId, toUserId, amount) {
    return this.request('/api/v1/transferScore', {
      method: 'POST',
      data: {
        room_id: roomId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
      },
    });
  }

  // 结算API
  async settleRoom(roomId, userId) {
    return this.request('/api/v1/settleRoom', {
      method: 'POST',
      data: {
        room_id: roomId,
        user_id: userId,
      },
    });
  }

  // 历史房间API
  async getUserRooms(userId, page = 1, pageSize = 10) {
    return this.request(`/api/v1/getUserRooms?user_id=${userId}&page=${page}&page_size=${pageSize}`);
  }

  async getRoomDetail(roomId, userId) {
    return this.request(`/api/v1/getRoomDetail?room_id=${roomId}&user_id=${userId}`);
  }

  async getRecentRoom(userId) {
    return this.request(`/api/v1/getRecentRoom?user_id=${userId}`);
  }

  async validateSession(sessionID) {
    return this.request('/api/v1/validateSession', {
      method: 'POST',
      data: {
        session_id: sessionID,
      },
    });
  }

  // 生成房间二维码
  async generateQRCode(roomId) {
    return this.request('/api/v1/generateQRCode', {
      method: 'POST',
      data: {
        room_id: roomId,
      },
    });
  }
}

// 创建单例实例
const apiService = new ApiService();

module.exports = apiService;
