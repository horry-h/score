// room.js
const api = require('../../utils/api');
const wsManager = require('../../utils/websocket');
const version = require('../../utils/version');
const app = getApp();

Page({
  data: {
    roomId: null,
    roomInfo: {},
    players: [],
    sortedPlayers: [],
    transfers: [],
    currentUserId: null,
    showShareModal: false,
    showProfileModal: false,
    showSettlementModal: false,
    settlementData: [],
    loading: false,
    qrCodeData: null,
    qrCodeLoading: false,
    showAvatarOverlay: false, // 是否显示头像蒙层提示
    avatarOverlayDismissed: false, // 头像蒙层是否已被用户主动关闭
    selectedPlayerId: null, // 当前选中的玩家ID（用于转移分数）
    profileForm: {
      nickname: '微信用户',
      avatarUrl: ''
    }
  },

  async onLoad(options) {
    console.log('房间页面onLoad，接收到的参数:', options);
    console.log('参数类型检查:');
    console.log('- options.scene:', options.scene, '类型:', typeof options.scene);
    console.log('- options.roomId:', options.roomId, '类型:', typeof options.roomId);
    console.log('- options.roomCode:', options.roomCode, '类型:', typeof options.roomCode);
    
    // 检查用户信息，如果app.js已经静默登录成功，直接使用
    let userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.user_id) {
      try {
        console.log('开始获取用户登录信息...');
        userInfo = await app.autoLogin();
        console.log('获取用户信息成功:', userInfo);
        
        // 保存到全局数据
        app.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
        
      } catch (error) {
        console.error('获取用户登录信息失败:', error);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
        return;
      }
    } else {
      console.log('使用已有的用户信息');
    }
    
    // 更新页面数据中的用户信息
    this.setData({
      currentUserId: userInfo.user_id,
      userInfo: userInfo
    });
    
    let roomId = null;
    let roomCode = null;
    
    // 处理从二维码扫描或分享进入的情况
    if (options.scene) {
      console.log('从二维码扫描或分享进入，scene参数:', options.scene);
      console.log('scene参数长度:', options.scene.length);
      console.log('scene参数内容:', JSON.stringify(options.scene));
      
      // 显示进入提示
      wx.showToast({
        title: '正在进入房间...',
        icon: 'loading',
        duration: 1500
      });
      
      // 尝试直接处理URL编码的scene参数
      let decodedScene = options.scene;
      try {
        decodedScene = decodeURIComponent(options.scene);
        console.log('直接URL解码后的scene:', decodedScene);
      } catch (error) {
        console.log('URL解码失败，使用原始scene:', error);
      }
      
      // 如果解码后包含roomId=，直接提取
      if (decodedScene.includes('roomId=')) {
        const roomIdMatch = decodedScene.match(/roomId=(\d+)/);
        if (roomIdMatch) {
          roomId = roomIdMatch[1];
          console.log('直接从scene提取到roomId:', roomId);
        }
      }
      
      // 如果直接提取失败，使用解析方法
      if (!roomId) {
        const sceneParams = this.parseSceneParams(options.scene);
        console.log('解析后的scene参数:', sceneParams);
        console.log('scene参数对象键:', Object.keys(sceneParams));
        
        if (sceneParams.roomId) {
          roomId = sceneParams.roomId;
          console.log('从scene获取到roomId:', roomId, '类型:', typeof roomId);
        } else {
          console.log('scene参数中没有找到roomId，可用的键:', Object.keys(sceneParams));
        }
      }
    }
    
    // 处理直接URL参数
    if (options.roomId) {
      roomId = options.roomId;
      console.log('从URL参数获取到roomId:', roomId);
    }
    
    if (options.roomCode) {
      roomCode = options.roomCode;
      console.log('从URL参数获取到roomCode:', roomCode);
    }
    
    console.log('最终roomId值:', roomId, '类型:', typeof roomId);
    console.log('最终roomCode值:', roomCode, '类型:', typeof roomCode);
    
    // 优先使用roomId，如果没有则使用roomCode
    if (roomId && roomId !== 'undefined' && roomId !== 'null' && roomId.trim() !== '') {
      const parsedRoomId = parseInt(roomId);
      console.log('解析后的roomId:', parsedRoomId);
      
      if (isNaN(parsedRoomId)) {
        console.error('roomId解析失败，不是有效数字:', roomId);
        wx.showToast({
          title: '房间ID无效',
          icon: 'none'
        });
        return;
      }
      
      console.log('使用roomId进入房间:', parsedRoomId);
      this.setData({ roomId: parsedRoomId });
      this.loadRoomData();
    } else if (roomCode && roomCode !== 'undefined' && roomCode !== 'null' && roomCode.trim() !== '') {
      console.log('使用roomCode进入房间:', roomCode);
      this.setData({ roomCode: roomCode });
      this.loadRoomData();
    } else {
      console.error('未接收到有效的roomId或roomCode参数:', { roomId, roomCode });
      wx.showToast({
        title: '缺少房间信息',
        icon: 'none'
      });
    }
    
    // 启用分享功能
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    
    // 设置WebSocket事件监听
    this.setupWebSocketListeners();
  },

  onShow() {
    if (this.data.roomId) {
      this.loadRoomData();
      // 连接WebSocket
      this.connectWebSocket();
    }
  },

  onHide() {
    // 断开WebSocket连接
    this.disconnectWebSocket();
  },

  onUnload() {
    // 断开WebSocket连接
    this.disconnectWebSocket();
    
    // 清理缓存，释放内存
    this.cleanupCache();
  },

  // 加载房间数据
  async loadRoomData() {
    try {
      console.log('loadRoomData开始，当前roomId:', this.data.roomId);
      console.log('loadRoomData开始，当前roomCode:', this.data.roomCode);
      
      // 用户信息已在onLoad时确保可用
      const userInfo = this.data.userInfo || app.globalData.userInfo || wx.getStorageSync('userInfo');
      if (!userInfo || !userInfo.user_id) {
        console.error('用户信息不可用，重新获取...');
        try {
          const newUserInfo = await app.autoLogin();
          this.setData({
            currentUserId: newUserInfo.user_id,
            userInfo: newUserInfo
          });
          app.globalData.userInfo = newUserInfo;
          wx.setStorageSync('userInfo', newUserInfo);
        } catch (error) {
          wx.showToast({
            title: '请先登录',
            icon: 'none'
          });
          return;
        }
      }

      // 检查是否有有效的房间标识
      if (!this.data.roomId && !this.data.roomCode) {
        console.error('房间标识无效，roomId:', this.data.roomId, 'roomCode:', this.data.roomCode);
        wx.showToast({
          title: '房间信息无效',
          icon: 'none'
        });
        return;
      }

      // 检查是否需要显示头像蒙层提示
      const shouldShowAvatarOverlay = this.shouldShowAvatarOverlay(userInfo);
      
      this.setData({ 
        currentUserId: userInfo.user_id,
        userInfo: userInfo,
        loading: true,
        showAvatarOverlay: shouldShowAvatarOverlay
      });

      console.log('开始加载房间数据，roomId:', this.data.roomId, 'roomCode:', this.data.roomCode);
      
      // 先获取房间信息
      console.log('调用api.getRoom，参数:', { roomId: this.data.roomId, roomCode: this.data.roomCode });
      const roomResponse = await api.getRoom(this.data.roomId, this.data.roomCode);
      console.log('getRoom响应:', roomResponse);
      
      if (roomResponse.code === 200) {
        // 解析JSON字符串
        let roomData;
        try {
          roomData = typeof roomResponse.data === 'string' ? JSON.parse(roomResponse.data) : roomResponse.data;
          console.log('解析后的房间数据:', roomData);
        } catch (error) {
          console.error('解析房间数据失败:', error);
          wx.showToast({
            title: '房间数据解析失败',
            icon: 'none'
          });
          return;
        }
        
        this.setData({
          roomInfo: roomData,
        });
        
        // 房间状态已加载，无需额外处理
        
        // 如果使用roomCode进入，需要获取roomId用于后续API调用
        if (this.data.roomCode && !this.data.roomId) {
          this.setData({ roomId: roomData.id });
          console.log('从roomCode获取到roomId:', roomData.id);
        }
        
        // 检查用户是否在房间中，如果不在则自动加入
        const userInRoom = await this.checkAndAutoJoinRoom(roomData);
        if (!userInRoom) {
          return;
        }
        
        // 现在加载玩家信息和转移记录
        const [playersResponse, transfersResponse] = await Promise.all([
          api.getRoomPlayers(this.data.roomId),
          api.getRoomTransfers(this.data.roomId, 0), // 0表示全量获取
        ]);
        
        console.log('getRoomPlayers响应:', playersResponse);
        
        if (playersResponse.code === 200) {
          // 解析玩家数据JSON字符串
          let playersData;
          try {
            playersData = typeof playersResponse.data === 'string' ? JSON.parse(playersResponse.data) : playersResponse.data;
            console.log('解析后的玩家数据:', playersData);
            console.log('玩家数据类型:', typeof playersData);
            console.log('玩家数据长度:', playersData ? playersData.length : 0);
            
            // 检查每个玩家的数据结构
            if (playersData && playersData.length > 0) {
              console.log('第一个玩家数据结构:', playersData[0]);
              console.log('第一个玩家的用户信息:', playersData[0].user);
            }
          } catch (error) {
            console.error('解析玩家数据失败:', error);
            playersData = [];
          }
          
          // 确保 playersData 是数组
          if (!playersData || !Array.isArray(playersData)) {
            console.log('玩家数据不是数组，重置为空数组');
            playersData = [];
          }
          
          // 检查当前用户是否在玩家列表中
          const currentUserInList = playersData.find(player => player.user_id === userInfo.user_id);
          if (!currentUserInList) {
            console.log('当前用户不在房间中，尝试自动加入房间...');
            console.log('使用用户信息:', userInfo);
            try {
              // 自动加入房间
              const joinResponse = await api.joinRoom(userInfo.user_id, this.data.roomId);
              console.log('自动加入房间响应:', joinResponse);
              
              if (joinResponse.code === 200) {
                console.log('自动加入房间成功');
                wx.showToast({
                  title: '欢迎加入房间！',
                  icon: 'success',
                  duration: 2000
                });
                
                // 重新获取玩家列表
                const updatedPlayersResponse = await api.getRoomPlayers(this.data.roomId);
                if (updatedPlayersResponse.code === 200) {
                  let updatedPlayersData;
                  try {
                    updatedPlayersData = typeof updatedPlayersResponse.data === 'string' ? JSON.parse(updatedPlayersResponse.data) : updatedPlayersResponse.data;
                  } catch (error) {
                    console.error('解析更新后的玩家数据失败:', error);
                    updatedPlayersData = playersData;
                  }
                  playersData = updatedPlayersData || playersData;
                }
              } else if (joinResponse.code === 400 && joinResponse.message === '房间已结算') {
                console.log('房间已结算，无法加入');
                wx.showToast({
                  title: '房间已结束',
                  icon: 'none'
                });
                return;
              } else if (joinResponse.code === 404) {
                console.log('房间不存在');
                wx.showToast({
                  title: '房间不存在',
                  icon: 'none'
                });
                return;
              } else {
                console.log('自动加入房间失败:', joinResponse.message);
                wx.showToast({
                  title: joinResponse.message || '加入房间失败',
                  icon: 'none'
                });
                return;
              }
            } catch (error) {
              console.error('自动加入房间时发生错误:', error);
              wx.showToast({
                title: '加入房间失败',
                icon: 'none'
              });
              return;
            }
          } else {
            console.log('当前用户已在房间中');
          }
          
          // 排序玩家：当前用户始终在第一个位置
          const sortedPlayers = this.sortPlayers(playersData, userInfo.user_id);
          console.log('排序后的玩家列表:', sortedPlayers);
          
          this.setData({
            players: playersData,
            sortedPlayers: sortedPlayers,
          });
        }

        if (transfersResponse.code === 200) {
          // 解析转移记录JSON字符串
          let newTransfers;
          try {
            newTransfers = typeof transfersResponse.data === 'string' ? JSON.parse(transfersResponse.data) : transfersResponse.data;
            console.log('解析后的转移记录数据:', newTransfers);
          } catch (error) {
            console.error('解析转移记录数据失败:', error);
            newTransfers = [];
          }
          
          // 预处理新流水的时间格式和分数格式
          if (newTransfers && newTransfers.length > 0) {
            newTransfers.forEach(transfer => {
              // 处理时间格式
              if (transfer.created_at) {
                try {
                  const date = new Date(transfer.created_at);
                  if (!isNaN(date.getTime())) {
                    // 直接在JavaScript中格式化时间，避免WXS问题
                    transfer.formatted_time = this.formatTimestampJS(transfer.created_at);
                  }
                } catch (error) {
                  console.error('处理时间格式失败:', error, transfer.created_at);
                  transfer.formatted_time = '';
                }
              } else {
                transfer.formatted_time = '';
              }
              
              // 处理分数格式
              transfer.formatted_amount = this.formatTransferAmount(transfer, userInfo.user_id);
            });
          }
          
          // 使用缓存管理函数合并和限制记录
          const currentTransfers = this.data.transfers || [];
          console.log('loadRoomData合并前 - currentTransfers:', currentTransfers, 'newTransfers:', newTransfers);
          const updatedTransfers = this.mergeAndLimitTransfers(currentTransfers, newTransfers);
          
          // 更新lastTransferId，用于后续增量更新
          const newLastTransferId = updatedTransfers.length > 0 
            ? Math.max(...updatedTransfers.map(t => t.id))
            : this.data.lastTransferId;
          
          this.setData({
            transfers: updatedTransfers,
            lastTransferId: newLastTransferId,
          });
          
          console.log('流水记录已更新，总数:', updatedTransfers.length);
        }
      } else {
        wx.showToast({
          title: roomResponse.message || '加载房间信息失败',
          icon: 'none'
        });
        return;
      }
    } catch (error) {
      console.error('加载房间数据失败:', error);
      wx.showToast({
        title: '加载房间数据失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 格式化时间戳（JavaScript版本，作为WXS的备用）
  formatTimestampJS(timestamp) {
    if (!timestamp) {
      return '';
    }
    
    try {
      let date;
      if (typeof timestamp === 'string') {
        // 处理ISO时间字符串
        if (timestamp.includes('T') || timestamp.includes('-')) {
          date = new Date(timestamp);
        } else {
          // 处理时间戳字符串
          const timestampNum = parseInt(timestamp);
          if (timestampNum && !isNaN(timestampNum) && timestampNum > 0) {
            date = new Date(timestampNum);
          }
        }
      } else if (typeof timestamp === 'number') {
        // 处理数字时间戳
        if (timestamp > 0) {
          date = new Date(timestamp);
        }
      }
      
      if (!date || isNaN(date.getTime())) {
        return '';
      }
      
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      if (isNaN(diff) || diff < 0) {
        return '';
      }
      
      // 小于1分钟
      if (diff < 60000) {
        const seconds = Math.floor(diff / 1000);
        return seconds + '秒前';
      }
      
      // 小于1小时
      if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return minutes + '分钟前';
      }
      
      // 小于24小时
      if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return hours + '小时前';
      }
      
      // 小于7天
      if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return days + '天前';
      }
      
      // 超过7天，显示具体日期
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = date.getHours();
      const minute = date.getMinutes();
      
      // 如果是今年，不显示年份
      if (year === now.getFullYear()) {
        return month + '月' + day + '日 ' + 
               (hour < 10 ? '0' + hour : hour) + ':' + 
               (minute < 10 ? '0' + minute : minute);
      }
      
      // 跨年显示完整日期
      return year + '年' + month + '月' + day + '日 ' + 
             (hour < 10 ? '0' + hour : hour) + ':' + 
             (minute < 10 ? '0' + minute : minute);
    } catch (error) {
      console.error('格式化时间失败:', error);
      return '';
    }
  },

  // 清理缓存
  cleanupCache() {
    console.log('清理缓存数据');
    this.setData({
      transfers: [],
      lastTransferId: 0,
    });
  },

  // 缓存管理：合并流水记录并限制缓存大小
  mergeAndLimitTransfers(currentTransfers, newTransfers, maxCacheSize = 100) {
    console.log('mergeAndLimitTransfers调用 - currentTransfers:', currentTransfers, 'newTransfers:', newTransfers);
    
    // 确保参数不为null或undefined
    const current = currentTransfers || [];
    const newData = newTransfers || [];
    
    console.log('处理后 - current:', current, 'newData:', newData);
    
    // 合并所有记录
    const allTransfers = [...current, ...newData];
    
    // 如果没有记录，直接返回空数组
    if (allTransfers.length === 0) {
      return [];
    }
    
    // 去重：基于ID去重，保留最新的记录
    const uniqueTransfers = [];
    const seenIds = new Set();
    
    // 按ID降序排序，确保最新的记录在前面
    allTransfers.sort((a, b) => b.id - a.id);
    
    for (const transfer of allTransfers) {
      if (!seenIds.has(transfer.id)) {
        seenIds.add(transfer.id);
        uniqueTransfers.push(transfer);
      }
    }
    
    // 限制缓存大小，保留最新的记录
    let finalTransfers = uniqueTransfers;
    if (uniqueTransfers.length > maxCacheSize) {
      finalTransfers = uniqueTransfers.slice(0, maxCacheSize);
      console.log('缓存已满，保留最新', maxCacheSize, '条记录');
    }
    
    // 按ID降序排序，确保显示顺序正确（最新的在上面）
    finalTransfers.sort((a, b) => b.id - a.id);
    
    return finalTransfers;
  },

  // 检查用户是否在房间中，如果不在则自动加入
  async checkAndAutoJoinRoom(roomData) {
    try {
      const userInfo = this.data.userInfo || app.globalData.userInfo;
      if (!userInfo || !userInfo.user_id) {
        console.error('用户信息不可用');
        return false;
      }

      // 检查用户是否已经在房间中
      const playersResponse = await api.getRoomPlayers(this.data.roomId);
      if (playersResponse.code === 200) {
        let players;
        try {
          players = typeof playersResponse.data === 'string' ? JSON.parse(playersResponse.data) : playersResponse.data;
        } catch (error) {
          console.error('解析玩家数据失败:', error);
          return false;
        }

        // 检查当前用户是否在玩家列表中
        const userInRoom = players.some(player => player.user_id === userInfo.user_id);
        if (userInRoom) {
          console.log('用户已在房间中');
          return true;
        }
      }

      // 用户不在房间中，尝试自动加入
      console.log('用户不在房间中，尝试自动加入...');
      wx.showLoading({ title: '正在加入房间...' });

      try {
        const joinResponse = await api.joinRoom(userInfo.user_id, this.data.roomId);
        
        // 添加详细的响应日志
        console.log('加入房间API响应:', joinResponse);
        console.log('响应类型:', typeof joinResponse);
        console.log('响应code:', joinResponse.code, '类型:', typeof joinResponse.code);
        console.log('响应message:', joinResponse.message, '类型:', typeof joinResponse.message);
        
        if (joinResponse.code === 200) {
          console.log('自动加入房间成功');
          wx.showToast({
            title: '已加入房间',
            icon: 'success',
            duration: 1500
          });
          return true;
        } else {
          console.error('加入房间失败:', joinResponse.message);
          wx.showModal({
            title: '加入失败',
            content: joinResponse.message || '无法加入房间',
            showCancel: false,
            confirmText: '知道了',
            success: () => {
              wx.navigateBack();
            }
          });
          return false;
        }
      } catch (error) {
        console.error('加入房间API调用失败:', error);
        
        // 处理API reject的情况，检查错误信息
        const errorMessage = error.message || error.toString();
        console.log('错误信息:', errorMessage);
        
        if (errorMessage.includes('已在房间中')) {
          console.log('用户已在房间中（通过错误信息确认）');
          wx.showToast({
            title: '您已在此房间中',
            icon: 'success',
            duration: 1500
          });
          return true;
        } else if (errorMessage.includes('房间已结算')) {
          console.log('房间已结算，无法加入');
          wx.showModal({
            title: '房间已结束',
            content: '该房间已经结算，无法加入',
            showCancel: false,
            confirmText: '知道了',
            success: () => {
              wx.navigateBack();
            }
          });
          return false;
        } else {
          wx.showModal({
            title: '加入失败',
            content: errorMessage || '网络错误，请重试',
            showCancel: false,
            confirmText: '知道了',
            success: () => {
              wx.navigateBack();
            }
          });
          return false;
        }
      }
    } catch (error) {
      console.error('检查并加入房间失败:', error);
      wx.showModal({
        title: '加入失败',
        content: '网络错误，请重试',
        showCancel: false,
        confirmText: '知道了',
        success: () => {
          wx.navigateBack();
        }
      });
      return false;
    }
  },

  // 增量更新流水记录
  async updateTransfersIncremental() {
    if (!this.data.roomId || !this.data.lastTransferId) {
      return;
    }

    try {
      console.log('开始增量更新流水，lastTransferId:', this.data.lastTransferId);
      const response = await api.getRoomTransfers(this.data.roomId, this.data.lastTransferId);
      
      if (response.code === 200 && response.data) {
        let newTransfers;
        try {
          newTransfers = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        } catch (error) {
          console.error('解析增量流水数据失败:', error);
          return;
        }

        if (newTransfers && newTransfers.length > 0) {
          console.log('获取到新的流水记录:', newTransfers.length, '条');
          
          // 预处理新流水的时间格式和分数格式
          newTransfers.forEach(transfer => {
            // 处理时间格式
            if (transfer.created_at) {
              try {
                const date = new Date(transfer.created_at);
                if (!isNaN(date.getTime())) {
                  // 直接在JavaScript中格式化时间，避免WXS问题
                  transfer.formatted_time = this.formatTimestampJS(transfer.created_at);
                }
              } catch (error) {
                console.error('处理新流水时间格式失败:', error, transfer.created_at);
                transfer.formatted_time = '';
              }
            } else {
              transfer.formatted_time = '';
            }
            
            // 处理分数格式
            transfer.formatted_amount = this.formatTransferAmount(transfer, this.data.currentUserId);
          });
          
          // 使用缓存管理函数合并和限制记录
          const currentTransfers = this.data.transfers || [];
          const updatedTransfers = this.mergeAndLimitTransfers(currentTransfers, newTransfers);
          
          // 更新lastTransferId
          const newLastTransferId = updatedTransfers.length > 0 
            ? Math.max(...updatedTransfers.map(t => t.id))
            : this.data.lastTransferId;
          
          this.setData({
            transfers: updatedTransfers,
            lastTransferId: newLastTransferId,
          });
          
          console.log('流水记录已更新，总数:', updatedTransfers.length);
        }
      }
    } catch (error) {
      console.error('增量更新流水失败:', error);
    }
  },

  // 快速转移
  async quickTransfer(e) {
    console.log('quickTransfer 被调用', e);
    const player = e.currentTarget.dataset.player;
    console.log('点击的玩家信息:', player);
    const { currentUserId } = this.data;
    console.log('当前用户ID:', currentUserId);

    // 检查房间状态，如果已结算则不允许转移
    if (this.data.roomInfo.status === 2) {
      wx.showToast({
        title: '房间已结算，无法转移分数',
        icon: 'none'
      });
      return;
    }

    if (player.user_id === currentUserId) {
      // 点击自己的头像，显示个人信息浮窗
      this.showProfileModal();
      return;
    }

    // 点击他人头像，设置选中状态并显示转移分数浮窗
    this.setData({
      selectedPlayerId: player.user_id
    });
    
    try {
      const amount = await this.showTransferInput(player.user.nickname, player.current_score);
      if (!amount || amount <= 0) {
        // 取消转移时清除选中状态
        this.setData({ selectedPlayerId: null });
        return;
      }

      const response = await api.transferScore(
        this.data.roomId,
        currentUserId,
        player.user_id,
        amount
      );

      if (response.code === 200) {
        wx.showToast({
          title: '转移成功',
          icon: 'success'
        });
        // 转移成功后清除选中状态
        this.setData({ selectedPlayerId: null });
        this.loadRoomData(); // 重新加载数据
      } else {
        wx.showToast({
          title: response.message || '转移失败',
          icon: 'none'
        });
        // 转移失败时清除选中状态
        this.setData({ selectedPlayerId: null });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('转移分数失败:', error);
      wx.showToast({
        title: '转移失败',
        icon: 'none'
      });
      // 出错时清除选中状态
      this.setData({ selectedPlayerId: null });
    }
  },

  // 显示转移输入框
  showTransferInput(playerName, currentScore) {
    return new Promise((resolve) => {
      wx.showModal({
        title: `转给:${playerName}`,
        content: '',
        editable: true,
        placeholderText: '1',
        success: (res) => {
          if (res.confirm) {
            // 如果用户直接点击确认而没有输入内容，使用默认值1
            const inputValue = res.content || '1';
            const amount = parseInt(inputValue);
            if (isNaN(amount) || amount <= 0) {
              wx.showToast({
                title: '请输入有效的分数',
                icon: 'none'
              });
              resolve(null);
            } else {
              resolve(amount);
            }
          } else {
            resolve(null);
          }
        },
        fail: () => {
          resolve(null);
        },
      });
    });
  },


  // 跳转到详细转移页面
  goToTransfer() {
    wx.navigateTo({
      url: `/pages/transfer/transfer?roomId=${this.data.roomId}`,
    });
  },

  // 结算房间或查看结算信息
  async settleRoom() {
    // 检查房间状态
    if (this.data.roomInfo.status === 2) {
      // 房间已结算，显示结算信息
      this.showSettlementInfo();
      return;
    }

    // 房间未结算，执行结算操作
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认结算',
        content: '确定要结算房间吗？结算后房间将结束，无法再进行分数转移。',
        success: (res) => {
          resolve(res.confirm);
        },
        fail: () => {
          resolve(false);
        }
      });
    });
    
    if (!confirmed) return;

    try {
      wx.showLoading({ title: '结算中...' });
      const response = await api.settleRoom(this.data.roomId, this.data.currentUserId);
      wx.hideLoading();

      if (response.code === 200) {
        // 解析结算数据
        let settlementData = null;
        try {
          settlementData = response.data ? JSON.parse(response.data) : null;
        } catch (error) {
          console.error('解析结算数据失败:', error);
          settlementData = null;
        }
        console.log('结算数据:', settlementData);
        
        // 处理结算数据，添加用户昵称
        const processedSettlementData = await this.processSettlementData(settlementData);
        
        // 显示结算浮窗
        this.setData({
          showSettlementModal: true,
          settlementData: processedSettlementData
        });
        
        this.loadRoomData(); // 重新加载数据
      } else {
        wx.showToast({
          title: response.message || '结算失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('结算房间失败:', error);
      wx.showToast({
        title: '结算失败',
        icon: 'none'
      });
    }
  },

  // 显示结算信息
  async showSettlementInfo() {
    try {
      wx.showLoading({ title: '加载结算信息...' });
      
      // 获取房间详情（包含结算信息）
      const response = await api.getRoomDetail(this.data.roomId, this.data.currentUserId);
      wx.hideLoading();
      
      if (response.code === 200) {
        const detail = JSON.parse(response.data);
        const { settlements } = detail;
        
        if (settlements && settlements.length > 0) {
          // 处理结算数据，添加用户昵称
          const processedSettlementData = await this.processSettlementData(settlements);
          
          // 显示结算浮窗
          this.setData({
            showSettlementModal: true,
            settlementData: processedSettlementData
          });
        } else {
          wx.showToast({
            title: '暂无结算信息',
            icon: 'none'
          });
        }
      } else {
        wx.showToast({
          title: response.message || '获取结算信息失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('获取结算信息失败:', error);
      wx.showToast({
        title: '获取结算信息失败',
        icon: 'none'
      });
    }
  },


  // 分享房间
  shareRoom() {
    // 显示分享模态框
    this.setData({ showShareModal: true });
    
    // 在后台异步生成二维码，不阻塞分享功能
    this.generateQRCode();
  },

  // 隐藏分享模态框
  hideShareModal() {
    this.setData({ showShareModal: false });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 分享给微信好友（已移除，使用open-type="share"直接分享）

  // 复制房间号
  copyRoomCode() {
    const roomId = this.data.roomInfo.id;
    if (roomId) {
      wx.setClipboardData({
        data: roomId.toString(),
        success: () => {
          wx.showToast({
            title: '房间号已复制',
            icon: 'success'
          });
          this.hideShareModal();
        }
      });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadRoomData();
    wx.stopPullDownRefresh();
  },

  // 分享给好友
  onShareAppMessage(res) {
    console.log('分享事件触发:', res);
    
    // 检查分享来源
    if (res.from === 'button' && res.target && res.target.dataset && res.target.dataset.roomId) {
      // 从分享按钮触发，直接进入房间
      const roomId = res.target.dataset.roomId;
      console.log('从分享按钮分享，房间ID:', roomId);
      
      const sharePath = version.generateSharePath('/pages/room/room', { roomId });
      
      return {
        title: `记分助手 (${version.getVersionDisplayName()})`,
        path: sharePath
      };
    } else {
      // 从右上角菜单分享，进入加入房间页面
      console.log('从右上角菜单分享');
      
      const sharePath = version.generateSharePath('/pages/room/room', { roomId: this.data.roomInfo.id });
      
      return {
        title: `记分助手 (${version.getVersionDisplayName()})`,
        path: sharePath
      };
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    console.log('分享到朋友圈');
    
    const sharePath = version.generateSharePath('/pages/room/room', { roomId: this.data.roomInfo.id });
    
    return {
      title: `记分助手 (${version.getVersionDisplayName()})`,
      path: sharePath
    };
  },

  // 生成二维码
  async generateQRCode() {
    if (this.data.qrCodeLoading) {
      return;
    }

    this.setData({ qrCodeLoading: true });

    try {
      // 获取当前小程序版本信息
      const accountInfo = wx.getAccountInfoSync();
      const envVersion = accountInfo.miniProgram.envVersion;
      
      const response = await api.generateQRCode(this.data.roomId, envVersion);

      if (response.code === 200) {
        const qrData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        this.setData({
          qrCodeData: qrData.qr_code
        });
        wx.showToast({
          title: '二维码生成成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: response.message || '生成失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ qrCodeLoading: false });
    }
  },

  // 解析scene参数
  parseSceneParams(scene) {
    console.log('parseSceneParams开始解析:', scene);
    const params = {};
    if (scene) {
      // 首先对整个scene字符串进行URL解码
      const decodedScene = decodeURIComponent(scene);
      console.log('URL解码后的scene:', decodedScene);
      
      const pairs = decodedScene.split('&');
      console.log('分割后的键值对数组:', pairs);
      
      for (const pair of pairs) {
        console.log('处理键值对:', pair);
        const decodedValue = decodeURIComponent(value);
        console.log('处理键值对111:', pair);
        const [key, value] = decodedValue.split('=');
        console.log('分割结果 - key:', key, 'value:', value);
        
        if (key && value) {
          // 对值进行额外的URL解码（防止双重编码）
          const decodedValue = decodeURIComponent(value);
          params[key] = decodedValue;
          console.log('设置参数:', key, '=', decodedValue);
        } else {
          console.log('跳过无效键值对:', pair);
        }
      }
    }
    console.log('最终解析结果:', params);
    return params;
  },

  // 格式化转移金额显示
  formatTransferAmount(transfer, currentUserId) {
    if (transfer.amount === null || transfer.amount === undefined) {
      return '0';
    }
    
    const num = parseInt(transfer.amount);
    if (isNaN(num)) {
      return '0';
    }
    
    // 判断转移类型
    const isFromCurrentUser = transfer.from_user_id === currentUserId;
    const isToCurrentUser = transfer.to_user_id === currentUserId;
    
    if (isFromCurrentUser) {
      // 当前用户转出分数，显示负数
      return num > 0 ? `-${num}` : num.toString();
    } else if (isToCurrentUser) {
      // 当前用户被转移分数，显示正数
      return num > 0 ? `+${num}` : num.toString();
    } else {
      // 与当前用户无关的转移，只显示数字，不显示符号
      return Math.abs(num).toString();
    }
  },

  // 排序玩家：当前用户始终在第一个位置
  sortPlayers(players, currentUserId) {
    if (!players || players.length === 0) {
      console.log('sortPlayers: 没有玩家数据');
      return [];
    }
    
    console.log('sortPlayers: 开始排序，当前用户ID:', currentUserId);
    console.log('sortPlayers: 玩家列表:', players);
    
    const currentUser = players.find(player => player.user_id === currentUserId);
    const otherPlayers = players.filter(player => player.user_id !== currentUserId);
    
    console.log('sortPlayers: 当前用户:', currentUser);
    console.log('sortPlayers: 其他用户:', otherPlayers);
    
    // 当前用户排在第一位，其他用户按原顺序排列
    const sortedPlayers = currentUser ? [currentUser, ...otherPlayers] : players;
    
    // 处理昵称显示：限制为前6个字，2个英文字母算1个字
    const processedPlayers = sortedPlayers.map(player => {
      if (player.user && player.user.nickname) {
        const nickname = player.user.nickname;
        player.user.displayName = this.truncateNickname(nickname, 6);
      } else {
        // 如果用户信息不存在或没有昵称，设置默认显示名称
        if (!player.user) {
          player.user = {};
        }
        player.user.displayName = `用户${player.user_id}`;
        player.user.nickname = `用户${player.user_id}`;
      }
      return player;
    });
    
    console.log('sortPlayers: 排序后的玩家列表:', processedPlayers);
    
    return processedPlayers;
  },

  // 截断昵称：2个英文字母算1个字
  truncateNickname(nickname, maxLength) {
    if (!nickname) return '';
    
    let charCount = 0;
    let result = '';
    
    for (let i = 0; i < nickname.length; i++) {
      const char = nickname[i];
      
      // 判断是否为英文字母
      if (/[a-zA-Z]/.test(char)) {
        charCount += 0.5; // 2个英文字母算1个字
      } else {
        charCount += 1; // 中文字符和其他字符算1个字
      }
      
      result += char;
      
      // 如果达到最大长度，截断并添加省略号
      if (charCount >= maxLength) {
        if (i < nickname.length - 1) {
          result += '...';
        }
        break;
      }
    }
    
    console.log(`昵称截断: "${nickname}" -> "${result}" (字符数: ${charCount})`);
    return result;
  },

  // 处理结算数据，添加用户昵称
  async processSettlementData(settlementData) {
    const processedData = [];
    
    // 检查结算数据是否为空
    if (!settlementData || !Array.isArray(settlementData) || settlementData.length === 0) {
      console.log('结算数据为空，返回空数组');
      return processedData;
    }
    
    for (const settlement of settlementData) {
      // 获取用户昵称
      const fromUserName = await this.getUserNameById(settlement.from_user_id);
      const toUserName = await this.getUserNameById(settlement.to_user_id);
      
      processedData.push({
        fromUserId: settlement.from_user_id,
        toUserId: settlement.to_user_id,
        fromUserName: fromUserName,
        toUserName: toUserName,
        amount: settlement.amount
      });
    }
    
    return processedData;
  },

  // 根据用户ID获取用户昵称
  async getUserNameById(userId) {
    try {
      // 先从当前玩家列表中查找
      const player = this.data.players.find(p => p.user_id === userId);
      if (player && player.user && player.user.nickname) {
        return player.user.nickname;
      }
      
      // 如果没找到，调用API获取
      const response = await api.getUserInfo(userId);
      if (response.code === 200) {
        const userInfo = JSON.parse(response.data);
        return userInfo.nickname || '未知用户';
      }
      
      return '未知用户';
    } catch (error) {
      console.error('获取用户昵称失败:', error);
      return '未知用户';
    }
  },

  // 隐藏结算浮窗
  hideSettlementModal() {
    this.setData({
      showSettlementModal: false,
      settlementData: []
    });
  },

  // 显示个人信息浮窗
  async showProfileModal() {
    try {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}
      console.log('本地用户信息:', userInfo)
      
      // 从后端获取完整的用户信息（包含openid）
      if (userInfo.user_id) {
        wx.showLoading({ title: '加载中...' })
        const response = await api.getUser(userInfo.user_id)
        wx.hideLoading()
        
        if (response.code === 200) {
          const fullUserInfo = JSON.parse(response.data)
          console.log('从后端获取的完整用户信息:', fullUserInfo)
          
          // 更新本地存储的用户信息
          const updatedUserInfo = {
            ...userInfo,
            ...fullUserInfo,
            openid: fullUserInfo.openid || fullUserInfo.Openid
          }
          app.globalData.userInfo = updatedUserInfo
          wx.setStorageSync('userInfo', updatedUserInfo)
          
          this.setData({
            showProfileModal: true,
            profileForm: {
              nickname: fullUserInfo.nickname || '微信用户',
              avatarUrl: fullUserInfo.avatar_url || ''
            }
          })
          return
        }
      }
      
      // 如果无法从后端获取，使用本地信息
      this.setData({
        showProfileModal: true,
        profileForm: {
          nickname: userInfo.nickName || userInfo.nickname || '微信用户',
          avatarUrl: userInfo.avatarUrl || ''
        }
      })
      console.log('使用本地用户信息显示浮窗:', userInfo)
    } catch (error) {
      wx.hideLoading()
      console.error('获取用户信息失败:', error)
      
      // 出错时使用本地信息
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}
      this.setData({
        showProfileModal: true,
        profileForm: {
          nickname: userInfo.nickName || userInfo.nickname || '微信用户',
          avatarUrl: userInfo.avatarUrl || ''
        }
      })
    }
  },

  // 检查是否应该显示头像蒙层提示
  shouldShowAvatarOverlay(userInfo) {
    // 如果用户已经主动关闭过蒙层，不再显示
    if (this.data.avatarOverlayDismissed) {
      return false;
    }
    
    if (!userInfo || !userInfo.nickname) {
      return true; // 没有昵称信息时显示提示
    }
    
    // 如果昵称仍然是默认的"微信用户"，显示提示
    return userInfo.nickname === '微信用户';
  },

  // 关闭头像蒙层提示并打开用户信息修改浮窗
  closeAvatarOverlay() {
    this.setData({ 
      showAvatarOverlay: false,
      avatarOverlayDismissed: true // 标记蒙层已被用户主动关闭
    });
    // 立即打开用户信息修改浮窗
    this.showProfileModal();
  },

  // 隐藏个人信息浮窗
  hideProfileModal() {
    this.setData({ showProfileModal: false })
  },

  // 选择头像
  async onProfileChooseAvatar(e) {
    console.log('头像选择事件触发:', e)
    console.log('事件详情:', e.detail)
    
    // 先显示一个简单的提示，确认事件被触发
    wx.showToast({
      title: '头像选择事件已触发',
      icon: 'none'
    })
    
    const { avatarUrl } = e.detail
    console.log('获取到的头像URL:', avatarUrl)
    if (avatarUrl) {
      try {
        wx.showLoading({ title: '上传头像中...' })
        
        // 引入COS上传工具
        const cosUploader = require('../../utils/cos.js')
        
        // 获取当前用户信息
        const globalUserInfo = app.globalData.userInfo
        const storageUserInfo = wx.getStorageSync('userInfo')
        const userInfo = globalUserInfo || storageUserInfo
        
        console.log('全局用户信息:', globalUserInfo)
        console.log('存储用户信息:', storageUserInfo)
        console.log('最终用户信息:', userInfo)
        
        if (!userInfo) {
          wx.hideLoading()
          wx.showToast({
            title: '用户信息为空，请重新登录',
            icon: 'none'
          })
          return
        }
        
        // 获取openid，兼容不同的字段名
        const openid = userInfo.openid || userInfo.Openid
        console.log('用户openid:', openid)
        
        if (!openid) {
          wx.hideLoading()
          wx.showToast({
            title: '用户openid缺失，请重新登录',
            icon: 'none'
          })
          return
        }
        
        // 先测试COS存储桶访问权限
        console.log('测试COS存储桶访问权限...')
        const testResult = await cosUploader.testBucketAccess()
        console.log('COS访问权限测试结果:', testResult)
        
        // 上传头像到COS，使用openid作为文件名
        const uploadResult = await cosUploader.uploadAvatar(avatarUrl, openid)
        
        wx.hideLoading()
        
        if (uploadResult.success) {
          // 上传成功，使用COS的URL
          this.setData({
            'profileForm.avatarUrl': uploadResult.url
          })
          console.log('头像上传到COS成功:', uploadResult.url)
          wx.showToast({
            title: '头像上传成功',
            icon: 'success'
          })
        } else {
          // 上传失败，使用临时URL作为备选
          this.setData({
            'profileForm.avatarUrl': avatarUrl
          })
          console.log('COS上传失败，使用临时URL:', avatarUrl)
          wx.showToast({
            title: '头像选择成功（临时）',
            icon: 'success'
          })
        }
      } catch (error) {
        wx.hideLoading()
        console.error('头像上传失败:', error)
        // 上传失败时使用临时URL
        this.setData({
          'profileForm.avatarUrl': avatarUrl
        })
        wx.showToast({
          title: '头像选择成功（临时）',
          icon: 'success'
        })
      }
    } else {
      console.log('用户取消选择头像')
    }
  },

  // 昵称输入
  onProfileNicknameInput(e) {
    this.setData({
      'profileForm.nickname': e.detail.value
    })
  },

  // 昵称失焦
  onProfileNicknameBlur(e) {
    this.setData({
      'profileForm.nickname': e.detail.value
    })
  },

  // 保存个人信息
  async saveProfileInfo() {
    const { nickname, avatarUrl } = this.data.profileForm
    if (!nickname || nickname.trim() === '') {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })
      
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      if (!userInfo || !userInfo.user_id) {
        wx.hideLoading()
        wx.showToast({
          title: '用户信息无效',
          icon: 'none'
        })
        return
      }

      const response = await api.updateUserProfile(userInfo.user_id, {
        nickname: nickname.trim(),
        avatar_url: avatarUrl
      })

      wx.hideLoading()

      if (response.code === 200) {
        // 更新本地用户信息
        const updatedUserInfo = {
          ...userInfo,
          nickName: nickname.trim(),
          nickname: nickname.trim(),
          avatarUrl: avatarUrl,
          avatar_url: avatarUrl
        }
        
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        
        // 关闭头像蒙层提示（因为用户已经修改了昵称）
        this.setData({
          showAvatarOverlay: false,
          avatarOverlayDismissed: true // 标记蒙层已被用户主动关闭
        });
        
        this.hideProfileModal()
        this.loadRoomData() // 重新加载房间数据以更新显示
      } else {
        wx.showToast({
          title: response.message || '保存失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('保存个人信息失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 头像加载失败处理
  onAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    console.log('头像加载失败，索引:', index);
    
    // 更新对应玩家的头像错误状态
    const sortedPlayers = this.data.sortedPlayers;
    if (sortedPlayers && sortedPlayers[index]) {
      sortedPlayers[index].avatarError = true;
      this.setData({
        sortedPlayers: sortedPlayers
      });
    }
  },

  // 返回主页
  goToHome() {
    // 清除当前房间信息（用户主动返回主页）
    wx.removeStorageSync('current_room_info');
    console.log('用户主动返回主页，清除房间信息');
    
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },

  // 触摸手势识别 - 左滑返回
  touchStartX: 0,
  touchStartY: 0,
  touchStartTime: 0,
  isSwipeGesture: false,

  onTouchStart(e) {
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
    this.isSwipeGesture = false;
  },

  onTouchMove(e) {
    const touch = e.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    
    // 实时检测是否为水平滑动
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
      this.isSwipeGesture = true;
    }
  },

  onTouchEnd(e) {
    const touch = e.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;
    const touchEndTime = Date.now();
    
    // 计算滑动距离和时间
    const deltaX = touchEndX - this.touchStartX;
    const deltaY = touchEndY - this.touchStartY;
    const deltaTime = touchEndTime - this.touchStartTime;
    
    // 判断是否为有效的左滑手势
    // 条件：1. 是水平滑动 2. 向左滑动距离大于80px 3. 滑动时间小于800ms 4. 垂直滑动距离小于100px
    const isHorizontalSwipe = this.isSwipeGesture && Math.abs(deltaX) > Math.abs(deltaY);
    const isLeftSwipe = deltaX < -80;
    const isQuickSwipe = deltaTime < 800;
    const isNotVerticalScroll = Math.abs(deltaY) < 100;
    
    if (isHorizontalSwipe && isLeftSwipe && isQuickSwipe && isNotVerticalScroll) {
      console.log('检测到左滑手势，返回上一页', {
        deltaX, deltaY, deltaTime, 
        isHorizontalSwipe, isLeftSwipe, isQuickSwipe, isNotVerticalScroll
      });
      this.handleSwipeBack();
    }
  },

  // 处理左滑返回
  handleSwipeBack() {
    // 显示一个简单的提示
    wx.showToast({
      title: '返回上一页',
      icon: 'none',
      duration: 500
    });
    
    // 延迟执行返回，让用户看到提示
    setTimeout(() => {
      // 获取当前页面栈
      const pages = getCurrentPages();
      console.log('当前页面栈长度:', pages.length);
      
      // 检查是否有上一页
      if (pages.length > 1) {
        // 获取上一页的路径
        const prevPage = pages[pages.length - 2];
        console.log('上一页路径:', prevPage.route);
        
        // 使用navigateBack返回上一页
        wx.navigateBack({
          delta: 1,
          success: () => {
            console.log('成功返回上一页');
          },
          fail: (error) => {
            console.error('返回上一页失败:', error);
            // 如果返回失败，则返回首页
            wx.removeStorageSync('current_room_info');
            console.log('返回失败，清除房间信息并返回首页');
            wx.redirectTo({
              url: '/pages/index/index'
            });
          }
        });
      } else {
        // 如果没有上一页，返回首页
        console.log('没有上一页，返回首页');
        wx.removeStorageSync('current_room_info');
        console.log('没有上一页，清除房间信息并返回首页');
        wx.redirectTo({
          url: '/pages/index/index'
        });
      }
    }, 300);
  },

  // 设置WebSocket事件监听
  setupWebSocketListeners() {
    // 监听玩家加入事件
    wsManager.onMessage('player_joined', (data) => {
      console.log('收到玩家加入事件:', data);
      this.handlePlayerJoined(data);
    });

    // 监听玩家离开事件
    wsManager.onMessage('player_left', (data) => {
      console.log('收到玩家离开事件:', data);
      this.handlePlayerLeft(data);
    });

    // 监听分数转移事件
    wsManager.onMessage('score_transfer', (data) => {
      console.log('收到分数转移事件:', data);
      this.handleScoreTransfer(data);
    });

    // 监听房间结算事件
    wsManager.onMessage('room_settled', (data) => {
      console.log('收到房间结算事件:', data);
      this.handleRoomSettled(data);
    });

    // 监听玩家信息更新事件
    wsManager.onMessage('player_updated', (data) => {
      console.log('收到玩家信息更新事件:', data);
      this.handlePlayerUpdated(data);
    });

    // 监听房间信息更新事件
    wsManager.onMessage('room_updated', (data) => {
      console.log('收到房间信息更新事件:', data);
      this.handleRoomUpdated(data);
    });

    // 监听连接状态变化
    wsManager.on('connected', () => {
      console.log('WebSocket连接已建立');
      // 移除连接成功的弹窗提示，避免打扰用户
    });

    wsManager.on('disconnected', () => {
      console.log('WebSocket连接已断开');
      // 移除断开连接的弹窗提示，避免打扰用户
    });

    wsManager.on('error', (error) => {
      console.error('WebSocket连接错误:', error);
      // 连接错误时显示友好的错误提示
      this.handleWebSocketError(error);
    });
  },

  // 连接WebSocket
  async connectWebSocket() {
    if (!this.data.roomId || !this.data.currentUserId) {
      console.log('房间ID或用户ID不存在，无法连接WebSocket');
      return;
    }

    try {
      await wsManager.connect(this.data.roomId, this.data.currentUserId);
      console.log('WebSocket连接成功');
    } catch (error) {
      console.error('WebSocket连接失败:', error);
      // 连接失败时显示友好的错误提示
      this.handleWebSocketError(error);
    }
  },

  // 断开WebSocket连接
  disconnectWebSocket() {
    wsManager.disconnect();
    console.log('WebSocket连接已断开');
  },

  // 处理WebSocket连接错误
  handleWebSocketError(error) {
    console.error('WebSocket连接失败，显示错误提示:', error);
    
    wx.showModal({
      title: '进入房间失败',
      content: '无法连接到房间，请重新进入小程序',
      showCancel: false,
      confirmText: '重新进入',
      success: (res) => {
        if (res.confirm) {
          // 用户点击确认，重启小程序并进入房间
          this.restartAppAndEnterRoom();
        }
      }
    });
  },

  // 重启小程序并进入房间
  restartAppAndEnterRoom() {
    try {
      // 保存当前房间信息到本地存储
      const roomInfo = {
        roomId: this.data.roomId,
        roomCode: this.data.roomCode,
        currentUserId: this.data.currentUserId
      };
      
      wx.setStorageSync('restart_room_info', roomInfo);
      
      // 重启小程序
      wx.reLaunch({
        url: '/pages/index/index'
      });
    } catch (error) {
      console.error('重启小程序失败:', error);
      // 如果重启失败，直接跳转到首页
      wx.reLaunch({
        url: '/pages/index/index'
      });
    }
  },

  // 处理玩家加入事件
  handlePlayerJoined(data) {
    // 重新加载房间数据以获取最新的玩家列表
    this.loadRoomData();
    
    // 显示欢迎消息
    if (data.player && data.player.nickname) {
      wx.showToast({
        title: `${data.player.nickname} 加入了房间`,
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 处理玩家离开事件
  handlePlayerLeft(data) {
    // 重新加载房间数据
    this.loadRoomData();
    
    // 显示离开消息
    if (data.player && data.player.nickname) {
      wx.showToast({
        title: `${data.player.nickname} 离开了房间`,
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 处理分数转移事件
  handleScoreTransfer(data) {
    // 使用增量更新获取新的流水记录
    this.updateTransfersIncremental();
    
    // 重新加载玩家数据以获取最新分数
    this.loadRoomData();
    
    // 显示转移消息
    if (data.transfer) {
      const { from_user_name, to_user_name, amount } = data.transfer;
      wx.showToast({
        title: `${from_user_name} 向 ${to_user_name} 转移了 ${amount} 分`,
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 处理房间结算事件
  handleRoomSettled(data) {
    // 重新加载房间数据
    this.loadRoomData();
    
    // 显示结算消息
    wx.showToast({
      title: '房间已结算',
      icon: 'success',
      duration: 2000
    });
  },

  // 处理玩家信息更新事件
  handlePlayerUpdated(data) {
    // 重新加载房间数据
    this.loadRoomData();
  },

  // 处理房间信息更新事件
  handleRoomUpdated(data) {
    // 重新加载房间数据
    this.loadRoomData();
  }
});
