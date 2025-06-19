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
    noticeList: [],
    currentNoticeIndex: 0,
    currentNotice: {},
    marqueeState: 'pause', // 'pause' or 'scroll'
    marqueeDuration: 0,
    marqueeTranslateX: 0,
    marqueeTimer: null,
    noticeClosed: false,
    showNoticeDetail: false, // 新增：是否显示公告详情弹窗
    // 是否已选择课文
    hasSelectedCourse: false,
    // 当前选择的课文信息
    selectedCourse: null,
    // 课文数据加载状态
    courseLoading: true,
    audioContext: null,
    audioPlaying: false,
    audioCurrent: 0,
    audioDuration: 0,
    audioSpeed: 1.0,
    audioSpeedList: [0.75, 1.0, 1.25, 1.5],
    audioSeeking: false
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
  },

  onShow: function () {
    // 每次显示页面时更新用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const wasLoggedIn = this.data.hasUserInfo;
    const isLoggedIn = !!userInfo;
    
    // 更新用户信息
    this.getUserInfo();
    
    // 检查本地存储中的课文信息是否有更新
    const selectedCourse = wx.getStorageSync('selectedCourse');
    const currentSelectedCourse = this.data.selectedCourse;
    
    // 判断课文是否发生变化
    let courseChanged = false;
    if (selectedCourse && selectedCourse.article) {
      if (!currentSelectedCourse || !currentSelectedCourse.article) {
        courseChanged = true;
      } else if (selectedCourse.article._id !== currentSelectedCourse.article._id) {
        courseChanged = true;
      }
    }
    
    // 如果课文发生了变化，强制重新加载
    if (courseChanged) {
      console.log('检测到课文已更换，重新加载课文数据');
      this.checkSelectedCourse();
      return;
    }
    
    // 如果登录状态发生变化
    if (wasLoggedIn !== isLoggedIn) {
      if (isLoggedIn) {
        // 用户登录后，获取最近学习的文章
        this.getLastStudy();
        // 检查是否有最近学习的文章，如果有则显示
        this.checkSelectedCourse();
      } else {
        // 用户退出登录后，清空选择的课文，显示初始界面
        this.setData({
          hasSelectedCourse: false,
          selectedCourse: null,
          courseLoading: false
        });
        // 清除本地存储的课文信息
        wx.removeStorageSync('selectedCourse');
      }
    } else {
      // 登录状态未变且课文未变，正常检查选择的课文
      this.checkSelectedCourse();
    }
    
    // 额外检查：如果没有用户信息，确保显示默认头像
    if (!this.data.hasUserInfo && (!this.data.userInfo || !this.data.userInfo.avatarUrl)) {
      const mockUserInfo = {
        nickname: '欢迎新同学！',
        avatarUrl: '/images/default-avatar.png'
      };
      
      this.setData({
        userInfo: mockUserInfo
      });
    }
  },
  
  // 检查是否已选择课文
  checkSelectedCourse: function() {
    this.setData({ courseLoading: true });
    console.log('开始检查选择的课文');
    
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = !!userInfo;
    console.log('用户登录状态:', isLoggedIn);
    
    // 先获取本地存储的选中课文，优先使用本地存储的最新选择
    const selectedCourse = wx.getStorageSync('selectedCourse');
    if (selectedCourse && selectedCourse.article) {
      console.log('找到已选择的课文:', selectedCourse);
      
      // 先设置本地缓存的课文数据，确保hasSelectedCourse为true
      this.setData({
        hasSelectedCourse: true,
        selectedCourse: selectedCourse,
        currentGrade: selectedCourse.grade || this.data.currentGrade,
        currentLesson: selectedCourse.article.title || this.data.currentLesson
      });
      
      // 优先使用article_id查询
      if (selectedCourse.article.article_id) {
        // 如果有article_id字段，优先使用它查询
        this.fetchArticleByArticleId(selectedCourse.article.article_id, selectedCourse);
        return;
      } else if (selectedCourse.article._id) {
        // 如果只有_id，作为备用方案
        this.fetchArticleFromCloud(selectedCourse.article._id, selectedCourse);
        return;
      }
    }
    
    // 如果没有本地存储的课文，且用户已登录，尝试使用最近学习的文章
    if (isLoggedIn && this.data.lastStudy && this.data.lastStudy.article && this.data.lastStudy.article._id) {
      console.log('使用最近学习的文章:', this.data.lastStudy);
      
      // 使用最近学习的文章ID查询完整信息
      const articleId = this.data.lastStudy.articleId || this.data.lastStudy.article._id;
      console.log('最近学习的文章ID:', articleId);
      
      // 优先使用article_id查询
      if (articleId) {
        // 先设置一个临时的课文数据，确保hasSelectedCourse为true
        this.setData({
          hasSelectedCourse: true,
          selectedCourse: {
            article: this.data.lastStudy.article,
            grade: this.data.lastStudy.article.grade ? 
                  `${this.data.lastStudy.article.grade}${this.data.lastStudy.article.semester || ''}` : 
                  '未知年级'
          }
        });
        
        // 然后再异步获取完整数据
        this.fetchArticleByArticleId(articleId, {
          article: this.data.lastStudy.article,
          grade: this.data.lastStudy.article.grade ? 
                `${this.data.lastStudy.article.grade}${this.data.lastStudy.article.semester || ''}` : 
                '未知年级'
        });
        return;
      }
    }
    
    // 如果既没有本地存储的课文，也没有最近学习的文章，显示未选择状态
    console.log('未找到已选择的课文');
    this.setData({
      hasSelectedCourse: false,
      selectedCourse: null,
      courseLoading: false
    });
  },
  
  // 通过article_id从云数据库获取课文数据（优先方法）
  fetchArticleByArticleId: function(articleId, selectedCourse) {
    console.log('尝试通过article_id获取课文:', articleId);
    
    // 确保articleId是字符串类型
    const articleIdStr = String(articleId);
    console.log('转换后的article_id:', articleIdStr);
    
    const db = wx.cloud.database();
    
    db.collection('articles')
      .where({
        article_id: articleIdStr
      })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          console.log('成功通过article_id获取到课文数据:', res.data[0]);
          
          // 获取到课文数据
          const articleData = res.data[0];
          
          // 确保article_id字段存在
          if (!articleData.article_id) {
            articleData.article_id = articleIdStr;
          }
          
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
          
          // 检查更新后的状态
          console.log('更新后的课文选择状态:', {
            hasSelectedCourse: this.data.hasSelectedCourse,
            selectedCourse: this.data.selectedCourse
          });
          
          if (articleData && articleData.audio) { this.initAudioPlayer(); }
        } else {
          console.log('通过article_id未找到课文，尝试通过_id查询');
          // 尝试通过_id查询（作为备用方案）
          if (selectedCourse.article._id) {
            this.fetchArticleFromCloud(selectedCourse.article._id, selectedCourse);
          } else {
            // 查询失败，使用本地缓存数据
            this.useLocalCourseData(selectedCourse);
          }
        }
      })
      .catch(err => {
        console.error('通过article_id获取课文失败:', err);
        // 尝试通过_id查询（作为备用方案）
        if (selectedCourse.article._id) {
          this.fetchArticleFromCloud(selectedCourse.article._id, selectedCourse);
        } else {
          // 查询失败，使用本地缓存数据
          this.useLocalCourseData(selectedCourse);
        }
      });
  },
  
  // 通过_id从云数据库获取课文数据（备用方法）
  fetchArticleFromCloud: function(articleId, selectedCourse) {
    console.log('尝试通过_id获取课文:', articleId);
    const db = wx.cloud.database();
    
    db.collection('articles').doc(articleId).get()
      .then(res => {
        if (res.data) {
          console.log('成功获取到课文数据:', res.data);
          
          // 获取到课文数据
          const articleData = res.data;
          
          // 确保article_id字段存在
          if (!articleData.article_id) {
            articleData.article_id = articleData._id;
          }
          
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
          
          // 检查更新后的状态
          console.log('更新后的课文选择状态:', {
            hasSelectedCourse: this.data.hasSelectedCourse,
            selectedCourse: this.data.selectedCourse
          });
          
          if (articleData && articleData.audio) { this.initAudioPlayer(); }
        } else {
          console.log('未找到课文数据，使用本地缓存');
          // 使用本地缓存数据
          this.useLocalCourseData(selectedCourse);
        }
      })
      .catch(err => {
        console.error('获取课文详情失败:', err);
        // 查询失败，使用本地缓存数据
        this.useLocalCourseData(selectedCourse);
      });
  },
  
  // 使用本地缓存的课文数据
  useLocalCourseData: function(selectedCourse) {
    console.log('使用本地缓存的课文数据:', selectedCourse);
    
    // 确保article对象存在且有必要的字段
    if (selectedCourse && selectedCourse.article) {
      // 确保article_id字段存在
      if (!selectedCourse.article.article_id && selectedCourse.article._id) {
        selectedCourse.article.article_id = selectedCourse.article._id;
      }
      
      this.setData({
        hasSelectedCourse: true,
        selectedCourse: selectedCourse,
        currentGrade: selectedCourse.grade || this.data.currentGrade,
        currentLesson: selectedCourse.article.title || this.data.currentLesson,
        courseLoading: false
      });
      
      // 检查更新后的状态
      console.log('更新后的课文选择状态:', {
        hasSelectedCourse: this.data.hasSelectedCourse,
        selectedCourse: this.data.selectedCourse
      });
    } else {
      // 数据无效，设置为未选择状态
      console.log('本地缓存数据无效');
      this.setData({
        hasSelectedCourse: false,
        selectedCourse: null,
        courseLoading: false
      });
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
    // 从本地存储获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    
    if (userInfo) {
      // 用户已登录，使用数据库中的用户信息
      console.log('首页获取到用户信息:', userInfo);
      this.setData({
        greeting: this.getGreeting(),
        nickname: userInfo.nickname || '文言同学',
        userInfo: userInfo,
        hasUserInfo: true
      });
    } else if (app.globalData.hasUserInfo && app.globalData.userInfo) {
      // 兼容全局数据
      this.setData({
        greeting: this.getGreeting(),
        nickname: app.globalData.userInfo.nickname || '同学',
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      });
    } else {
      // 用户未登录，使用默认值
      // 优先使用全局默认用户信息
      const mockUserInfo = app.globalData.defaultUserInfo || {
        nickname: '新同学',
        avatarUrl: '/images/default-avatar.png'
      };
      
      // 未登录用户使用"欢迎新同学"的问候语，但保留时间段问候语
      const timeGreeting = this.getGreeting();
      
      // 确保每次都设置完整的用户信息，包括默认头像
      this.setData({
        greeting: timeGreeting,
        nickname: '新同学',
        userInfo: mockUserInfo,
        hasUserInfo: false
      });
      
      // 将默认用户信息保存到全局，确保页面切换后能恢复
      if (!app.globalData.defaultUserInfo) {
        app.globalData.defaultUserInfo = mockUserInfo;
      }
    }
    
    // 额外检查：确保头像始终存在
    if (!this.data.userInfo || !this.data.userInfo.avatarUrl) {
      this.setData({
        userInfo: {
          ...this.data.userInfo,
          avatarUrl: '/images/default-avatar.png'
        }
      });
    }
  },

  // 获取最近学习的文章
  getLastStudy: function () {
    // 首先尝试调用云函数获取最新的学习记录
    wx.cloud.callFunction({
      name: 'getUserArticleRecords',
      data: {
        type: 'latest'
      },
      success: res => {
        console.log('获取最新学习记录成功:', res.result);
        
        if (res.result.success && res.result.data) {
          const record = res.result.data.record;
          const article = res.result.data.article;
          
          if (record && article) {
            // 格式化最后学习时间
            const lastLearnTime = new Date(record.last_learn_time);
            const timeStr = util.timeAgo(lastLearnTime);
            
            // 构建学习记录对象
            const lastStudyRecord = {
              article: {
                _id: article._id || record.article_id,
                title: article.title || '未知文章',
                author: article.author || '未知作者',
                dynasty: article.dynasty || '',
              },
              position: {
                section_type: '文章详情',
                section_index: 0
              },
              progress: record.learn_status === 2 ? 100 : (record.learn_status === 1 ? 50 : 0),
              time: timeStr,
              articleId: record.article_id // 保存原始article_id，便于跳转
            };
            
            this.setData({
              lastStudy: lastStudyRecord
            });
            
            // 同时更新本地缓存
            wx.setStorageSync('lastStudyRecord', lastStudyRecord);
            return;
          }
        }
        
        // 如果云函数未返回数据，尝试从本地存储获取
        this.getLastStudyFromLocal();
      },
      fail: err => {
        console.error('获取最新学习记录失败:', err);
        // 调用云函数失败，尝试从本地存储获取
        this.getLastStudyFromLocal();
      }
    });
  },
  
  // 从本地存储获取最近学习的记录
  getLastStudyFromLocal: function() {
    try {
      const lastStudyRecord = wx.getStorageSync('lastStudyRecord');
      if (lastStudyRecord) {
        this.setData({
          lastStudy: lastStudyRecord
        });
        return;
      }
    } catch (e) {
      console.error('获取本地学习记录失败:', e);
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
    // 调用云函数获取名句数据
    wx.cloud.callFunction({
      name: 'getRandomQuote',
      data: {},
      success: res => {
        console.log('云函数获取名句结果:', res.result);
        
        if (res.result && res.result.success && res.result.data) {
          this.setData({
            famousQuote: res.result.data
          });
          
          // 检查是否已收藏
          if (res.result.data._id) {
            this.checkQuoteCollectionStatus(res.result.data._id);
          }
        } else {
          // 获取失败，尝试直接从数据库获取
          this.getQuoteFromDatabase();
        }
      },
      fail: err => {
        console.error('云函数获取名句失败:', err);
        // 获取失败，尝试直接从数据库获取
        this.getQuoteFromDatabase();
      }
    });
  },
  
  // 从数据库直接获取名句（备用方法）
  getQuoteFromDatabase: function() {
    const db = wx.cloud.database();
    
    // 获取名句总数
    db.collection('famous_quotes').count()
      .then(res => {
        if (res.total <= 0) {
          console.error('数据库中没有名句数据');
          wx.showToast({
            title: '暂无名句数据',
            icon: 'none'
          });
          return;
        }
        
        // 生成随机索引
        const randomIndex = Math.floor(Math.random() * res.total);
        
        // 使用skip和limit获取随机名句
        return db.collection('famous_quotes')
          .skip(randomIndex)
          .limit(1)
          .get();
      })
      .then(res => {
        if (res && res.data && res.data.length > 0) {
          console.log('成功从数据库获取名句:', res.data[0]);
          this.setData({
            famousQuote: res.data[0]
          });
          
          // 检查是否已收藏
          this.checkQuoteCollectionStatus(res.data[0]._id);
        } else if (res) {
          // 数据库中没有数据
          console.error('数据库中没有名句数据');
          wx.showToast({
            title: '暂无名句数据',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        console.error('获取名句失败:', err);
        wx.showToast({
          title: '获取名句失败',
          icon: 'none'
        });
      });
  },
  
  // 刷新名句
  refreshQuote: function() {
    this.getRandomFamousQuote();
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
      url: '/pages/course/select/select'
    });
  },
  
  // 开始学习（新增方法，用于未选择课文时跳转到课文选择页）
  startLearning: function() {
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      // 未登录，先跳转到"我的"页面，然后再显示提示
      wx.switchTab({
        url: '/pages/my/index/index',
        success: () => {
          // 页面跳转成功后再显示提示
          setTimeout(() => {
            wx.showToast({
              title: '请登录\n以便帮你记录学习进度',
              icon: 'none',
              duration: 2000
            });
          }, 500); // 延迟500毫秒显示提示，确保页面已经跳转
        }
      });
      return;
    }
    
    // 已登录，正常跳转到课文选择页
    wx.navigateTo({
      url: '/pages/course/select/select?fromHome=true'
    });
  },

  // 前往课文讲解
  goToArticleExplain: function() {
    wx.navigateTo({
      url: '/pages/article/explain'
    });
  },

  // 前往逐句解析
  goToSentenceAnalysis: function() {
    // 添加调试日志
    console.log('当前课文选择状态:', {
      hasSelectedCourse: this.data.hasSelectedCourse,
      selectedCourse: this.data.selectedCourse
    });
    
    if (!this.data.hasSelectedCourse || !this.data.selectedCourse || !this.data.selectedCourse.article) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse.article._id;
    if (articleId) {
      // 记录功能点击
      this.recordFunctionClick(articleId, 2); // 2 - 逐句解析
      
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=analysis&auto=true`
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
    // 添加调试日志
    console.log('当前课文选择状态:', {
      hasSelectedCourse: this.data.hasSelectedCourse,
      selectedCourse: this.data.selectedCourse
    });
    
    if (!this.data.hasSelectedCourse || !this.data.selectedCourse || !this.data.selectedCourse.article) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse.article._id;
    if (articleId) {
      // 记录功能点击
      this.recordFunctionClick(articleId, 1); // 1 - 全文翻译
      
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=translation&auto=true`
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
    // 添加调试日志
    console.log('当前课文选择状态:', {
      hasSelectedCourse: this.data.hasSelectedCourse,
      selectedCourse: this.data.selectedCourse
    });
    
    if (!this.data.hasSelectedCourse || !this.data.selectedCourse || !this.data.selectedCourse.article) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse.article._id;
    if (articleId) {
      // 记录功能点击
      this.recordFunctionClick(articleId, 4); // 4 - 背景知识
      
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=background&auto=true`
      });
    } else {
      wx.showToast({
        title: '课文信息有误',
        icon: 'none'
      });
    }
  },

  // 前往练习巩固
  goToExercise: function() {
    // 添加调试日志
    console.log('当前课文选择状态:', {
      hasSelectedCourse: this.data.hasSelectedCourse,
      selectedCourse: this.data.selectedCourse
    });
    
    if (!this.data.hasSelectedCourse || !this.data.selectedCourse || !this.data.selectedCourse.article) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse.article._id;
    if (articleId) {
      // 记录功能点击
      this.recordFunctionClick(articleId, 5); // 5 - 练习巩固
      
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=exercise&auto=true`
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
    // 添加调试日志
    console.log('当前课文选择状态:', {
      hasSelectedCourse: this.data.hasSelectedCourse,
      selectedCourse: this.data.selectedCourse
    });
    
    if (!this.data.hasSelectedCourse || !this.data.selectedCourse || !this.data.selectedCourse.article) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse.article._id;
    if (articleId) {
      // 记录功能点击
      this.recordFunctionClick(articleId, 6); // 6 - AI互动
      
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=qa&auto=true`
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
      url: '/pages/article/recite'
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
      url: '/pages/article/listen'
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
      url: '/pages/article/read'
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
      url: '/pages/article/appreciation'
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
      url: '/pages/article/annotation'
    });
  },

  // 前往课文选择页
  goToArticleList: function () {
    wx.navigateTo({
      url: '/pages/course/select/select'
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

  // 收藏名句
  collectQuote: function() {
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
    wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    const quote = this.data.famousQuote;
    if (!quote) {
      wx.showToast({
        title: '名句数据不存在',
        icon: 'none'
      });
      return;
    }
    
    // 判断是收藏还是取消收藏
    if (quote.isCollected) {
      // 取消收藏
      wx.cloud.callFunction({
        name: 'userFavorite',
        data: {
          action: 'remove',
          type: 'quote',
          id: quote._id
        },
        success: res => {
          console.log('取消收藏成功:', res.result);
          
          if (res.result.success) {
            // 更新本地数据
            const updatedQuote = { ...quote, isCollected: false };
            this.setData({
              famousQuote: updatedQuote
            });
            
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
        }
      });
    } else {
      // 添加收藏
      wx.cloud.callFunction({
        name: 'userFavorite',
        data: {
          action: 'add',
          type: 'quote',
          id: quote._id,
          data: {
            content: quote.content,
            source: quote.source,
            author: quote.author,
            dynasty: quote.dynasty,
            translation: quote.translation
          }
        },
        success: res => {
          console.log('收藏成功:', res.result);
          
          if (res.result.success) {
            // 更新本地数据
            const updatedQuote = { ...quote, isCollected: true };
            this.setData({
              famousQuote: updatedQuote
            });
            
            wx.showToast({
              title: '收藏成功',
              icon: 'success'
            });
          } else {
            wx.showToast({
              title: res.result.message || '收藏失败',
              icon: 'none'
            });
          }
        },
        fail: err => {
          console.error('收藏失败:', err);
          wx.showToast({
            title: '收藏失败',
            icon: 'none'
          });
        }
      });
    }
  },

  // 检查名句收藏状态
  checkQuoteCollectionStatus: function(quoteId) {
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      return;
    }
    
    // 调用云函数检查收藏状态
    wx.cloud.callFunction({
      name: 'userFavorite',
      data: {
        action: 'check',
        type: 'quote',
        id: quoteId
      },
      success: res => {
        console.log('检查名句收藏状态:', res.result);
        
        if (res.result.success) {
          // 更新本地数据
          const updatedQuote = { 
            ...this.data.famousQuote, 
            isCollected: res.result.isFavorite 
          };
          
          this.setData({
            famousQuote: updatedQuote
          });
        }
      },
      fail: err => {
        console.error('检查名句收藏状态失败:', err);
      }
    });
  },

  // 跳转到名句详情页
  goToQuoteDetail: function() {
    if (!this.data.famousQuote) return;
    
    wx.navigateTo({
      url: `/pages/quote/detail/detail?id=${this.data.famousQuote._id}`
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
  
  // 前往作者介绍
  goToAuthorInfo: function() {
    // 添加调试日志
    console.log('当前课文选择状态:', {
      hasSelectedCourse: this.data.hasSelectedCourse,
      selectedCourse: this.data.selectedCourse
    });
    
    if (!this.data.hasSelectedCourse || !this.data.selectedCourse || !this.data.selectedCourse.article) {
      wx.showToast({
        title: '请先选择课文',
        icon: 'none'
      });
      return;
    }
    
    // 获取当前选择的课文ID
    const articleId = this.data.selectedCourse.article._id;
    if (articleId) {
      // 记录功能点击
      this.recordFunctionClick(articleId, 3); // 3 - 作者介绍
      
      wx.navigateTo({
        url: `/pages/article/detail/detail?id=${articleId}&tab=author&auto=true`
      });
    } else {
      wx.showToast({
        title: '课文信息有误',
        icon: 'none'
      });
    }
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

  // 显示公告详情
  showNoticeDetail(e) {
    // 阻止冒泡，避免触发onNoticeTap
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    // 显示详情弹窗
    this.setData({
      showNoticeDetail: true
    });
    
    // 暂停公告滚动
    if (this.data.marqueeTimer) {
      clearTimeout(this.data.marqueeTimer);
      this.data.marqueeTimer = null;
    }
  },
  
  // 关闭公告详情
  closeNoticeDetail() {
    this.setData({
      showNoticeDetail: false
    });
    
    // 恢复公告滚动
    this.showCurrentNotice();
  },
  
  // 阻止事件冒泡
  stopPropagation() {
    // 在小程序中，使用catchtap而不是这个函数来阻止事件冒泡
    // 这个函数仅用于配合catchtap使用
    return false;
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
    // 如果只有一条公告，并且已显示完成，则2秒后重新显示
    if (this.data.noticeList.length === 1) {
      // 获取公告内容宽度
      const query = wx.createSelectorQuery();
      query.select('.marquee-content').boundingClientRect();
      query.select('.notice-bar').boundingClientRect();

      query.exec(res => {
        if (!res[0] || !res[1]) return;
        
        const contentWidth = res[0].width;
        const containerWidth = res[1].width - 40; // 减去图标和间距的宽度（移除关闭按钮后从60改为40）
        
        if (contentWidth > containerWidth) {
          // 计算需要滚动的距离，确保"查看详情"按钮完全显示
          // 比实际需要的距离少滚动一些，保留更多空间（大约80rpx的余量）
          const distance = -(contentWidth - containerWidth + 50);
          
          // 计算滚动时间，保持速度一致
          const duration = Math.abs(distance) / 50; // 50rpx/s的速度
          
          this.setData({
            marqueeState: 'scroll',
            marqueeDuration: duration,
            marqueeTranslateX: distance
          });
          
          // 滚动结束后，停留2秒，然后重置位置重新开始
          this.data.marqueeTimer = setTimeout(() => {
            this.setData({
              marqueeState: 'pause',
              marqueeTranslateX: 0
            }, () => {
              // 等待2秒后再次滚动
              this.data.marqueeTimer = setTimeout(() => {
                this.showCurrentNotice();
              }, 4000);
            });
          }, duration * 1000 + 2000); // 滚动时间加上2秒停留时间
        } else {
          // 内容不需要滚动，2秒后重置
          this.data.marqueeTimer = setTimeout(() => {
            this.setData({
              marqueeState: 'pause',
              marqueeTranslateX: 0
            }, () => {
              // 等待2秒后再次显示
              this.data.marqueeTimer = setTimeout(() => {
                this.showCurrentNotice();
              }, 2000);
            });
          }, 2000);
        }
      });
    } else {
      // 多条公告时的处理
      const query = wx.createSelectorQuery();
      query.select('.marquee-content').boundingClientRect();
      query.select('.notice-bar').boundingClientRect();

      query.exec(res => {
        if (!res[0] || !res[1]) return;
        
        const contentWidth = res[0].width;
        const containerWidth = res[1].width - 40; // 减去图标和间距的宽度（移除关闭按钮后从60改为40）
        
        if (contentWidth > containerWidth) {
          // 计算需要滚动的距离，确保"查看详情"按钮完全显示
          // 比实际需要的距离少滚动一些，保留更多空间（大约80rpx的余量）
          const distance = -(contentWidth - containerWidth - 80);
          
          // 计算滚动时间，保持速度一致
          const duration = Math.abs(distance) / 50; // 50rpx/s的速度
          
          this.setData({
            marqueeState: 'scroll',
            marqueeDuration: duration,
            marqueeTranslateX: distance
          });
          
          // 滚动结束后，停留2秒，然后切换到下一条
          this.data.marqueeTimer = setTimeout(() => {
            this.nextNotice();
          }, duration * 1000 + 2000); // 滚动时间加上2秒停留时间
        } else {
          // 内容不需要滚动，2秒后切换到下一条
          this.data.marqueeTimer = setTimeout(() => {
            this.nextNotice();
          }, 2000);
        }
      });
    }
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
    if (this.data.audioContext) {
      this.data.audioContext.destroy();
    }
  },

  initAudioPlayer: function() {
    // 先设置初始值为0，确保进度条圆点在最左侧
    this.setData({ audioCurrent: 0, audioDuration: 0, audioPlaying: false, audioSpeed: 1.0 });
    
    if (this.data.audioContext) {
      this.data.audioContext.destroy();
    }
    const audioUrl = this.data.selectedCourse?.article?.audio;
    if (!audioUrl) return;
    const ctx = wx.createInnerAudioContext();
    ctx.src = audioUrl;
    ctx.obeyMuteSwitch = false;
    // 设置音频保持原音调
    ctx.playbackRate = this.data.audioSpeed || 1.0;
    ctx.preservesPitch = true; // 保持音调不变
    
    ctx.onCanplay(() => {
      setTimeout(() => {
        this.setData({ audioDuration: ctx.duration || 0 });
      }, 200);
    });
    ctx.onTimeUpdate(() => {
      if (!this.data.audioSeeking) {
        this.setData({ audioCurrent: ctx.currentTime, audioDuration: ctx.duration });
      }
    });
    ctx.onEnded(() => {
      this.setData({ audioPlaying: false, audioCurrent: 0 });
    });
    this.setData({ audioContext: ctx });
  },

  onAudioPlay: function() {
    if (!this.data.audioContext) return;
    this.data.audioContext.play();
    this.setData({ audioPlaying: true });
  },
  onAudioPause: function() {
    if (!this.data.audioContext) return;
    this.data.audioContext.pause();
    this.setData({ audioPlaying: false });
  },
  onAudioStop: function() {
    if (!this.data.audioContext) return;
    this.data.audioContext.stop();
    this.setData({ audioPlaying: false, audioCurrent: 0 });
  },
  onAudioSpeedChange: function(e) {
    const speed = e.currentTarget.dataset.speed;
    if (!this.data.audioContext) return;
    
    // 设置播放速度并保持音调不变
    this.data.audioContext.playbackRate = speed;
    this.data.audioContext.preservesPitch = true; // 保持音调不变
    
    this.setData({ audioSpeed: speed });
    
    // 如果正在播放，显示提示
    if (this.data.audioPlaying) {
      wx.showToast({
        title: `${speed}x 速度`,
        icon: 'none',
        duration: 1000
      });
    }
  },
  onAudioSliderChange: function(e) {
    const value = e.detail.value;
    if (!this.data.audioContext) return;
    this.setData({ audioSeeking: true });
    this.data.audioContext.seek(value);
    setTimeout(() => {
      this.setData({ audioCurrent: value, audioSeeking: false });
    }, 200);
  },

  // 记录功能点击状态
  recordFunctionClick: function(articleId, functionIndex) {
    // 功能索引对应的功能名称
    const functionNames = {
      1: '全文翻译',
      2: '逐句解析',
      3: '作者介绍',
      4: '背景知识',
      5: '练习巩固',
      6: 'AI互动'
    };
    
    console.log(`首页点击功能: ${functionNames[functionIndex]}`);
    
    // 调用云函数记录功能点击
    wx.cloud.callFunction({
      name: 'updateFunctionClick',
      data: {
        articleId: articleId,
        functionIndex: functionIndex
      },
      success: res => {
        console.log('更新功能点击状态成功:', res.result);
      },
      fail: err => {
        console.error('更新功能点击状态失败:', err);
      }
    });
  },
  
  // 处理欢迎区域点击事件
  onWelcomeCardTap: function() {
    // 检查用户是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      // 未登录，跳转到"我的"页面并提示登录
      wx.switchTab({
        url: '/pages/my/index/index',
        success: () => {
          // 页面跳转成功后显示提示
          setTimeout(() => {
            wx.showToast({
              title: '请登录后使用更多功能',
              icon: 'none',
              duration: 2000
            });
          }, 500); // 延迟500毫秒显示提示，确保页面已经跳转
        }
      });
    }
    // 如果用户已登录，则不做任何操作
  },
}) 