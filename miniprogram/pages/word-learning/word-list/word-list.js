const app = getApp();
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    loading: true,
    loaded: false,
    error: null,
    
    // 词条数据
    category: '',
    wordList: [],
    hasMore: false, // 不需要分页
    
    // 用户学习进度
    userProgress: {},
    
    // 当前状态筛选
    currentStatus: 'unlearned',
    
    // 搜索相关
    searchKeyword: '',
    allWordList: [], // 存储所有词条数据，用于搜索
    
    // 统计数据
    stats: {
      total: 0,
      unlearned: 0,
      learning: 0,
      learned: 0,
      review: 0
    },
    
    // 缓存控制
    lastFetchTime: 0,
    cacheExpireTime: 5 * 60 * 1000, // 缓存过期时间，默认5分钟
    progressUpdated: false // 标记用户进度是否有更新
  },

  onLoad: function(options) {
    // 获取分类参数
    const category = options.category || '';
    
    console.log('词条列表页面加载，参数:', options);
    
    // 设置页面标题
    if (category) {
      // 防止中文乱码问题
      let title;
      try {
        // 如果是编码的中文，则进行解码
        if (/%[0-9A-F]{2}/.test(category)) {
          title = decodeURIComponent(category);
        } else {
          title = category;
        }
      } catch (e) {
        title = category;
      }
      
      wx.setNavigationBarTitle({
        title: title
      });
    }
    
    this.setData({
      category: category
    });
    
    console.log('设置分类:', category);
    
    // 尝试从缓存加载数据
    this.loadDataWithCache();
  },
  
  // 使用缓存加载数据
  loadDataWithCache: function() {
    // 先尝试从缓存加载词条列表
    const cacheKey = `wordList_${this.data.category}`;
    const wordListCache = wx.getStorageSync(cacheKey);
    const now = Date.now();
    
    // 检查是否有有效缓存
    if (wordListCache && 
        wordListCache.timestamp && 
        now - wordListCache.timestamp < this.data.cacheExpireTime) {
      console.log('从缓存加载词条列表');
      
      // 从缓存加载词条列表
      this.setData({
        allWordList: wordListCache.data || [],
        lastFetchTime: wordListCache.timestamp
      });
      
      // 加载用户进度
      this.loadUserProgress().then(() => {
        // 使用缓存的词条数据和最新的用户进度进行筛选和显示
        this.filterAndDisplayWords();
      });
    } else {
      // 缓存不存在或已过期，从云端加载
      console.log('缓存不存在或已过期，从云端加载');
      
      // 加载用户学习进度
      this.loadUserProgress().then(() => {
        // 加载词条列表
        this.loadWordList();
      });
    }
  },
  
  // 加载用户学习进度
  loadUserProgress: function() {
    return new Promise((resolve) => {
      // 从云端获取用户学习进度
      const userId = wx.getStorageSync('userInfo')?.openid || getApp().globalData?.openid;
      if (!userId) {
        console.warn('未获取到用户openid，无法获取云端进度');
        this.setData({ userProgress: {} }, () => {
          resolve();
        });
        return;
      }
      
      // 检查是否有进度缓存
      const progressCacheKey = `userProgress_${this.data.category}_${userId}`;
      const progressCache = wx.getStorageSync(progressCacheKey);
      const now = Date.now();
      
      // 如果有缓存且未标记为需要更新，则使用缓存
      if (progressCache && 
          progressCache.timestamp && 
          now - progressCache.timestamp < this.data.cacheExpireTime && 
          !this.data.progressUpdated) {
        console.log('从缓存加载用户进度');
        this.setData({ 
          userProgress: progressCache.data || {},
          progressUpdated: false
        }, () => {
          resolve();
        });
        return;
      }
      
      // 调用云函数获取用户词条学习进度
      wx.cloud.callFunction({
        name: 'updateUserWordProgress',
        data: {
          userId,
          collection: this.data.category, // 可选参数，按合集过滤
          action: 'get' // 指定为获取操作
        },
        success: res => {
          console.log('获取用户学习进度成功:', res);
          if (res.result && res.result.success) {
            // 将云端数据转换为本地格式
            const progressList = res.result.data || [];
            const progress = {};
            
            progressList.forEach(item => {
              progress[item.wordId] = {
                status: item.status,
                lastStudied: item.lastStudied,
                collection: item.collection
              };
            });
            
            // 缓存用户进度
            wx.setStorageSync(progressCacheKey, {
              data: progress,
              timestamp: now
            });
            
            this.setData({ 
              userProgress: progress,
              progressUpdated: false
            }, () => {
              resolve();
            });
          } else {
            console.error('获取用户学习进度失败:', res.result);
            this.setData({ userProgress: {} }, () => {
              resolve();
            });
          }
        },
        fail: err => {
          console.error('调用云函数获取用户学习进度失败:', err);
          this.setData({ userProgress: {} }, () => {
            resolve();
          });
        }
      });
    });
  },
  
  // 加载词条列表
  loadWordList: function() {
    const { category } = this.data;
    
    // 设置加载状态
    this.setData({
      loading: true,
      error: null
    });
    
    // 调用云函数获取词条列表
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'groupByWordId',
        category: category
      }
    }).then(res => {
      if (res.result && res.result.success) {
        let allWordList = res.result.data || [];
        const total = allWordList.length;
        const now = Date.now();
        
        console.log(`获取到词条数量: ${allWordList.length}`);
        
        // 处理词条数据
        allWordList = this.processWordData(allWordList);
        
        // 缓存词条数据
        const cacheKey = `wordList_${category}`;
        wx.setStorageSync(cacheKey, {
          data: allWordList,
          timestamp: now
        });
        
        // 保存所有词条数据，用于搜索
        this.setData({ 
          allWordList,
          lastFetchTime: now
        });
        
        // 筛选并显示词条
        this.filterAndDisplayWords();
      } else {
        this.setData({
          loading: false,
          loaded: true,
          wordList: [],
          allWordList: []
        });
        this.filterAndDisplayWords(); // 确保显示空状态
      }
    }).catch(err => {
      console.error('加载词条列表失败:', err);
      this.setData({
        loading: false,
        loaded: true,
        wordList: [],
        allWordList: []
      });
      this.filterAndDisplayWords(); // 确保显示空状态
    });
  },
  
  // 筛选并显示词条
  filterAndDisplayWords: function() {
    const { allWordList, currentStatus, searchKeyword } = this.data;
    
    if (!allWordList || allWordList.length === 0) {
      this.setData({
        loading: false,
        loaded: true,
        wordList: [],
        'stats.total': 0
      });
      return;
    }
    
    // 先根据搜索关键词筛选
    let searchedList = this.filterWordsByKeyword(allWordList, searchKeyword);
    
    // 再根据当前状态筛选
    let filteredList = this.filterWordsByStatus(searchedList, currentStatus);
    
    console.log(`筛选后数据: ${currentStatus}状态，搜索"${searchKeyword}"，共${filteredList.length}条`);
    
    // 更新数据
    this.setData({
      wordList: filteredList,
      hasMore: false, // 不需要分页，没有更多数据
      loading: false,
      loaded: true,
      'stats.total': allWordList.length
    });
    
    // 统计各状态数量
    this.calculateStats(searchedList);
  },
  
  // 处理词条数据
  processWordData: function(words) {
    return words.map(word => {
      // 优先使用word_id作为唯一标识
      const wordId = word.word_id || word['例词id'] || word._id || '';
      
      return {
        id: word._id || wordId || '',
        wordId: wordId,
        word: word.word || word['例词'] || '',
        pinyin: word.pronunciation || word['读音'] || '',
        wordType: word.part_of_speech || word['词性'] || '',
        meaning: word.meaning || word['词义'] || '',
        collection: word.collection || word['合集'] || this.data.category
      };
    });
  },
  
  // 根据搜索关键词筛选词条
  filterWordsByKeyword: function(wordList, keyword) {
    if (!keyword || keyword.trim() === '') {
      return wordList;
    }
    
    const trimmedKeyword = keyword.trim().toLowerCase();
    
    return wordList.filter(word => {
      // 匹配例词
      const wordMatch = word.word && word.word.toLowerCase().includes(trimmedKeyword);
      // 匹配拼音
      const pinyinMatch = word.pinyin && word.pinyin.toLowerCase().includes(trimmedKeyword);
      // 匹配词义
      const meaningMatch = word.meaning && word.meaning.toLowerCase().includes(trimmedKeyword);
      
      return wordMatch || pinyinMatch || meaningMatch;
    });
  },
  
  // 根据状态筛选词条
  filterWordsByStatus: function(wordList, status) {
    if (status === 'all') {
      return wordList;
    }
    
    return wordList.filter(word => {
      const wordStatus = this.getWordStatus(word);
      return wordStatus === status;
    });
  },
  
  // 获取词条的学习状态
  getWordStatus: function(word) {
    const progress = this.data.userProgress;
    const wordId = word.wordId;
    
    if (!progress[wordId]) {
      return 'unlearned'; // 未学习
    }
    
    return progress[wordId].status || 'unlearned';
  },
  
  // 统计各状态数量
  calculateStats: function(wordList) {
    const stats = {
      total: wordList.length,
      unlearned: 0,
      learning: 0,
      learned: 0,
      review: 0
    };
    
    wordList.forEach(word => {
      const status = this.getWordStatus(word);
      stats[status]++;
    });
    
    console.log('词条状态统计:', stats);
    
    this.setData({ stats });
  },
  
  // 切换状态筛选
  switchStatus: function(e) {
    const status = e.currentTarget.dataset.status;
    
    if (status === this.data.currentStatus) return;
    
    this.setData({
      currentStatus: status
    });
    
    // 只需要重新筛选数据，不需要重新加载
    this.filterAndDisplayWords();
  },
  
  // 跳转到词条详情页
  goToWordDetail: function(e) {
    const wordId = e.currentTarget.dataset.wordId;
    const category = e.currentTarget.dataset.category || this.data.category;
    
    console.log('点击词条:', {
      wordId: wordId,
      category: category,
      dataset: e.currentTarget.dataset
    });
    
    if (!wordId) {
      console.error('词条ID无效');
      return;
    }
    
    // 确保使用例词id字段作为参数，并且传递正确的分类参数
    const url = `/pages/word-learning/study/study?wordId=${encodeURIComponent(wordId)}&category=${encodeURIComponent(category)}`;
    console.log('准备跳转到:', url);
    
    wx.navigateTo({
      url: url,
      success: () => {
        console.log('跳转成功');
      },
      fail: (err) => {
        console.error('跳转失败:', err);
      }
    });
  },
  
  // 下拉刷新
  onPullDownRefresh: function() {
    // 强制刷新，不使用缓存
    this.setData({
      progressUpdated: true // 标记需要更新进度
    });
    
    this.loadUserProgress().then(() => {
      this.loadWordList();
      wx.stopPullDownRefresh();
    });
  },
  
  // 页面显示时刷新数据
  onShow: function() {
    // 页面从学习页面返回时，只更新学习进度，不重新加载词条列表
    this.setData({
      progressUpdated: true // 标记需要更新进度
    });
    
    this.loadUserProgress().then(() => {
      // 如果已经有词条数据，只需要重新筛选显示
      if (this.data.allWordList && this.data.allWordList.length > 0) {
        this.filterAndDisplayWords();
      } else {
        // 如果没有词条数据，则需要加载
        this.loadDataWithCache();
      }
    });
  },
  
  // 处理搜索输入
  onSearchInput: function(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },
  
  // 处理搜索确认
  onSearchConfirm: function() {
    // 直接使用当前数据筛选，不需要重新加载
    this.filterAndDisplayWords();
  },

  // 清空搜索
  clearSearch: function() {
    // 清空搜索关键词
    this.setData({
      searchKeyword: ''
    });
    
    // 重新筛选数据
    this.filterAndDisplayWords();
    
    console.log('已清空搜索');
  }
}); 