// 首页
const app = getApp()
const util = require('../../utils/util')
const request = require('../../utils/request')

Page({
  data: {
    greeting: '',
    nickname: '',
    hasUserInfo: false,
    lastStudy: null,
    famousQuote: null,
    gradeLevels: []
  },

  onLoad: function () {
    // 设置问候语
    this.setData({
      greeting: util.getGreeting(),
      gradeLevels: app.globalData.gradeLevels || []
    })

    // 获取用户信息
    this.getUserInfo()

    // 获取最近学习的文章
    this.getLastStudy()

    // 获取一条名句
    this.getRandomFamousQuote()
  },

  onShow: function () {
    // 每次显示页面时可能更新用户信息
    if (app.globalData.hasUserInfo) {
      this.setData({
        nickname: app.globalData.userInfo.nickname || '同学',
        hasUserInfo: true
      })
    }
  },

  // 获取用户信息
  getUserInfo: function () {
    if (app.globalData.hasUserInfo) {
      this.setData({
        nickname: app.globalData.userInfo.nickname || '同学',
        hasUserInfo: true
      })
    } else {
      // 监听全局数据变化
      const interval = setInterval(() => {
        if (app.globalData.hasUserInfo) {
          this.setData({
            nickname: app.globalData.userInfo.nickname || '同学',
            hasUserInfo: true
          })
          clearInterval(interval)
        }
      }, 500)

      // 3秒后如果仍未获取到用户信息，则停止监听
      setTimeout(() => {
        clearInterval(interval)
      }, 3000)
    }
  },

  // 获取最近学习的文章
  getLastStudy: function () {
    const db = wx.cloud.database()
    if (!app.globalData.hasUserInfo || !app.globalData.userInfo) return

    request.db.getOne('user_study_records', {
      user_id: app.globalData.userInfo._id
    }).then(res => {
      if (res.data && res.data.last_study_position) {
        const lastStudyPosition = res.data.last_study_position
        
        // 获取文章详情
        request.db.getOne('articles', lastStudyPosition.article_id).then(articleRes => {
          if (articleRes.data) {
            this.setData({
              lastStudy: {
                article: articleRes.data,
                position: lastStudyPosition,
                progress: res.data.total_articles_count > 0 ? 
                  util.calculateProgress(lastStudyPosition.section_index, 10) : 0, // 假设每篇文章平均有10个句子
                time: util.timeAgo(res.data.last_study_time)
              }
            })
          }
        })
      }
    }).catch(err => {
      console.error('获取最近学习记录失败', err)
    })
  },

  // 获取随机名句
  getRandomFamousQuote: function () {
    request.db.getList('famous_quotes', {
      limit: 1,
      orderBy: { 'display_order': 'asc' }
    }).then(res => {
      if (res.data && res.data.length > 0) {
        this.setData({
          famousQuote: res.data[0]
        })
      }
    }).catch(err => {
      console.error('获取名句失败', err)
    })
  },

  // 前往课文选择页
  goToArticleList: function () {
    wx.navigateTo({
      url: '/miniprogram/pages/article/list'
    })
  },

  // 前往虚词实词学习页
  goToWordStudy: function () {
    wx.navigateTo({
      url: '/miniprogram/pages/article/words'
    })
  },

  // 前往继续学习
  continueStudy: function () {
    if (!this.data.lastStudy) return
    
    wx.navigateTo({
      url: `/miniprogram/pages/article/detail?id=${this.data.lastStudy.article._id}&section=${this.data.lastStudy.position.section_type}&index=${this.data.lastStudy.position.section_index}`
    })
  },

  // 刷新名句
  refreshQuote: function () {
    this.getRandomFamousQuote()
  },

  // 分享名句
  shareQuote: function () {
    if (!this.data.famousQuote) return
    
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  // 跳转到名句详情
  goToQuoteDetail: function () {
    if (!this.data.famousQuote) return
    
    wx.navigateTo({
      url: `/miniprogram/pages/article/quote?id=${this.data.famousQuote._id}`
    })
  },

  // 前往文章详情
  goToArticleDetail: function (e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/miniprogram/pages/article/detail?id=${id}`
    })
  },

  // 去推广领取页面
  goToPromotion: function () {
    // 复制推广码
    wx.setClipboardData({
      data: 'WENYANYUEDU',
      success: () => {
        wx.showModal({
          title: '推广码已复制',
          content: '请前往公众号"文言悦读"，发送推广码领取学习资料',
          showCancel: false
        })
      }
    })
  },

  // 用户分享
  onShareAppMessage: function () {
    return {
      title: '文言悦读 - 让文言文学习更轻松',
      path: '/miniprogram/pages/index/index',
      imageUrl: '/miniprogram/images/share.jpg'
    }
  },

  // 分享到朋友圈
  onShareTimeline: function () {
    return {
      title: '文言悦读 - 让文言文学习更轻松',
      query: '',
      imageUrl: '/miniprogram/images/share.jpg'
    }
  }
}) 