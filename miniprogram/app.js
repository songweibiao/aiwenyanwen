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
        env: 'yuanyanhui-4glyxpn30578ebfc',
        traceUser: true,
      })
    }

    // 全局数据初始化（移到最前面）
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

    // 获取系统信息（现在可以安全调用了）
    this.getSystemInfo()
    
    // 获取用户信息（放在最后）
    this.getUserInfo()
  },

  // 获取用户信息
  getUserInfo: function() {
    // 安全检查：确保globalData已初始化
    if (!this.globalData) {
      console.log('getUserInfo: globalData尚未初始化，先进行初始化');
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
        currentGradeLevel: 'junior'
      };
    }
    
    // 检查云函数是否可用，避免调用不存在的云函数导致错误
    if (!wx.cloud || !wx.cloud.callFunction) {
      console.log('云函数不可用，跳过登录流程');
      this.setTempUserInfo();
      return;
    }
    
    // 尝试调用云函数获取用户openid
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
              this.setTempUserInfo();
            }
          },
          fail: err => {
            console.error('查询用户信息失败', err)
            // 登录失败时仍然设置临时用户信息，避免界面显示问题
            this.setTempUserInfo();
          }
        })
      },
      fail: err => {
        console.error('[云函数] [login] 调用失败', err)
        // 登录失败时设置临时用户信息
        this.setTempUserInfo();
      }
    })
  },
  
  // 设置临时用户信息，解决云函数调用失败时界面显示问题
  setTempUserInfo: function() {
    // 安全检查：确保globalData已初始化
    if (!this.globalData) {
      console.log('setTempUserInfo: globalData尚未初始化，先进行初始化');
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
        currentGradeLevel: 'junior'
      };
    }
    
    this.globalData.userInfo = {
      nickname: '文言同学',
      avatar_url: '/images/default-avatar.png'
    };
    this.globalData.hasUserInfo = true;
  },

  // 获取系统信息
  getSystemInfo: function() {
    try {
      // 安全检查：确保globalData已初始化
      if (!this.globalData) {
        console.log('globalData尚未初始化，先进行初始化');
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
          currentGradeLevel: 'junior'
        };
      }
      
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