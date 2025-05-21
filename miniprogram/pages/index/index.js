// 首页
const app = getApp()
const util = require('../../utils/util')
const request = require('../../utils/request')

Page({
  data: {
    greeting: '',
    nickname: '',
    userInfo: null,
    hasUserInfo: false,
    lastStudy: null,
    famousQuote: null,
    gradeLevels: [],
    currentGrade: '一年级上',
    currentLesson: '李白《将进酒》',
    currentWordType: '中考',
    currentWordTypeName: '中考必背虚实词',
    noticeList: [],
    currentNoticeIndex: 0,
    currentNotice: {},
    marqueeState: 'pause', // 'pause' or 'scroll'
    marqueeDuration: 0,
    marqueeTranslateX: 0,
    marqueeTimer: null,
    noticeClosed: false,
  },

  onLoad: function () {
    // 设置问候语
    this.setData({
      greeting: this.getGreeting(),
      gradeLevels: app.globalData.gradeLevels || []
    })

    // 获取用户信息
    this.getUserInfo()

    // 获取最近学习的文章
    this.getLastStudy()

    // 获取一条名句
    this.getRandomFamousQuote()

    // 拉取公告
    const db = wx.cloud.database();
    db.collection('notices')
      .where({ status: 1 })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        const list = res.data || [];
        
        this.setData({
          noticeList: list,
          currentNoticeIndex: 0,
          currentNotice: list[0] || {}
        }, () => {
          if (list.length > 0) {
            // 延迟启动公告循环，确保DOM已渲染
            setTimeout(() => {
              this.startNoticeLoop();
            }, 300);
          }
        });
      });
    // 检查本地关闭状态
    const closed = wx.getStorageSync('noticeClosed');
    this.setData({ noticeClosed: !!closed });
  },

  onShow: function () {
    // 每次显示页面时可能更新用户信息
    if (app.globalData.hasUserInfo) {
      this.setData({
        nickname: app.globalData.userInfo.nickname || '同学',
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    }
  },

  // 获取问候语
  getGreeting: function() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return '早上好';
    } else if (hour >= 12 && hour < 14) {
      return '中午好';
    } else if (hour >= 14 && hour < 18) {
      return '下午好';
    } else if (hour >= 18 && hour < 24) {
      return '晚上好';
    } else {
      return '夜深了';
    }
  },

  // 获取用户信息
  getUserInfo: function () {
    if (app.globalData.hasUserInfo) {
      this.setData({
        nickname: app.globalData.userInfo.nickname || '同学',
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else {
      // 模拟用户数据
      const mockUserInfo = {
        nickname: '文言同学',
        avatarUrl: '/miniprogram/images/default-avatar.png'
      };
      
      this.setData({
        nickname: mockUserInfo.nickname,
        userInfo: mockUserInfo,
        hasUserInfo: true
      });
    }
  },

  // 获取最近学习的文章
  getLastStudy: function () {
    // 模拟的最近学习数据
    const mockLastStudy = {
      article: {
        _id: 'art001',
        title: '登鹳雀楼',
        author: '王之涣',
        dynasty: '唐',
      },
      position: {
        section_type: '逐句解析',
        section_index: 2
      },
      progress: 45,
      time: '3小时前'
    };
    
    this.setData({
      lastStudy: mockLastStudy
    });
  },

  // 获取随机名句
  getRandomFamousQuote: function () {
    // 模拟的名句数据
    const mockQuotes = [
      {
        _id: 'q001',
        content: '欲穷千里目，更上一层楼。',
        source: '登鹳雀楼',
        author: '王之涣',
        dynasty: '唐',
        translation: '如果想要看到更远的地方，那就要登上更高的楼层。'
      },
      {
        _id: 'q002',
        content: '会当凌绝顶，一览众山小。',
        source: '望岳',
        author: '杜甫',
        dynasty: '唐',
        translation: '我一定要登上泰山的顶峰，俯瞰群山的渺小。'
      },
      {
        _id: 'q003',
        content: '人生自古谁无死，留取丹心照汗青。',
        source: '过零丁洋',
        author: '文天祥',
        dynasty: '宋',
        translation: '自古以来谁能够免于一死，只愿留下赤诚的忠心照耀青史。'
      }
    ];
    
    const randomIndex = Math.floor(Math.random() * mockQuotes.length);
    this.setData({
      famousQuote: mockQuotes[randomIndex]
    });
  },

  // 切换年级
  changeGrade: function() {
    wx.showActionSheet({
      itemList: ['一年级上', '一年级下', '二年级上', '二年级下', '三年级上', '三年级下'],
      success: (res) => {
        if (res.tapIndex >= 0) {
          this.setData({
            currentGrade: ['一年级上', '一年级下', '二年级上', '二年级下', '三年级上', '三年级下'][res.tapIndex]
          });
          wx.showToast({
            title: '年级已切换',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  // 更换课程
  changeCourse: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/course/list'
    });
  },

  // 前往课文讲解
  goToArticleExplain: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/article/explain'
    });
  },

  // 前往逐句解析
  goToSentenceAnalysis: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/analysis/index'
    });
  },

  // 前往背景知识
  goToBackground: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/background/index'
    });
  },

  // 前往随堂练习
  goToExercise: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/exercise/index'
    });
  },

  // 前往AI互动
  goToAIInteraction: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/ai/index'
    });
  },

  // 前往背诵页面
  goToRecitation: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/article/recite'
    });
  },

  // 听/背课文
  goToListenArticle: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/article/listen'
    });
  },

  // 课文跟读
  goToReadAloud: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/article/read'
    });
  },

  // 译文·鉴赏
  goToAppreciation: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/article/appreciation'
    });
  },

  // 背注释
  goToAnnotation: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/article/annotation'
    });
  },

  // 中考必背虚实词
  goToMiddleExamWords: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/word/middle'
    });
  },

  // 高考必背虚实词
  goToHighExamWords: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/word/high'
    });
  },

  // 打卡页面
  goToCheckin: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/user/checkin'
    });
  },

  // 学习页面
  goToStudy: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/study/index'
    });
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
      url: '/miniprogram/pages/word/index'
    })
  },
  
  // 前往虚词实词练习页
  goToWordPractice: function () {
    wx.navigateTo({
      url: '/miniprogram/pages/word/practice'
    })
  },
  
  // 前往名句赏析页
  goToFamousQuotes: function () {
    wx.navigateTo({
      url: '/miniprogram/pages/article/quotes'
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
  refreshQuote: function (e) {
    e.stopPropagation();
    this.getRandomFamousQuote();
    wx.showToast({
      title: '已刷新',
      icon: 'success',
      duration: 1000
    });
  },

  // 收藏名句
  collectQuote: function (e) {
    e.stopPropagation();
    wx.showToast({
      title: '收藏成功',
      icon: 'success',
      duration: 1500
    });
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
  },

  // 全文翻译
  goToFullTranslation: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/translation/index'
    });
  },
  
  // 作者介绍
  goToAuthorInfo: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/author/index'
    });
  },
  
  // 随堂练习
  goToExercise: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/exercise/index'
    });
  },
  
  // AI互动
  goToAIInteraction: function() {
    wx.navigateTo({
      url: '/miniprogram/pages/ai/index'
    });
  },

  // 切换虚实词类型
  changeWordType: function() {
    wx.showActionSheet({
      itemList: ['中考必背虚实词', '高考必背虚实词'],
      success: (res) => {
        if (res.tapIndex >= 0) {
          const wordType = res.tapIndex === 0 ? '中考' : '高考';
          const wordTypeName = res.tapIndex === 0 ? '中考必背虚实词' : '高考必背虚实词';
          this.setData({
            currentWordType: wordType,
            currentWordTypeName: wordTypeName
          });
          wx.showToast({
            title: '课程已切换',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  closeNotice() {
    this.setData({ noticeClosed: true });
    wx.setStorageSync('noticeClosed', true);
  },

  onNoticeTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      if (url.startsWith('http')) {
        wx.navigateTo({ url: '/pages/webview/index?url=' + encodeURIComponent(url) });
      } else {
        wx.navigateTo({ url });
      }
    }
  },

  startNoticeLoop() {
    if (!this.data.noticeList.length) return;
    this.showCurrentNotice();
  },

  showCurrentNotice() {
    // 静止显示，3秒后判断是否需要滚动
    this.setData({
      marqueeState: 'pause',
      marqueeTranslateX: 0,
      marqueeDuration: 0
    });
    clearTimeout(this.data.marqueeTimer);
    this.data.marqueeTimer = setTimeout(() => {
      this.checkAndScroll();
    }, 3000);
  },

  checkAndScroll() {
    wx.createSelectorQuery().select('.marquee-wrap').boundingClientRect(wrapRect => {
      wx.createSelectorQuery().select('.marquee-content').boundingClientRect(contentRect => {
        if (wrapRect && contentRect && contentRect.width > wrapRect.width) {
          // 需要滚动
          // 计算需要滚动的距离，只需要将最后一个字显示出来
          // 因为文字右侧已有padding，所以只需滚动到内容宽度减去容器宽度即可
          const distance = contentRect.width - wrapRect.width + 1; // 加上右边距确保最后字符完全显示
          const duration = Math.max(2, distance / 40); // 合适的滚动速度
          
          this.setData({
            marqueeState: 'scroll',
            marqueeDuration: duration,
            marqueeTranslateX: -distance // 只滚动到最后一个字符完全显示
          });
          
          clearTimeout(this.data.marqueeTimer);
          this.data.marqueeTimer = setTimeout(() => {
            // 滚动结束后等待2秒
            this.nextNotice();
          }, duration * 1000 + 2000);  // 滚动结束后多等待2秒
        } else {
          // 不需要滚动，3秒后切换下一条
          clearTimeout(this.data.marqueeTimer);
          this.data.marqueeTimer = setTimeout(() => {
            this.nextNotice();
          }, 3000);  // 让用户有更多时间阅读
        }
      }).exec();
    }).exec();
  },

  nextNotice() {
    // 如果只有一条公告，则继续显示当前公告
    if (this.data.noticeList.length <= 1) {
      this.showCurrentNotice();
      return;
    }
    
    // 否则切换到下一条公告
    let nextIndex = this.data.currentNoticeIndex + 1;
    if (nextIndex >= this.data.noticeList.length) nextIndex = 0;
    this.setData({
      currentNoticeIndex: nextIndex,
      currentNotice: this.data.noticeList[nextIndex]
    }, () => {
      this.showCurrentNotice();
    });
  },

  onUnload() {
    clearTimeout(this.data.marqueeTimer);
  },
}) 