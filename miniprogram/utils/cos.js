// 腾讯云COS上传工具类
const COS = require('../lib/cos-wx-sdk-v5.js')

// COS配置信息
const COS_CONFIG = {
  Bucket: 'avatar-1251760642',
  Region: 'ap-guangzhou',
  // 注意：这里需要从后端获取临时密钥，不能在前端硬编码
  // 实际使用时应该通过API获取临时密钥
}

class COSUploader {
  constructor() {
    this.cos = null
    this.isInitialized = false
  }

  // 初始化COS实例（需要临时密钥）
  async init() {
    if (this.isInitialized) {
      return this.cos
    }

    try {
      // 从后端获取临时密钥
      const tempCredentials = await this.getTempCredentials()
      
      this.cos = new COS({
        SecretId: tempCredentials.tmpSecretId,
        SecretKey: tempCredentials.tmpSecretKey,
        SecurityToken: tempCredentials.sessionToken,
        StartTime: tempCredentials.startTime,
        ExpiredTime: tempCredentials.expiredTime,
        SimpleUploadMethod: 'putObject'
      })
      
      this.isInitialized = true
      console.log('COS初始化成功')
      return this.cos
    } catch (error) {
      console.error('COS初始化失败:', error)
      throw error
    }
  }

  // 从后端获取临时密钥
  async getTempCredentials() {
    try {
      const response = await wx.request({
        url: 'https://www.aipaint.cloud/api/v1/cos/credentials',
        method: 'GET',
        header: {
          'Content-Type': 'application/json'
        }
      })

      if (response.data && response.data.code === 200) {
        return response.data.data
      } else {
        throw new Error('获取临时密钥失败')
      }
    } catch (error) {
      console.error('获取临时密钥失败:', error)
      throw error
    }
  }

  // 上传头像到COS
  async uploadAvatar(filePath, userId) {
    try {
      // 确保COS已初始化
      await this.init()

      // 生成唯一的文件名
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const fileName = `avatars/${userId}_${timestamp}_${randomStr}.jpg`

      console.log('开始上传头像到COS:', fileName)

      // 上传文件
      const result = await new Promise((resolve, reject) => {
        this.cos.uploadFile({
          Bucket: COS_CONFIG.Bucket,
          Region: COS_CONFIG.Region,
          Key: fileName,
          FilePath: filePath,
          SliceSize: 1024 * 1024 * 2, // 2MB以下使用简单上传
          onProgress: function(progressData) {
            console.log('上传进度:', JSON.stringify(progressData))
          }
        }, function(err, data) {
          if (err) {
            console.error('COS上传失败:', err)
            reject(err)
          } else {
            console.log('COS上传成功:', data)
            resolve(data)
          }
        })
      })

      // 构建访问URL
      const avatarUrl = `https://${COS_CONFIG.Bucket}.cos.${COS_CONFIG.Region}.myqcloud.com/${fileName}`
      
      console.log('头像上传完成，URL:', avatarUrl)
      return {
        success: true,
        url: avatarUrl,
        key: fileName
      }

    } catch (error) {
      console.error('上传头像失败:', error)
      return {
        success: false,
        error: error.message || '上传失败'
      }
    }
  }

  // 删除COS中的头像文件
  async deleteAvatar(fileKey) {
    try {
      await this.init()

      const result = await new Promise((resolve, reject) => {
        this.cos.deleteObject({
          Bucket: COS_CONFIG.Bucket,
          Region: COS_CONFIG.Region,
          Key: fileKey
        }, function(err, data) {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      })

      console.log('删除头像成功:', fileKey)
      return { success: true }
    } catch (error) {
      console.error('删除头像失败:', error)
      return { success: false, error: error.message }
    }
  }
}

// 创建单例实例
const cosUploader = new COSUploader()

module.exports = cosUploader
