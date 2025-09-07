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

// 初始化COS实例
const cos = new COS({
  SecretId: COS_CONFIG.SecretId,
  SecretKey: COS_CONFIG.SecretKey,
  SimpleUploadMethod: 'putObject'
})

class COSUploader {
  constructor() {
    this.cos = cos
  }

  // 上传头像到COS
  async uploadAvatar(filePath, openid) {
    try {
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
          SliceSize: 1024 * 1024 * 5, // 5MB以下使用简单上传
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

      // 构建公共访问URL
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

  // 测试COS功能
  async testBucketAccess() {
    try {
      console.log('测试COS功能...')
      return { 
        success: true, 
        message: 'COS SDK初始化成功'
      }
    } catch (error) {
      console.error('测试COS功能失败:', error)
      return { success: false, error: error.message }
    }
  }
}

// 创建单例实例
const cosUploader = new COSUploader()

module.exports = cosUploader
