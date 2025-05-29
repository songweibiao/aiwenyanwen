Page({
  /**
   * 页面的初始数据
   */
  data: {
    isLoggedIn: false,
    userInfo: null,
    showNicknameModal: false,
    nicknameError: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 检查是否已登录
    this.checkLoginStatus();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 每次显示页面时检查登录状态
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus: function () {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      console.log('本地存储的用户信息:', userInfo);
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo
      });
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: null
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
        this.setData({
          isLoggedIn: true,
          userInfo: userData
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
   * 选择头像事件
   */
  onChooseAvatar: function(e) {
    const { avatarUrl } = e.detail;
    console.log('用户选择的头像:', avatarUrl);
    
    wx.showLoading({
      title: '更新中...',
    });
    
    // 将临时文件上传到云存储
    const cloudPath = `avatar/${this.data.userInfo.openid}/${Date.now()}.jpg`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: avatarUrl,
      success: res => {
        // 获取云存储文件ID
        const fileID = res.fileID;
        console.log('头像上传成功，fileID:', fileID);
        
        // 调用云函数更新头像
        wx.cloud.callFunction({
          name: 'login',
          data: {
            action: 'update',
            userData: {
              avatarUrl: fileID
            }
          },
          success: (res) => {
            console.log('更新头像返回结果:', res.result);
            if (res.result.success) {
              // 更新本地存储的用户信息
              wx.setStorageSync('userInfo', res.result.userData);
              
              // 更新页面状态
              this.setData({
                userInfo: res.result.userData
              });
              
              wx.showToast({
                title: '头像更新成功',
                icon: 'success'
              });
            } else {
              wx.showToast({
                title: '头像更新失败',
                icon: 'none'
              });
            }
          },
          fail: (err) => {
            console.error('更新头像失败', err);
            wx.showToast({
              title: '更新失败，请重试',
              icon: 'none'
            });
          },
          complete: () => {
            wx.hideLoading();
          }
        });
      },
      fail: err => {
        console.error('头像上传失败', err);
        wx.showToast({
          title: '头像上传失败，请重试',
          icon: 'none'
        });
        wx.hideLoading();
      }
    });
  },

  /**
   * 显示修改昵称弹窗
   */
  showEditNicknameModal: function() {
    this.setData({
      showNicknameModal: true,
      nicknameError: ''
    });
  },

  /**
   * 隐藏修改昵称弹窗
   */
  hideEditNicknameModal: function() {
    this.setData({
      showNicknameModal: false
    });
  },

  /**
   * 昵称输入事件
   */
  onNicknameInput: function(e) {
    this.setData({
      nicknameError: ''
    });
  },

  /**
   * 更新昵称
   */
  updateNickname: function(e) {
    const nickname = e.detail.value.nickname;
    
    if (!nickname || nickname.trim() === '') {
      this.setData({
        nicknameError: '昵称不能为空'
      });
      return;
    }
    
    wx.showLoading({
      title: '更新中...',
    });
    
    wx.cloud.callFunction({
      name: 'login',
      data: {
        action: 'updateNickname',
        userData: {
          nickname: nickname
        }
      },
      success: (res) => {
        console.log('更新昵称返回结果:', res.result);
        if (res.result.success) {
          // 更新本地存储的用户信息
          wx.setStorageSync('userInfo', res.result.userData);
          
          // 更新页面状态
          this.setData({
            userInfo: res.result.userData,
            showNicknameModal: false
          });
          
          wx.showToast({
            title: '昵称修改成功',
            icon: 'success'
          });
        } else {
          this.setData({
            nicknameError: res.result.error || '修改失败，请重试'
          });
        }
      },
      fail: (err) => {
        console.error('修改昵称失败', err);
        this.setData({
          nicknameError: '修改失败，请重试'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  /**
   * 处理退出登录
   */
  handleLogout: function () {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 调用云函数登出
          wx.cloud.callFunction({
            name: 'login',
            data: {
              action: 'logout'
            },
            complete: () => {
              // 清除本地存储
              wx.removeStorageSync('userInfo');
              
              // 更新页面状态
              this.setData({
                isLoggedIn: false,
                userInfo: null
              });
              
              wx.showToast({
                title: '已退出登录',
                icon: 'success'
              });
            }
          });
        }
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
  }
})
