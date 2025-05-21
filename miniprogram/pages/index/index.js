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
    // 是否已选择课文
    hasSelectedCourse: false,
    // 当前选择的课文信息
    selectedCourse: null,
    // 课文数据加载状态
    courseLoading: true
  },

  onLoad: function () {
    // 设置问候语
    this.setData({
      greeting: this.getGreeting(),
      gradeLevels: app.globalData.gradeLevels || [],
      // 初始设置课文加载中
      courseLoading: true
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
    
    // 检查是否已选择课文
    this.checkSelectedCourse();
  },
  
  // 检查是否已选择课文
  checkSelectedCourse: function() {
    this.setData({ courseLoading: true });
    
    const selectedCourse = wx.getStorageSync('selectedCourse');
    if (selectedCourse && selectedCourse.article) {
      console.log('找到已选择的课文:', selectedCourse);
      
      // 检查是否有文章ID
      if (selectedCourse.article._id) {
        // 从云数据库获取最新的课文数据
        this.fetchArticleFromCloud(selectedCourse.article._id, selectedCourse);
      } else if (selectedCourse.article.article_id) {
        // 如果有article_id字段，使用它查询
        this.fetchArticleByArticleId(selectedCourse.article.article_id, selectedCourse);
      } else {
        // 没有可用的ID，标记为未选择课文
        console.log('课文数据无有效ID');
        this.setData({
          hasSelectedCourse: false,
          selectedCourse: null,
          courseLoading: false
        });
      }
    } else {
      console.log('未找到已选择的课文');
      this.setData({
        hasSelectedCourse: false,
        selectedCourse: null,
        courseLoading: false
      });
    }
  },
  
  // 通过_id从云数据库获取课文数据
  fetchArticleFromCloud: function(articleId, selectedCourse) {
    console.log('尝试通过_id获取课文:', articleId);
    const db = wx.cloud.database();
    
    db.collection('articles').doc(articleId).get()
      .then(res => {
        if (res.data) {
          console.log('成功获取到课文数据:', res.data);
          
          // 更新课文信息
          const updatedSelectedCourse = {
            article: res.data,
            grade: `${res.data.grade}${res.data.semester}`
          };
          
          // 更新本地存储
          wx.setStorageSync('selectedCourse', updatedSelectedCourse);
          
          // 更新页面数据
          this.setData({
            hasSelectedCourse: true,
            selectedCourse: updatedSelectedCourse,
            currentGrade: updatedSelectedCourse.grade,
            currentLesson: res.data.title,
            courseLoading: false
          });
        } else {
          console.log('未找到课文数据，尝试通过article_id查询');
          // 尝试通过article_id查询
          if (selectedCourse.article.article_id) {
            this.fetchArticleByArticleId(selectedCourse.article.article_id, selectedCourse);
          } else {
            // 使用本地缓存数据
            this.useLocalCourseData(selectedCourse);
          }
        }
      })
      .catch(err => {
        console.error('获取课文详情失败:', err);
        
        // 尝试通过article_id查询
        if (selectedCourse.article.article_id) {
          this.fetchArticleByArticleId(selectedCourse.article.article_id, selectedCourse);
        } else {
          // 查询失败，使用本地缓存数据
          this.useLocalCourseData(selectedCourse);
        }
      });
  },
  
  // 通过article_id从云数据库获取课文数据
  fetchArticleByArticleId: function(articleId, selectedCourse) {
    console.log('尝试通过article_id获取课文:', articleId);
    const db = wx.cloud.database();
    
    db.collection('articles')
      .where({
        article_id: articleId.toString()
      })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          console.log('成功通过article_id获取到课文数据:', res.data[0]);
          
          // 获取到课文数据
          const articleData = res.data[0];
          
          // 更新课文信息
          const updatedSelectedCourse = {
            article: articleData,
            grade: `${articleData.grade}${articleData.semester}`
          };
          
          // 更新本地存储
          wx.setStorageSync('selectedCourse', updatedSelectedCourse);
          
          // 更新页面数据
          this.setData({
            hasSelectedCourse: true,
            selectedCourse: updatedSelectedCourse,
            currentGrade: updatedSelectedCourse.grade,
            currentLesson: articleData.title,
            courseLoading: false
          });
        } else {
          console.log('通过article_id未找到课文，使用本地缓存数据');
          // 查询失败，使用本地缓存数据
          this.useLocalCourseData(selectedCourse);
        }
      })
      .catch(err => {
        console.error('通过文章ID获取课文失败:', err);
        // 查询失败，使用本地缓存数据
        this.useLocalCourseData(selectedCourse);
      });
  },
  
  // 使用本地缓存的课文数据
  useLocalCourseData: function(selectedCourse) {
    console.log('使用本地缓存的课文数据:', selectedCourse);
    
    this.setData({
      hasSelectedCourse: true,
      selectedCourse: selectedCourse,
      currentGrade: selectedCourse.grade || this.data.currentGrade,
      currentLesson: selectedCourse.article.title || this.data.currentLesson,
      courseLoading: false
    });
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
    // 从本地存储获取最近学习的记录
    try {
      const lastStudyRecord = wx.getStorageSync('lastStudyRecord');
      if (lastStudyRecord) {
        this.setData({
          lastStudy: lastStudyRecord
        });
        return;
      }
    } catch (e) {
      console.error('获取学习记录失败:', e);
    }
    
    // 如果没有本地记录，使用模拟数据
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
    // 从云数据库获取名句数据
    const db = wx.cloud.database();
    
    // 尝试从名句集合获取随机名句
    db.collection('famous_quotes')
      .aggregate()
      .sample({
        size: 1
      })
      .end()
      .then(res => {
        if (res.list && res.list.length > 0) {
          this.setData({
            famousQuote: res.list[0]
          });
        } else {
          // 如果没有名句集合或数据，使用模拟数据
          this.useLocalQuoteData();
        }
      })
      .catch(err => {
        console.error('获取名句失败:', err);
        // 使用模拟数据
        this.useLocalQuoteData();
      });
  },
  
  // 使用本地模拟的名句数据
  useLocalQuoteData: function() {
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
      url: '/pages/course/select/select?fromHome=true'
    });
  },
  
  // 开始学习（新增方法，用于未选择课文时跳转到课文选择页）
  startLearning: function() {
    wx.navigateTo({
      url: '/pages/course/select/select?fromHome=true'
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
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse?.article?._id;
    if (articleId) {
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=analysis`
      });
    } else {
      wx.showToast({
        title: '课文信息有误',
        icon: 'none'
      });
    }
  },

  // 前往全文翻译
  goToFullTranslation: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse?.article?._id;
    if (articleId) {
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=translation`
      });
    } else {
      wx.showToast({
        title: '课文信息有误',
        icon: 'none'
      });
    }
  },

  // 前往背景知识
  goToBackground: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse?.article?._id;
    if (articleId) {
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=background`
      });
    } else {
      wx.showToast({
        title: '课文信息有误',
        icon: 'none'
      });
    }
  },

  // 前往随堂练习
  goToExercise: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse?.article?._id;
    if (articleId) {
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=exercise`
      });
    } else {
      wx.showToast({
        title: '课文信息有误',
        icon: 'none'
      });
    }
  },

  // 前往AI互动
  goToAIInteraction: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse?.article?._id;
    if (articleId) {
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=qa`
      });
    } else {
      wx.showToast({
        title: '课文信息有误',
        icon: 'none'
      });
    }
  },

  // 前往背诵页面
  goToRecitation: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/miniprogram/pages/article/recite'
    });
  },

  // 听/背课文
  goToListenArticle: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/miniprogram/pages/article/listen'
    });
  },

  // 课文跟读
  goToReadAloud: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/miniprogram/pages/article/read'
    });
  },

  // 译文·鉴赏
  goToAppreciation: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: '/miniprogram/pages/article/appreciation'
    });
  },

  // 背注释
  goToAnnotation: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
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
      url: '/pages/course/select/select'
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
      title: '已收藏',
      icon: 'success',
      duration: 1000
    });
  },

  // 前往名句详情
  goToQuoteDetail: function () {
    wx.navigateTo({
      url: `/miniprogram/pages/article/quote-detail?id=${this.data.famousQuote._id}`
    });
  },

  // 前往领取推广福利
  goToPromotion: function () {
    wx.setClipboardData({
      data: 'WENYAN2023',
      success: function () {
        wx.showToast({
          title: '推广码已复制',
          icon: 'success'
        });
      }
    });
  },
  
  // 前往作者介绍页面
  goToAuthorInfo: function() {
    if (!this.data.hasSelectedCourse) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse?.article?._id;
    if (articleId) {
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=author`
      });
    } else {
      wx.showToast({
        title: '课文信息有误',
        icon: 'none'
      });
    }
  },

  // 关闭公告
  closeNotice() {
    this.setData({ noticeClosed: true });
    wx.setStorageSync('noticeClosed', true);
  },

  // 点击公告
  onNoticeTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({
        url: `/miniprogram/pages/webview/index?url=${encodeURIComponent(url)}`
      });
    }
  },

  // 启动公告循环
  startNoticeLoop() {
    if (this.data.noticeList.length === 0) return;
    this.showCurrentNotice();
  },

  // 显示当前公告
  showCurrentNotice() {
    this.setData({
      currentNotice: this.data.noticeList[this.data.currentNoticeIndex]
    }, () => {
      this.checkAndScroll();
    });
  },

  // 检查并滚动公告
  checkAndScroll() {
    // 获取公告内容宽度
    const query = wx.createSelectorQuery();
    query.select('.notice-content').boundingClientRect();
    query.select('.notice-bar').boundingClientRect();

    query.exec(res => {
      if (!res[0] || !res[1]) return;
      
      const contentWidth = res[0].width;
      const containerWidth = res[1].width - 60; // 减去图标和间距的宽度
      
      if (contentWidth > containerWidth) {
        // 计算滚动时间和距离
        const duration = contentWidth / 50; // 50rpx/s的速度
        const distance = -contentWidth - 20; // 额外的20rpx确保完全滚出
        
        this.setData({
          marqueeState: 'scroll',
          marqueeDuration: duration,
          marqueeTranslateX: distance
        });
        
        // 滚动结束后，重置并滚动下一条
        this.data.marqueeTimer = setTimeout(() => {
          this.nextNotice();
        }, duration * 1000 + 1000); // 多等待1秒，确保完全滚动完
      } else {
        // 内容不需要滚动，3秒后切换到下一条
        this.data.marqueeTimer = setTimeout(() => {
          this.nextNotice();
        }, 3000);
      }
    });
  },

  // 切换到下一条公告
  nextNotice() {
    if (this.data.marqueeTimer) {
      clearTimeout(this.data.marqueeTimer);
      this.data.marqueeTimer = null;
    }
    
    let nextIndex = this.data.currentNoticeIndex + 1;
    if (nextIndex >= this.data.noticeList.length) {
      nextIndex = 0;
    }
    
    this.setData({
      currentNoticeIndex: nextIndex,
      marqueeState: 'pause',
      marqueeTranslateX: 0
    }, () => {
      setTimeout(() => {
        this.showCurrentNotice();
      }, 100);
    });
  },

  // 页面卸载时清除定时器
  onUnload() {
    if (this.data.marqueeTimer) {
      clearTimeout(this.data.marqueeTimer);
      this.data.marqueeTimer = null;
    }
  }
}) 