const app = getApp();
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    loading: true,
    
    // 学习进度数据
    totalCount: 0,
    learnedCount: 0,
    masteredCount: 0,
    reviewCount: 0,
    continuousDays: 0,
    progressPercent: '0%',
    
    // 分类数据
    highSchoolRealCount: 0,
    highSchoolVirtualCount: 0,
    middleSchoolRealCount: 0,
    middleSchoolVirtualCount: 0,
    
    highSchoolRealPercent: '0%',
    highSchoolVirtualPercent: '0%',
    middleSchoolRealPercent: '0%',
    middleSchoolVirtualPercent: '0%',
    
    learned: 0,
    toReview: 0,
    inProgress: 0,
    toLearn: 0, // 待学习（未学习）的词条数量
    categories: [
      { name: '高考实词', count: 0, type: '高考实词合集' },
      { name: '高考虚词', count: 0, type: '高考虚词合集' },
      { name: '中考实词', count: 0, type: '中考实词合集' },
      { name: '中考虚词', count: 0, type: '中考虚词合集' }
    ],
    isLoading: false, // 改为默认不显示加载状态
    error: null,
    isLoggedIn: false, // 是否已登录
    selectedCollection: '高考实词合集', // 当前选中合集
    dailyWord: null // 每日一词数据
  },

  onLoad: function(options) {
    console.log('首页加载');
    
    // 检查云环境是否正确初始化
    if (!wx.cloud) {
      this.setData({
        error: '云开发未初始化，请检查基础库版本',
        isLoading: false
      });
      return;
    }
    
    // 记录当前云环境
    const currentEnv = wx.cloud.DYNAMIC_CURRENT_ENV || '未获取到环境ID';
    console.log('当前云环境:', currentEnv);
    
    this.checkLoginStatus();
    
    // 加载每日一词
    this.loadDailyWord();
  },
  
  onShow: function() {
    if (typeof this.getTabBar === 'function' &&
      this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      })
    }
    this.checkLoginStatus();
    
    // 更新学习统计
    this.updateLearningStats();
    
    // 每次页面显示时刷新数据
    this.loadUserProgress();
    
    // 刷新分类数量
    this.loadCategoryCounts();
  },
  
  // 加载页面数据
  loadData: function() {
    Promise.all([
      this.loadCategoryCounts(),
      this.updateLearningStats()
    ]).then(() => {
      console.log('数据加载完成');
    }).catch(err => {
      console.error('加载数据失败:', err);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    });
  },
  
  // 加载每日一词
  loadDailyWord: function() {
    // 根据登录状态和选择的分类获取词条
    const category = this.data.isLoggedIn ? this.data.selectedCollection : '中考实词合集';
    
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'getRandomWord',
        category: category
      }
    })
    .then(res => {
      console.log('获取每日一词成功:', res.result);
      if (res.result && res.result.success && res.result.data) {
        this.setData({
          dailyWord: res.result.data
        });
      } else {
        console.warn('获取每日一词失败:', res.result);
        wx.showToast({
          title: '获取词条失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('获取每日一词出错:', err);
      wx.showToast({
        title: '获取词条出错',
        icon: 'none'
      });
    });
  },
  
  // 刷新每日一词
  refreshDailyWord: function(e) {
    // 阻止事件冒泡，避免触发卡片的点击事件
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    this.loadDailyWord();
  },
  
  // 查看词条详情
  viewWordDetail: function(e) {
    const wordId = e.currentTarget.dataset.wordId;
    const category = this.data.dailyWord.collection || this.data.selectedCollection;
    
    console.log('点击每日一词:', {
      wordId: wordId,
      category: category
    });
    
    if (!wordId) {
      console.error('词条ID无效');
      wx.showToast({
        title: '词条ID无效',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到study页面，与word-list页面的跳转逻辑保持一致
    const url = `/pages/word-learning/study/study?wordId=${encodeURIComponent(wordId)}&category=${encodeURIComponent(category)}`;
    console.log('准备跳转到:', url);
    
    wx.navigateTo({
      url: url,
      success: () => {
        console.log('跳转成功');
      },
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none'
        });
      }
    });
  },
  
  // 加载各分类的词条数量
  loadCategoryCounts: function() {
    console.log('开始加载分类数量');
    
    const categories = [
      { name: '中考实词', type: '中考实词合集' },
      { name: '中考虚词', type: '中考虚词合集' },
      { name: '高考实词', type: '高考实词合集' },
      { name: '高考虚词', type: '高考虚词合集' }
    ];
    
    // 使用Promise.all并行获取各个分类的数据
    Promise.all(categories.map(category => {
      return new Promise((resolve) => {
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
            type: 'getCategoryInfo',
            category: category.type
      }
    })
    .then(res => {
          if (res.result && res.result.success && res.result.total) {
            console.log(`分类 ${category.name} 词条数: ${res.result.total}`);
            resolve({ ...category, count: res.result.total });
          } else {
            console.warn(`获取分类 ${category.name} 数量失败:`, res.result);
            resolve({ ...category, count: 0 });
          }
        })
        .catch(err => {
          console.error(`获取分类 ${category.name} 数量出错:`, err);
          resolve({ ...category, count: 0 });
        });
      });
    }))
    .then(results => {
      console.log('所有分类数量获取完成:', results);
        this.setData({
        categories: results
      }, () => {
        console.log('分类数据已设置到页面:', this.data.categories);
        });
    })
    .catch(err => {
      console.error('获取分类数量出错:', err);
      this.setData({
        categories: categories.map(cat => ({ ...cat, count: 0 })),
        error: '获取分类数量失败'
      });
    });
  },
  
  // 加载用户学习进度（优先云端）
  loadUserProgress: function() {
    const selectedCollection = this.data.selectedCollection;
    const userInfo = wx.getStorageSync('userInfo');
    if (this.data.isLoggedIn && userInfo && userInfo.openid) {
      // 云端拉取
      wx.cloud.callFunction({
        name: 'getUserWordProgress',
        data: {
          userId: userInfo.openid,
          collection: selectedCollection
        },
        success: res => {
          if (res.result && res.result.success) {
            // 云端数据
            const progressArr = res.result.data || [];
            // 同步写入本地缓存
            const allProgress = wx.getStorageSync('wordLearningProgress') || {};
            progressArr.forEach(item => {
              allProgress[item.wordId] = {
                status: item.status,
                lastStudied: new Date(item.lastStudied).getTime(),
                collection: item.collection
              };
            });
            wx.setStorageSync('wordLearningProgress', allProgress);
            // 只统计当前分类
            const filtered = progressArr.filter(item => item.collection === selectedCollection);
            const learned = filtered.filter(item => item.status === 'learned').length;
            const toReview = filtered.filter(item => item.status === 'review').length;
            const inProgress = filtered.filter(item => item.status === 'learning').length;
            
            // 获取当前分类的总词条数
            const categoryInfo = this.data.categories.find(cat => cat.type === selectedCollection);
            const totalCount = categoryInfo ? categoryInfo.count : 0;
            // 计算待学习的词条数量
            const toLearn = totalCount - (learned + toReview + inProgress);
            
            this.setData({
              learned,
              toReview,
              inProgress,
              toLearn: Math.max(0, toLearn), // 确保不为负数
              isLoading: false
            });
          } else {
            this.loadUserProgressLocal();
          }
        },
        fail: err => {
          this.loadUserProgressLocal();
        }
      });
    } else {
      this.loadUserProgressLocal();
    }
  },
  
  // 本地加载学习进度
  loadUserProgressLocal: function() {
    const progress = wx.getStorageSync('wordLearningProgress') || {};
    const selectedCollection = this.data.selectedCollection;
    const filtered = Object.values(progress).filter(item => item.collection === selectedCollection);
    const learned = filtered.filter(item => item.status === 'learned').length;
    const toReview = filtered.filter(item => item.status === 'review').length;
    const inProgress = filtered.filter(item => item.status === 'learning').length;
    
    // 获取当前分类的总词条数
    const categoryInfo = this.data.categories.find(cat => cat.type === selectedCollection);
    const totalCount = categoryInfo ? categoryInfo.count : 0;
    // 计算待学习的词条数量
    const toLearn = totalCount - (learned + toReview + inProgress);
    
    this.setData({
      learned,
      toReview,
      inProgress,
      toLearn: Math.max(0, toLearn) // 确保不为负数
    });
  },
  
  // 更新学习统计
  updateLearningStats: function() {
    return new Promise((resolve) => {
      // 从本地存储获取学习历史
      const learnHistory = wx.getStorageSync('wordLearnHistory') || [];
      
      // 计算已学习、已掌握和待复习的数量
      const learnedCount = learnHistory.length;
      const masteredCount = learnHistory.filter(item => item.status === 'mastered').length;
      const reviewCount = learnHistory.filter(item => item.status === 'review').length;
      
      // 计算进度百分比
      const progressPercent = this.data.totalCount > 0 ? 
        `${(learnedCount / this.data.totalCount * 100).toFixed(0)}%` : '0%';
      
      // 计算连续学习天数
      const continuousDays = this.calculateContinuousDays(learnHistory);
      
      this.setData({
        learnedCount,
        masteredCount,
        reviewCount,
        progressPercent,
        continuousDays
      });
      
      resolve();
    });
  },
  
  // 计算连续学习天数
  calculateContinuousDays: function(learnHistory) {
    if (!learnHistory || learnHistory.length === 0) return 0;
    
    // 获取学习的日期（按天）
    const learningDays = new Set();
    
    learnHistory.forEach(item => {
      const time = item.updateTime || item.learnTime || '';
      if (time) {
        const date = new Date(time);
        const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        learningDays.add(dateStr);
      }
    });
    
    // 转为数组并按日期排序
    const sortedDays = Array.from(learningDays).sort();
    
    // 检查今天是否学习
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const hasStudiedToday = learningDays.has(todayStr);
    
    // 如果今天没学习，连续天数为0
    if (!hasStudiedToday) return 0;
    
    // 计算连续学习天数
    let continuousDays = 1; // 今天已学习，至少为1天
    
    // 从昨天开始往前检查
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    while (true) {
      const checkDate = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
      if (learningDays.has(checkDate)) {
        continuousDays++;
        yesterday.setDate(yesterday.getDate() - 1);
      } else {
        break;
      }
    }
    
    return continuousDays;
  },
  
  // 导航到学习页
  navigateToStudy: function(e) {
    const type = e.currentTarget.dataset.type;
    
    wx.navigateTo({
      url: `/pages/word-learning/study/study?examType=${type}`
    });
  },
  
  // 开始复习
  startReview: function() {
    wx.navigateTo({
      url: '/pages/word-learning/review/review'
    });
  },
  
  // 查看收藏词条
  viewBookmarks: function() {
    wx.navigateTo({
      url: '/pages/word-learning/bookmarks/bookmarks'
    });
  },
  
  // 查看学习统计
  viewStatistics: function() {
    wx.navigateTo({
      url: '/pages/word-learning/statistics/statistics'
    });
  },
  
  onShareAppMessage: function() {
    return {
      title: '文言文虚实词学习',
      path: '/pages/word-learning/index/index'
    };
  },
  
  // 点击分类跳转到词条列表页面
  onCategoryTap: function(e) {
    const type = e.currentTarget.dataset.type;
    console.log('点击分类:', type);
    
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    // 切换分类
    this.setData({ selectedCollection: type }, () => {
      this.loadUserProgress();
      // 更新每日一词
      this.loadDailyWord();
    });
    
    // 跳转到词条列表页面，带上 category 参数
    const url = `/pages/word-learning/word-list/word-list?category=${encodeURIComponent(type)}`;
    console.log('准备跳转到:', url);
    
    wx.navigateTo({
      url: url,
      success: () => {
        console.log('跳转成功');
      },
      fail: (err) => {
        console.error('跳转失败:', err);
        // 尝试使用switchTab（如果是tabBar页面）
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 跳转到继续学习
  continueStudy: function() {
    wx.navigateTo({
      url: '../study/study?mode=continue'
    });
  },
  

  
  // 跳转到学习统计
  viewStats: function() {
    wx.navigateTo({
      url: '../stats/stats'
    });
  },
  
  checkLoginStatus: function() {
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({
      isLoggedIn: !!userInfo
    });
    if (!!userInfo) {
      this.loadCategoryCounts();
      this.loadUserProgress();
    }
  },
  
  // 处理用户登录
  onGetUserInfo: function(e) {
    if (e.detail.userInfo) {
      // 用户允许授权
      const userInfo = e.detail.userInfo;
      
      // 调用云函数登录
      wx.cloud.callFunction({
        name: 'login',
        success: res => {
          userInfo.openid = res.result.openid;
          
          // 保存用户信息到本地
          wx.setStorageSync('userInfo', userInfo);
          
          // 更新页面状态
          this.setData({
            isLoggedIn: true
          });
          
          // 加载数据
          this.loadCategoryCounts();
          this.loadUserProgress();
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
        },
        fail: err => {
          console.error('登录失败', err);
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
        }
      });
    } else {
      // 用户拒绝授权
      wx.showToast({
        title: '需要授权才能使用完整功能',
        icon: 'none'
      });
    }
  },
  
  // 跳转到"我的"标签页
  navigateToMyPage: function() {
    wx.switchTab({
      url: '/pages/my/index/index'
    });
  },

  handleLoginPrompt: function() {
    wx.showModal({
      title: '提示',
      content: '请登录，以便记录学习状态',
      showCancel: true,
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          this.navigateToMyPage();
        }
      }
    });
  },
  
  getProgressByCollection: function(collection) {
    // 以当前合集统计学习进度
    if (!this.data.isLoggedIn) return;
    wx.cloud.callFunction({
      name: 'getUserProgress',
      data: { collection }
    }).then(res => {
      const { learned, toReview, inProgress } = res.result;
      this.setData({ learned, toReview, inProgress });
    });
  }
});
