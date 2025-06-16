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
    
    // 最近学习的词
    recentWords: [],
    
    learned: 0,
    toReview: 0,
    inProgress: 0,
    categories: [
      { name: '高考实词', count: 0, type: '高考实词合集' },
      { name: '高考虚词', count: 0, type: '高考虚词合集' },
      { name: '中考实词', count: 0, type: '中考实词合集' },
      { name: '中考虚词', count: 0, type: '中考虚词合集' }
    ],
    isLoading: true,
    error: null,
    isLoggedIn: false, // 是否已登录
    selectedCollection: '高考实词合集', // 当前选中合集
    searchValue: '', // 搜索框内容
    searchResults: [], // 搜索结果
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
  },
  
  onShow: function() {
    this.checkLoginStatus();
    // 刷新最近学习记录
    this.loadRecentWords();
    
    // 更新学习统计
    this.updateLearningStats();
    
    // 每次页面显示时刷新数据
    this.loadUserProgress();
    
    // 刷新分类数量
    this.loadCategoryCounts();
  },
  
  // 加载页面数据
  loadData: function() {
    this.setData({ loading: true });
    
    Promise.all([
      this.loadCategoryCounts(),
      this.loadRecentWords(),
      this.updateLearningStats()
    ]).then(() => {
      this.setData({ loading: false });
    }).catch(err => {
      console.error('加载数据失败:', err);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      this.setData({ loading: false });
    });
  },
  
  // 加载各分类的词条数量
  loadCategoryCounts: function() {
    console.log('开始加载分类数量');
    
    const categories = [
      { name: '高考实词', type: '高考实词合集' },
      { name: '高考虚词', type: '高考虚词合集' },
      { name: '中考实词', type: '中考实词合集' },
      { name: '中考虚词', type: '中考虚词合集' }
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
        categories: results,
        isLoading: false
      }, () => {
        console.log('分类数据已设置到页面:', this.data.categories);
        });
    })
    .catch(err => {
      console.error('获取分类数量出错:', err);
      this.setData({
        categories: categories.map(cat => ({ ...cat, count: 0 })),
        isLoading: false,
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
            this.setData({
              learned,
              toReview,
              inProgress,
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
    this.setData({
      learned,
      toReview,
      inProgress,
      isLoading: false
    });
  },
  
  // 加载最近学习的词（优先云端）
  loadRecentWords: function() {
    return new Promise((resolve) => {
      const selectedCollection = this.data.selectedCollection;
      const userInfo = wx.getStorageSync('userInfo');
      if (this.data.isLoggedIn && userInfo && userInfo.openid) {
        wx.cloud.callFunction({
          name: 'getUserWordProgress',
          data: {
            userId: userInfo.openid,
            collection: selectedCollection
          },
          success: res => {
            if (res.result && res.result.success) {
              const progressArr = res.result.data || [];
              // 同步写入本地缓存
              let history = wx.getStorageSync('wordLearnHistory') || [];
              progressArr.forEach(item => {
                // 只保留最近学习时间
                history = history.filter(h => !(h.wordId === item.wordId && h.collection === item.collection));
                history.unshift({
                  wordId: item.wordId,
                  word: item.word, // 这里需要后端返回 word 字段，或前端补全
                  status: item.status,
                  learnTime: item.lastStudied,
                  collection: item.collection
                });
              });
              wx.setStorageSync('wordLearnHistory', history);
              // 只展示当前分类
              const filtered = history.filter(item => item.collection === selectedCollection);
              filtered.sort((a, b) => new Date(b.learnTime) - new Date(a.learnTime));
              const recentWords = filtered.slice(0, 5).map(item => {
                const time = item.learnTime;
                const date = time ? new Date(time) : new Date();
                const timeStr = this.formatTime(date);
                let statusText = '学习中';
                if (item.status === 'mastered' || item.status === 'learned') {
                  statusText = '已掌握';
                } else if (item.status === 'review') {
                  statusText = '待复习';
                }
                return {
                  wordId: item.wordId,
                  word: item.word,
                  timeStr,
                  status: item.status || 'studying',
                  statusText
                };
              });
              this.setData({ recentWords, isLoading: false });
              resolve();
            } else {
              this.loadRecentWordsLocal().then(resolve);
            }
          },
          fail: err => {
            this.loadRecentWordsLocal().then(resolve);
          }
        });
      } else {
        this.loadRecentWordsLocal().then(resolve);
      }
    });
  },
  
  // 本地加载最近学习
  loadRecentWordsLocal: function() {
    return new Promise((resolve) => {
      const learnHistory = wx.getStorageSync('wordLearnHistory') || [];
      const selectedCollection = this.data.selectedCollection;
      const filtered = learnHistory.filter(item => item.collection === selectedCollection);
      filtered.sort((a, b) => {
        const timeA = a.updateTime || a.learnTime || '';
        const timeB = b.updateTime || b.learnTime || '';
        return new Date(timeB) - new Date(timeA);
      });
      const recentWords = filtered.slice(0, 5).map(item => {
        const time = item.updateTime || item.learnTime || '';
        const date = time ? new Date(time) : new Date();
        const timeStr = this.formatTime(date);
        let statusText = '学习中';
        if (item.status === 'mastered' || item.status === 'learned') {
          statusText = '已掌握';
        } else if (item.status === 'review') {
          statusText = '待复习';
        }
        return {
          wordId: item.wordId,
          word: item.word,
          timeStr,
          status: item.status || 'studying',
          statusText
        };
      });
      this.setData({ recentWords, isLoading: false });
      resolve();
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
  
  // 格式化时间
  formatTime: function(date) {
    const now = new Date();
    const diff = now - date;
    
    // 一小时内
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}分钟前`;
    }
    
    // 今天内
    if (now.getDate() === date.getDate() && 
        now.getMonth() === date.getMonth() && 
        now.getFullYear() === date.getFullYear()) {
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `今天 ${hours}:${minutes}`;
    }
    
    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.getDate() === date.getDate() && 
        yesterday.getMonth() === date.getMonth() && 
        yesterday.getFullYear() === date.getFullYear()) {
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `昨天 ${hours}:${minutes}`;
    }
    
    // 一周内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}天前`;
    }
    
    // 更早
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}-${day}`;
  },
  
  // 导航到学习页
  navigateToStudy: function(e) {
    const type = e.currentTarget.dataset.type;
    
    wx.navigateTo({
      url: `/pages/word-learning/study/study?examType=${type}`
    });
  },
  
  // 导航到特定词条
  navigateToWord: function(e) {
    const wordId = e.currentTarget.dataset.wordId;
    
    // 查找词所属的分类
    const recentWords = this.data.recentWords;
    const wordItem = recentWords.find(item => item.wordId === wordId);
    
    if (wordItem) {
      wx.navigateTo({
        url: `/pages/word-learning/study/study?wordId=${wordId}&examType=全部`
      });
    }
  },
  
  // 继续学习（上次学习的位置）
  continueStudy: function() {
    // 获取最近学习的词
    const recentWords = this.data.recentWords;
    
    if (recentWords.length > 0) {
      const lastWord = recentWords[0];
      
      wx.navigateTo({
        url: `/pages/word-learning/study/study?wordId=${lastWord.wordId}&examType=全部`
      });
    } else {
      // 如果没有学习记录，从高考实词开始学习
      wx.navigateTo({
        url: `/pages/word-learning/study/study?examType=高考实词合集`
      });
    }
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
  
  // 查看所有历史记录
  viewAllHistory: function() {
    wx.navigateTo({
      url: '/pages/word-learning/history/history'
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
      this.loadRecentWords();
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
  
  // 跳转到开始学习
  startStudy: function() {
    wx.navigateTo({
      url: '../study/study?mode=new'
    });
  },
  
  // 跳转到复习
  reviewWords: function() {
    wx.navigateTo({
      url: '../study/study?mode=review'
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
      this.loadRecentWords();
    } else {
      this.setData({ isLoading: false });
    }
  },
  
  onSearchInput: function(e) {
    this.setData({ searchValue: e.detail.value });
  },
  
  onSearchConfirm: function(e) {
    const value = e.detail.value.trim();
    if (!value) return;
    // 搜索 xushici 集合
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: { type: 'search', keyword: value }
    }).then(res => {
      this.setData({ searchResults: res.result.data || [] });
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
