// settlement.js
const apiService = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError, formatScore } = require('../../utils/util');

Page({
  data: {
    roomId: null,
    players: [],
    settlements: [],
  },

  onLoad(options) {
    const { roomId } = this.data;
    if (roomId) {
      this.setData({ roomId: parseInt(roomId) });
      this.loadSettlementData();
    }
  },

  // 加载结算数据
  async loadSettlementData() {
    try {
      showLoading('加载中...');
      
      const [playersResponse, settlementsResponse] = await Promise.all([
        apiService.getRoomPlayers(this.data.roomId),
        apiService.getRoomSettlements(this.data.roomId),
      ]);

      hideLoading();

      if (playersResponse.code === 200) {
        this.setData({
          players: JSON.parse(playersResponse.data),
        });
      }

      if (settlementsResponse.code === 200) {
        this.setData({
          settlements: JSON.parse(settlementsResponse.data),
        });
      }
    } catch (error) {
      hideLoading();
      console.error('加载结算数据失败:', error);
      showError('加载结算数据失败');
    }
  },

  // 确认结算
  async confirmSettlement() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        showError('请先登录');
        return;
      }

      showLoading('结算中...');
      const response = await apiService.settleRoom(this.data.roomId, userInfo.id);
      hideLoading();

      if (response.code === 200) {
        showSuccess('结算成功');
        
        // 返回主页
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index',
          });
        }, 1500);
      } else {
        showError(response.message || '结算失败');
      }
    } catch (error) {
      hideLoading();
      console.error('结算失败:', error);
      showError('结算失败');
    }
  },
});
