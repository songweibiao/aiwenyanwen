// 我的收藏页面
Page({
  /**
   * 页面的初始数据
   */
  data: {
    activeTab: 'article', // 当前选中的标签页：'quote'(名句) 或 'article'(文章)
    quoteList: [], // 收藏的名句列表
    articleList: [], // 收藏的文章列表
    loading: false, // 加载状态
    isLoggedIn: false, // 是否已登录
    userInfo: null // 用户信息
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 检查登录状态
    this.checkLoginStatus();
    
    // 如果有传入tab参数，则切换到对应标签页
    if (options.tab && ['quote', 'article'].includes(options.tab)) {
      this.setData({
        activeTab: options.tab
      });
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 每次显示页面时检查登录状态
    this.checkLoginStatus();
    
    // 如果已登录，获取收藏列表
    if (this.data.isLoggedIn) {
      this.fetchFavoriteList();
    }
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus: function () {
    const userInfo = wx.getStorageSync('userInfo');
    
    if (userInfo) {
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo
      });
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: null,
        quoteList: [],
        articleList: []
      });
    }
  },

  /**
   * 切换标签页
   */
  onTabChange: function (e) {
    const tab = e.currentTarget.dataset.tab;
    
    this.setData({
      activeTab: tab
    });
  },

  /**
   * 获取收藏列表
   */
  fetchFavoriteList: function () {
    if (!this.data.isLoggedIn) {
      return;
    }
    
    this.setData({
      loading: true
    });
    
    // 调用云函数获取收藏列表
    wx.cloud.callFunction({
      name: 'userFavorite',
      data: {
        action: 'list'
      },
      success: res => {
        console.log('获取收藏列表成功:', res.result);
        
        if (res.result.success) {
          // 分类处理收藏数据
          const quoteList = [];
          const articleList = [];
          
          res.result.data.forEach(item => {
            if (item.type === 'quote') {
              quoteList.push({
                _id: item._id,
                itemId: item.itemId,
                quote: item.quote || {},
                createTime: item.createTime
              });
            } else if (item.type === 'article') {
              articleList.push({
                _id: item._id,
                itemId: item.itemId,
                article: item.article || {},
                createTime: item.createTime
              });
            }
          });
          
          this.setData({
            quoteList: quoteList,
            articleList: articleList
          });
        } else {
          wx.showToast({
            title: res.result.message || '获取收藏失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('获取收藏列表失败:', err);
        wx.showToast({
          title: '获取收藏失败',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({
          loading: false
        });
      }
    });
  },

  /**
   * 取消收藏
   */
  cancelFavorite: function (e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    const itemId = e.currentTarget.dataset.itemid;
    
    wx.showModal({
      title: '提示',
      content: '确定要取消收藏吗？',
      success: res => {
        if (res.confirm) {
          this.setData({
            loading: true
          });
          
          // 调用云函数取消收藏
          wx.cloud.callFunction({
            name: 'userFavorite',
            data: {
              action: 'remove',
              type: type,
              id: itemId
            },
            success: res => {
              console.log('取消收藏成功:', res.result);
              
              if (res.result.success) {
                // 更新本地数据
                if (type === 'quote') {
                  this.setData({
                    quoteList: this.data.quoteList.filter(item => item._id !== id)
                  });
                } else if (type === 'article') {
                  this.setData({
                    articleList: this.data.articleList.filter(item => item._id !== id)
                  });
                }
                
                wx.showToast({
                  title: '已取消收藏',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: res.result.message || '取消收藏失败',
                  icon: 'none'
                });
              }
            },
            fail: err => {
              console.error('取消收藏失败:', err);
              wx.showToast({
                title: '取消收藏失败',
                icon: 'none'
              });
            },
            complete: () => {
              this.setData({
                loading: false
              });
            }
          });
        }
      }
    });
  },

  /**
   * 跳转到文章详情页
   */
  goToArticleDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    
    wx.navigateTo({
      url: `/pages/article/detail/detail?id=${id}`
    });
  },

  /**
   * 跳转到名句详情页
   */
  goToQuoteDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    
    wx.navigateTo({
      url: `/pages/quote/detail/detail?id=${id}`
    });
  },

  /**
   * 跳转到登录页面
   */
  goToLogin: function () {
    wx.switchTab({
      url: '/pages/my/index/index'
    });
  }
}) 