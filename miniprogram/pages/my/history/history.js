// 学习历史页面
const app = getApp()
const util = require('../../../utils/util')

Page({
  data: {
    historyList: [],
    wordHistoryList: [],
    loading: true,
    empty: false,
    userInfo: null,
    isLoggedIn: false,
    activeTab: 'article' // 'article' or 'word'
  },

  onLoad: function (options) {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo') || null;
    this.setData({
      userInfo: userInfo,
      isLoggedIn: !!userInfo
    });
    if (userInfo) {
      // 加载历史记录
      this.loadDataForCurrentTab();
    }
  },
  
  onShow: function () {
    // 每次显示页面时重新判断登录状态
    const userInfo = wx.getStorageSync('userInfo') || null;
    this.setData({
      userInfo: userInfo,
      isLoggedIn: !!userInfo
    });
    if (userInfo) {
      this.loadDataForCurrentTab();
    }
  },
  
  // 加载历史记录
  loadHistoryRecords: function () {
    this.setData({ loading: true })
    
    // 调用云函数获取学习历史记录
    wx.cloud.callFunction({
      name: 'getUserArticleRecords',
      data: {},
      success: res => {
        console.log('获取学习历史记录成功:', res.result)
        
        if (res.result.success && res.result.data && res.result.data.length > 0) {
          // 处理时间格式
          const historyList = res.result.data.map(item => {
            // 格式化最后学习时间
            const lastLearnTime = new Date(item.last_learn_time)
            const timeStr = util.timeAgo(lastLearnTime)
            
            // 学习状态文本
            let statusText = '未学习'
            if (item.learn_status === 1) {
              statusText = '学习中'
            } else if (item.learn_status === 2) {
              statusText = '已学完'
            }
            
            // 学习时长格式化
            let durationText = '0分钟'
            if (item.learn_duration) {
              const minutes = Math.floor(item.learn_duration / 60)
              if (minutes < 1) {
                durationText = `${item.learn_duration}秒`
              } else {
                durationText = `${minutes}分钟`
              }
            }
            
            return {
              ...item,
              timeStr: timeStr,
              statusText: statusText,
              durationText: durationText
            }
          })
          
          this.setData({
            historyList: historyList,
            loading: false,
            empty: false
          })
        } else {
          this.setData({
            historyList: [],
            loading: false,
            empty: true
          })
        }
      },
      fail: err => {
        console.error('获取学习历史记录失败:', err)
        this.setData({
          loading: false,
          empty: true
        })
        
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  // 根据当前激活的tab加载数据
  loadDataForCurrentTab: function() {
    if (this.data.activeTab === 'article') {
      this.loadHistoryRecords();
    } else {
      this.loadWordHistory();
    }
  },

  // 切换Tab
  onTabChange: function(e) {
    const newTab = e.currentTarget.dataset.tab;
    if (newTab !== this.data.activeTab) {
      this.setData({
        activeTab: newTab,
        loading: true, // 重置加载状态
        empty: false,
        historyList: [], // 清空旧数据
        wordHistoryList: []
      });
      this.loadDataForCurrentTab();
    }
  },

  // 加载虚实词学习历史
  loadWordHistory: function() {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'getUserWordProgress',
      data: {
        userId: this.data.userInfo.openid
      },
      success: res => {
        if (res.result.success && res.result.data && res.result.data.length > 0) {
          const wordHistoryList = res.result.data.map(item => {
            const updateTime = new Date(item.updateTime);
            const timeStr = util.timeAgo(updateTime);
            let statusText = '学习中';
            if (item.status === 'learned') {
              statusText = '已掌握';
            } else if (item.status === 'review') {
              statusText = '待复习';
            }
            return {
              ...item,
              timeStr: timeStr,
              statusText: statusText
            };
          });
          this.setData({
            wordHistoryList: wordHistoryList,
            loading: false,
            empty: false
          });
        } else {
          this.setData({
            wordHistoryList: [],
            loading: false,
            empty: true
          });
        }
      },
      fail: err => {
        console.error('获取虚实词学习历史失败:', err);
        this.setData({ loading: false, empty: true });
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
      }
    });
  },
  
  // 跳转到文章详情页
  goToArticleDetail: function (e) {
    const articleId = e.currentTarget.dataset.id
    if (articleId) {
      // 直接使用articleId，不再尝试访问可能不存在的article属性
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}`
      })
    } else {
      wx.showToast({
        title: '文章信息有误',
        icon: 'none'
      })
    }
  },
  
  // 清空历史记录
  clearHistory: function () {
    wx.showModal({
      title: '提示',
      content: '确定要清空所有学习历史吗？此操作不可恢复',
      success: (res) => {
        if (res.confirm) {
          // 目前我们不提供清空云端历史记录的功能，只清空本地显示
          this.setData({
            historyList: [],
            empty: true
          })
          
          wx.showToast({
            title: '历史记录已清空',
            icon: 'success'
          })
        }
      }
    })
  },
  
  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadHistoryRecords()
    wx.stopPullDownRefresh()
  },

  // 跳转到登录页
  goToLogin: function() {
    wx.switchTab({
      url: '/pages/my/index/index'
    });
  },

  goToWordDetail: function(e) {
    const { wordid, category } = e.currentTarget.dataset;
    if (wordid && category) {
      wx.navigateTo({
        url: `/pages/word-learning/study/study?wordId=${wordid}&category=${category}`
      });
    } else {
      wx.showToast({
        title: '词条信息有误',
        icon: 'none'
      });
    }
  }
})