Page({
  /**
   * 页面的初始数据
   */
  data: {
    isLoggedIn: false,
    userInfo: null,
    maskedOpenid: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 检查是否已登录
    this.checkLoginStatus();
    
    // 检查基础库版本
    this.checkSDKVersion();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    if (typeof this.getTabBar === 'function' &&
      this.getTabBar()) {
      const app = getApp()
      const showAITab = app.globalData.featureFlags.showAITab
      this.getTabBar().setData({
        selected: showAITab ? 3 : 2
      })
    }
    // 每次显示页面时检查登录状态
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus: function () {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      console.log('本地存储的用户信息:', userInfo);
      // 创建脱敏的openid
      const openid = userInfo.openid;
      const maskedOpenid = openid.substring(0, 4) + '****' + openid.substring(openid.length - 4);
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo,
        maskedOpenid: maskedOpenid
      });
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: null
      });
    }
  },

  /**
   * 检查微信基础库版本
   */
  checkSDKVersion: function() {
    const sdkVersion = wx.getSystemInfoSync().SDKVersion;
    console.log('当前基础库版本:', sdkVersion);
    
    // 检查是否支持chooseAvatar功能（需要基础库2.21.2及以上）
    const canIUseChooseAvatar = wx.canIUse('button.open-type.chooseAvatar');
    console.log('是否支持chooseAvatar:', canIUseChooseAvatar);
    
    if (!canIUseChooseAvatar) {
      wx.showToast({
        title: '当前微信版本过低，请更新微信',
        icon: 'none',
        duration: 3000
      });
    }
  },

  /**
   * 处理微信授权登录
   */
  handleWechatAuth: function () {
    wx.showLoading({
      title: '登录中...',
    });

    // 获取用户信息
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userProfile = res.userInfo;
        console.log('获取到的微信用户信息:', userProfile);
        
        // 直接调用登录云函数，不处理头像
        // 避免downloadFile域名限制问题
        this.callLoginFunction();
      },
      fail: (err) => {
        wx.hideLoading();
        console.log('获取用户信息失败', err);
        wx.showToast({
          title: '获取用户信息失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 调用登录云函数
   */
  callLoginFunction: function(avatarUrl = '') {
    // 调用云函数登录
    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'check',
        userData: {
          avatarUrl: avatarUrl
        }
      },
      success: (res) => {
        console.log('云函数返回结果:', res.result);
        const { userData } = res.result;
        
        if (!userData) {
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'none'
          });
          return;
        }
        
        // 保存用户信息到本地
        wx.setStorageSync('userInfo', userData);
        
        // 更新页面状态
        const openid = userData.openid;
        const maskedOpenid = openid.substring(0, 4) + '****' + openid.substring(openid.length - 4);
        this.setData({
          isLoggedIn: true,
          userInfo: userData,
          maskedOpenid: maskedOpenid
        });
        
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('登录失败', err);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },


  /**
   * 页面跳转
   */
  handleNavigate: function (e) {
    const url = e.currentTarget.dataset.url;
    wx.navigateTo({
      url: url
    });
  },

  /**
   * 跳转到个人信息页
   */
  goToProfile: function() {
    wx.navigateTo({
      url: '/pages/my/profile/profile',
    });
  },

  /**
   * 处理意见反馈
   */
  handleFeedback: function() {
    const pid = 682297; // 您的产品ID
    const userInfo = this.data.userInfo;

    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    // 将参数拼接到path中，以获得最佳兼容性
    const path = `pages/index/index?pid=${pid}&openid=${userInfo.openid}&nickname=${encodeURIComponent(userInfo.nickname)}&avatar=${encodeURIComponent(userInfo.avatarUrl)}`;

    wx.openEmbeddedMiniProgram({
      appId: 'wx8abaf00ee8c3202e', // 兔小巢appid
      path: path,
      halfScreen: true, // 尝试半屏打开，低版本会自动降级为全屏
      success(res) {
        console.log('小程序打开成功', res);
      },
      fail(res) {
        console.error('小程序打开失败', res);
        wx.showToast({
          title: '无法打开反馈页面',
          icon: 'none'
        });
      }
    });
  }
})
