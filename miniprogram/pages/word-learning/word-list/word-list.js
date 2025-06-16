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
    currentStatus: 'all',
    
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
    }
  },

  onLoad: function(options) {
    // 获取分类参数
    const category = options.category || '';
    
    console.log('词条列表页面加载，参数:', options);
    
    // 设置页面标题
    if (category) {
      wx.setNavigationBarTitle({
        title: category
      });
    }
    
    this.setData({
      category: category
    });
    
    console.log('设置分类:', category);
    
    // 加载用户学习进度
    this.loadUserProgress().then(() => {
      // 加载词条列表
      this.loadWordList();
    });
  },
  
  // 加载用户学习进度
  loadUserProgress: function() {
    return new Promise((resolve) => {
      const progress = wx.getStorageSync('wordLearningProgress') || {};
      this.setData({ userProgress: progress }, () => {
        resolve();
      });
    });
  },
  
  // 加载词条列表
  loadWordList: function() {
    const { category, currentStatus, searchKeyword } = this.data;
    
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
        
        console.log(`获取到词条数量: ${allWordList.length}`);
        
        // 处理词条数据
        allWordList = this.processWordData(allWordList);
        
        // 保存所有词条数据，用于搜索
        this.setData({ allWordList });
        
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
          'stats.total': total
        });
        
        // 统计各状态数量
        this.calculateStats(searchedList);
      } else {
        this.setData({
          loading: false,
          loaded: true,
          error: res.result ? res.result.error : '获取数据失败'
        });
      }
    }).catch(err => {
      console.error('加载词条列表失败:', err);
      this.setData({
        loading: false,
        loaded: true,
        error: err.message || '加载失败，请重试'
      });
    });
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
    
    // 重新加载词条列表
    this.loadWordList();
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
      wx.showToast({
        title: '词条ID无效',
        icon: 'none'
      });
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
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none'
        });
      }
    });
  },
  
  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadUserProgress().then(() => {
      this.loadWordList();
      wx.stopPullDownRefresh();
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
    const { searchKeyword, allWordList } = this.data;
    
    console.log(`执行搜索: "${searchKeyword}"`);
    
    if (!allWordList || allWordList.length === 0) {
      // 如果还没有加载数据，先加载数据
      this.loadWordList();
      return;
    }
    
    // 先根据搜索关键词筛选
    const searchedList = this.filterWordsByKeyword(allWordList, searchKeyword);
    
    // 再根据当前状态筛选
    const filteredList = this.filterWordsByStatus(searchedList, this.data.currentStatus);
    
    console.log(`搜索结果: ${filteredList.length}条`);
    
    // 更新列表和统计数据
    this.setData({
      wordList: filteredList
    });
    
    // 统计各状态数量
    this.calculateStats(searchedList);
  }
}); 