// app.js
App({
  // 观察者列表
  watchers: [],

  // 注册观察者
  watch: function (method) {
    if (!this.watchers.includes(method)) {
      this.watchers.push(method);
    }
  },

  // 移除观察者
  unwatch: function (method) {
    const index = this.watchers.indexOf(method);
    if (index > -1) {
      this.watchers.splice(index, 1);
    }
  },

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
      currentGradeLevel: 'junior', // 默认年级为初中
      defaultUserInfo: {
        nickname: '新同学',
        avatarUrl: '/images/default-avatar.png'
      },
      // 功能开关
      featureFlags: {
        showAITab: false // 默认关闭
      },
      featureFlagsReady: false, // 新增：标记配置是否加载完成
    }
 
    // 获取系统信息（现在可以安全调用了）
    this.getSystemInfo()
    
    // 获取远程配置
    this.loadFeatureConfig()

    // 获取用户信息（放在最后）
    this.getUserInfo()

    // 版本更新
    this.checkUpdate()
  },

  // 小程序从后台切回前台时触发
  onShow: function() {
    console.log('App onShow - 刷新远程配置')
    // 刷新远程功能配置
    this.loadFeatureConfig().then(() => {
      console.log('App onShow - 远程配置刷新完成')
    }).catch(err => {
      console.error('App onShow - 刷新远程配置失败', err)
    })
  },


  // 获取远程功能配置
  loadFeatureConfig: function() {
    return new Promise(resolve => {
      wx.cloud.callFunction({
        name: 'getFeatureConfig',
        success: res => {
          console.log('[云函数] [getFeatureConfig] 调用成功', res.result)
          if (res.result) {
            const { showAITab, isReviewing } = res.result;
            // 如果isReviewing为true，则强制隐藏AI Tab
            this.globalData.featureFlags = {
              ...res.result,
              showAITab: isReviewing ? false : showAITab
            };
          }
        },
        fail: err => {
          console.error('[云函数] [getFeatureConfig] 调用失败', err)
          // 失败时使用默认配置
          this.globalData.featureFlags = {
            showAITab: false
          }
        },
        complete: () => {
          this.globalData.featureFlagsReady = true
          // 通知所有观察者
          this.watchers.forEach(watcher => {
            watcher(this.globalData.featureFlags);
          });
          resolve()
        }
      })
    })
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
        currentGradeLevel: 'junior',
        defaultUserInfo: {
          nickname: '新同学',
          avatarUrl: '/images/default-avatar.png'
        }
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
        currentGradeLevel: 'junior',
        defaultUserInfo: {
          nickname: '新同学',
          avatarUrl: '/images/default-avatar.png'
        }
      };
    }
    
    // 设置默认用户信息
    const defaultUserInfo = {
      nickname: '新同学',
      avatar_url: '/images/default-avatar.png'
    };
    
    this.globalData.userInfo = defaultUserInfo;
    this.globalData.defaultUserInfo = defaultUserInfo;
    this.globalData.hasUserInfo = false; // 设置为false表示未登录
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
          currentGradeLevel: 'junior',
          defaultUserInfo: {
            nickname: '新同学',
            avatarUrl: '/images/default-avatar.png'
          }
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
  },

  checkUpdate: function() {
    const updateManager = wx.getUpdateManager()

    updateManager.onCheckForUpdate(function (res) {
      // 请求完新版本信息的回调
      console.log('hasUpdate', res.hasUpdate)
    })

    updateManager.onUpdateReady(function () {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success: function (res) {
          if (res.confirm) {
            // 新的版本已经下载好，调用 applyUpdate 应用新版本并重启
            updateManager.applyUpdate()
          }
        }
      })
    })

    updateManager.onUpdateFailed(function () {
      // 新版本下载失败
      wx.showToast({
        title: '新版本下载失败',
        icon: 'none'
      })
    })
  }
})