// 腾讯云COS上传工具类
const COS = require('../lib/cos-wx-sdk-v5.js')

// COS配置信息
const COS_CONFIG = {
  Bucket: 'avatar-1251760642',
  Region: 'ap-guangzhou',
  // 永久密钥配置
  SecretId: 'AKIDiV6Zrww476xcCUPL8kAMWY1NXURHwPfl',
  SecretKey: 'ykKgtJoIbhdXHqCMJ3bx62wieVAfx2vc'
}

class COSUploader {
  constructor() {
    this.cos = null
    this.isInitialized = false
  }

  // 初始化COS实例（使用永久密钥）
  init() {
    if (this.isInitialized) {
      return this.cos
    }

    try {
      this.cos = new COS({
        SecretId: COS_CONFIG.SecretId,
        SecretKey: COS_CONFIG.SecretKey,
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

  // 上传头像到COS
  async uploadAvatar(filePath, openid) {
    try {
      // 确保COS已初始化
      this.init()

      // 使用openid作为文件名，确保唯一性
      const fileName = `avatars/${openid}.jpg`

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

      // 构建公共访问URL（存储桶已设置为公有读）
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

  // 生成预签名URL（用于访问私有文件）
  async getObjectUrl(fileKey) {
    try {
      this.init()

      const result = await new Promise((resolve, reject) => {
        this.cos.getObjectUrl({
          Bucket: COS_CONFIG.Bucket,
          Region: COS_CONFIG.Region,
          Key: fileKey,
          Sign: true, // 生成预签名URL
          Expires: 3600 // 1小时有效期
        }, function(err, data) {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      })

      console.log('生成预签名URL成功:', result.Url)
      return result.Url
    } catch (error) {
      console.error('生成预签名URL失败:', error)
      // 如果生成预签名URL失败，返回直接URL作为备选
      return `https://${COS_CONFIG.Bucket}.cos.${COS_CONFIG.Region}.myqcloud.com/${fileKey}`
    }
  }

  // 测试COS存储桶访问权限
  async testBucketAccess() {
    try {
      const testUrl = `https://${COS_CONFIG.Bucket}.cos.${COS_CONFIG.Region}.myqcloud.com/`
      console.log('测试COS存储桶访问权限:', testUrl)
      
      // 使用wx.request测试访问
      const result = await new Promise((resolve, reject) => {
        wx.request({
          url: testUrl,
          method: 'GET',
          success: (res) => {
            console.log('COS存储桶访问测试成功:', res)
            resolve({ success: true, data: res })
          },
          fail: (err) => {
            console.log('COS存储桶访问测试失败:', err)
            resolve({ success: false, error: err })
          }
        })
      })
      
      return result
    } catch (error) {
      console.error('测试COS存储桶访问权限失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 刷新预签名URL（当URL过期时使用）
  async refreshAvatarUrl(openid) {
    try {
      const fileName = `avatars/${openid}.jpg`
      const newUrl = await this.getObjectUrl(fileName)
      console.log('刷新头像URL成功:', newUrl)
      return {
        success: true,
        url: newUrl
      }
    } catch (error) {
      console.error('刷新头像URL失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 删除COS中的头像文件
  async deleteAvatar(fileKey) {
    try {
      this.init()

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
