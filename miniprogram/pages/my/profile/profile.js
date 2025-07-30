Page({
  data: {
    userInfo: null,
    maskedOpenid: '',
    showNicknameModal: false,
    nicknameError: ''
  },

  onLoad: function (options) {
    this.checkLoginStatus();
  },

  onShow: function () {
    this.checkLoginStatus();
  },

  checkLoginStatus: function () {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      const openid = userInfo.openid;
      const maskedOpenid = openid.substring(0, 4) + '****' + openid.substring(openid.length - 4);
      this.setData({
        userInfo: userInfo,
        maskedOpenid: maskedOpenid
      });
    } else {
      // 如果没有用户信息，理论上不应该能进入此页面，但作为防错处理，可以跳转回“我的”页面
      wx.navigateBack();
    }
  },

  onChooseAvatar: function(e) {
    const { avatarUrl } = e.detail;
    if (!avatarUrl) return;

    wx.showLoading({ title: '更新中...' });
    
    const cloudPath = `avatar/${this.data.userInfo.openid}/${Date.now()}.jpg`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: avatarUrl,
      success: res => {
        const fileID = res.fileID;
        wx.cloud.callFunction({
          name: 'login',
          data: { action: 'update', userData: { avatarUrl: fileID } },
          success: (res) => {
            if (res.result.success) {
              wx.setStorageSync('userInfo', res.result.userData);
              this.setData({ userInfo: res.result.userData });
              wx.showToast({ title: '头像更新成功' });
            } else {
              wx.showToast({ title: '头像更新失败', icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: '更新失败，请重试', icon: 'none' }),
          complete: () => wx.hideLoading()
        });
      },
      fail: () => {
        wx.showToast({ title: '头像上传失败', icon: 'none' });
        wx.hideLoading();
      }
    });
  },

  showEditNicknameModal: function() {
    this.setData({ showNicknameModal: true, nicknameError: '' });
  },

  hideEditNicknameModal: function() {
    this.setData({ showNicknameModal: false });
  },

  onNicknameInput: function(e) {
    this.setData({ nicknameError: '' });
  },

  updateNickname: function(e) {
    const nickname = e.detail.value.nickname;
    if (!nickname || nickname.trim() === '') {
      this.setData({ nicknameError: '昵称不能为空' });
      return;
    }
    
    wx.showLoading({ title: '更新中...' });
    
    wx.cloud.callFunction({
      name: 'login',
      data: { action: 'updateNickname', userData: { nickname: nickname } },
      success: (res) => {
        if (res.result.success) {
          wx.setStorageSync('userInfo', res.result.userData);
          this.setData({ userInfo: res.result.userData, showNicknameModal: false });
          wx.showToast({ title: '昵称修改成功' });
        } else {
          this.setData({ nicknameError: res.result.error || '修改失败' });
        }
      },
      fail: () => this.setData({ nicknameError: '修改失败，请重试' }),
      complete: () => wx.hideLoading()
    });
  },

  handleLogout: function () {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'login',
            data: { action: 'logout' },
            complete: () => {
              wx.removeStorageSync('userInfo');
              wx.showToast({ title: '已退出登录' });
              // 返回上一页并触发onShow刷新状态
              wx.navigateBack();
            }
          });
        }
      }
    });
  }
})