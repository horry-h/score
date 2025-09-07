// room.js
const api = require('../../utils/api');
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
    loading: false,
    qrCodeData: null,
    qrCodeLoading: false,
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
  },

  onShow() {
    if (this.data.roomId) {
      this.loadRoomData();
    }
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

      this.setData({ 
        currentUserId: userInfo.user_id,
        userInfo: userInfo,
        loading: true 
      });

      wx.showLoading({ title: '加载中...' });
      
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
          wx.hideLoading();
          wx.showToast({
            title: '房间数据解析失败',
            icon: 'none'
          });
          return;
        }
        
        this.setData({
          roomInfo: roomData,
        });
        
        // 如果使用roomCode进入，需要获取roomId用于后续API调用
        if (this.data.roomCode && !this.data.roomId) {
          this.setData({ roomId: roomData.id });
          console.log('从roomCode获取到roomId:', roomData.id);
        }
        
        // 现在加载玩家信息和转移记录
        const [playersResponse, transfersResponse] = await Promise.all([
          api.getRoomPlayers(this.data.roomId),
          api.getRoomTransfers(this.data.roomId),
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
          let transfersData;
          try {
            transfersData = typeof transfersResponse.data === 'string' ? JSON.parse(transfersResponse.data) : transfersResponse.data;
            console.log('解析后的转移记录数据:', transfersData);
          } catch (error) {
            console.error('解析转移记录数据失败:', error);
            transfersData = [];
          }
          this.setData({
            transfers: transfersData,
          });
        }
      } else {
        wx.hideLoading();
        wx.showToast({
          title: roomResponse.message || '加载房间信息失败',
          icon: 'none'
        });
        return;
      }

      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('加载房间数据失败:', error);
      wx.showToast({
        title: '加载房间数据失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 快速转移
  async quickTransfer(e) {
    const player = e.currentTarget.dataset.player;
    const { currentUserId } = this.data;

    if (player.user_id === currentUserId) {
      // 点击自己的头像，显示个人信息浮窗
      this.showProfileModal();
      return;
    }

    // 点击他人头像，显示转移分数浮窗
    try {
      const amount = await this.showTransferInput(player.user.nickname, player.current_score);
      if (!amount || amount <= 0) return;

      wx.showLoading({ title: '转移中...' });
      const response = await api.transferScore(
        this.data.roomId,
        currentUserId,
        player.user_id,
        amount
      );
      wx.hideLoading();

      if (response.code === 200) {
        wx.showToast({
          title: '转移成功',
          icon: 'success'
        });
        this.loadRoomData(); // 重新加载数据
      } else {
        wx.showToast({
          title: response.message || '转移失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('转移分数失败:', error);
      wx.showToast({
        title: '转移失败',
        icon: 'none'
      });
    }
  },

  // 显示转移输入框
  showTransferInput(playerName, currentScore) {
    return new Promise((resolve) => {
      wx.showModal({
        title: '转移分数',
        content: '',
        editable: true,
        placeholderText: '50',
        success: (res) => {
          if (res.confirm && res.content) {
            const amount = parseInt(res.content);
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

  // 结算房间
  async settleRoom() {
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
        wx.showToast({
          title: '结算成功',
          icon: 'success'
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
      
      return {
        title: '麻将记分',
        path: `/pages/room/room?roomId=${roomId}`
      };
    } else {
      // 从右上角菜单分享，进入加入房间页面
      console.log('从右上角菜单分享');
      
      return {
        title: '麻将记分',
        path: `/pages/join-room/join-room?roomId=${this.data.roomInfo.id}`
      };
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    console.log('分享到朋友圈');
    
    return {
      title: '麻将记分',
      path: `/pages/join-room/join-room?roomId=${this.data.roomInfo.id}`
    };
  },

  // 生成二维码
  async generateQRCode() {
    if (this.data.qrCodeLoading) {
      return;
    }

    this.setData({ qrCodeLoading: true });

    try {
      const response = await api.generateQRCode(this.data.roomId);

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
    wx.redirectTo({
      url: '/pages/index/index'
    });
  },
});
