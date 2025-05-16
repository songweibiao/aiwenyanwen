// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // env 参数说明：
        // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        // 如不填则使用默认环境（第一个创建的环境）
        env: 'wenyanwen-cloud',
        traceUser: true,
      })
    }

    // 获取用户信息
    this.getUserInfo()

    // 获取系统信息
    this.getSystemInfo()

    // 全局数据
    this.globalData = {
      userInfo: null,
      hasUserInfo: false,
      systemInfo: null,
      isIPhoneX: false,
      gradeLevels: [
        { key: 'primary', name: '小学' },
        { key: 'junior', name: '初中' },
        { key: 'senior', name: '高中' },
        { key: 'extra', name: '课外' }
      ],
      currentGradeLevel: 'junior' // 默认年级为初中
    }
  },

  // 获取用户信息
  getUserInfo: function() {
    // 调用云函数获取用户openid
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        console.log('[云函数] [login] 调用成功', res)
        const openid = res.result.openid
        
        // 查询用户信息
        const db = wx.cloud.database()
        db.collection('users').where({
          openid: openid
        }).get({
          success: res => {
            if (res.data.length > 0) {
              // 已注册用户
              this.globalData.userInfo = res.data[0]
              this.globalData.hasUserInfo = true
              
              // 更新登录时间
              db.collection('users').doc(res.data[0]._id).update({
                data: {
                  last_login_time: db.serverDate()
                }
              })
            } else {
              // 新用户，等待授权后注册
              console.log('新用户，等待授权')
            }
          },
          fail: err => {
            console.error('查询用户信息失败', err)
          }
        })
      },
      fail: err => {
        console.error('[云函数] [login] 调用失败', err)
      }
    })
  },

  // 获取系统信息
  getSystemInfo: function() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.globalData.systemInfo = systemInfo
      
      // 判断是否为iPhone X系列
      const model = systemInfo.model
      this.globalData.isIPhoneX = model.search('iPhone X') !== -1 || 
                                  model.search('iPhone 11') !== -1 || 
                                  model.search('iPhone 12') !== -1 ||
                                  model.search('iPhone 13') !== -1 ||
                                  model.search('iPhone 14') !== -1 ||
                                  model.search('iPhone 15') !== -1
    } catch (e) {
      console.error('获取系统信息失败', e)
    }
  }
}) 