const app = getApp();
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    examType: '',          // 考试类型
    currentWord: null,     // 当前词条
    wordList: [],          // 词条列表
    currentIndex: 0,       // 当前词条索引
    totalWords: 0,         // 总词条数
    loading: true,         // 加载状态
    userInfo: null,        // 用户信息
    progressPercent: '0%',  // 进度条百分比
    studyTime: '',         // 学习时间
    isBookmarked: false,    // 是否收藏
    
    // 用法和例句相关
    currentPronunciationIndex: 0,
    currentUsageIndex: 0,
    currentExampleIndex: 0,
    
    // 学习记录
    learnHistory: [],       // 学习历史
    category: '',
    mode: 'normal', // normal, review, continue, new
    totalCount: 0,
    progress: {
      learned: 0,
      toReview: 0,
      remaining: 0
    },
    showMeaning: false,
    userProgress: {},
    error: null, // 添加错误信息字段
    categoryInfo: null, // 添加分类信息字段
    loaded: false,
  },

  onLoad: function (options) {
    console.log('学习页面加载，参数:', options);
    
    // 检查云环境是否正确初始化
    if (!wx.cloud) {
      this.setData({
        error: '云开发未初始化，请检查基础库版本',
        loading: false
      });
      return;
    }
    
    // 记录当前云环境
    const currentEnv = wx.cloud.DYNAMIC_CURRENT_ENV || '未获取到环境ID';
    console.log('当前云环境:', currentEnv);
    
    // 从本地存储获取学习记录
    const history = wx.getStorageSync('wordLearnHistory') || [];
    this.setData({ learnHistory: history });
    
    // 计算当前学习时间
    this.calculateStudyTime();
    
    // 解析参数 - 不使用decodeURIComponent，因为微信小程序已经自动解码了
    let category = options.category || '';
    let examType = options.examType || '';
    let mode = options.mode || 'normal';
    
    console.log('解析后的参数: 分类=', category, '考试类型=', examType, '模式=', mode);
    
    this.setData({
      category: category,
      examType: examType,
      mode: mode,
      loading: true
    });
    
    // 获取用户学习进度
    this.loadUserProgress();

    // 根据参数加载不同数据
    if (category) {
      // 分类学习模式
      this.loadWordsByCategory(category);
    } else if (examType) {
      // 考试类型模式
      this.loadWordsByCategory(examType);
    } else if (mode === 'review') {
      // 复习模式
      this.loadWordsForReview();
    } else if (mode === 'continue') {
      // 继续学习模式
      this.loadWordsForContinue();
    } else if (mode === 'new') {
      // 新词学习模式
      this.loadNewWords();
    } else {
      // 默认加载全部词条
      this.loadAllWords();
    }

    // 只加载唯一词条
    this.loadUniqueWordsByCategory(category || examType);
  },

  // 加载用户学习进度
  loadUserProgress: function() {
    const progress = wx.getStorageSync('wordLearningProgress') || {};
    this.setData({ userProgress: progress });
    return progress;
  },

  // 保存用户学习进度
  saveUserProgress: function() {
    wx.setStorageSync('wordLearningProgress', this.data.userProgress);
  },

  // 根据分类加载词条
  loadWordsByCategory: function(category) {
    console.log('开始加载分类词条:', category);
    
    if (!category) {
      this.setData({
        loading: false,
        error: '分类参数为空'
      });
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      return;
    }

    // 添加临时调试信息
    this.setData({
      loading: true,
      error: `正在加载分类: ${category}`
    });

    // 先获取该分类的总数量和第一条数据
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'getCategoryInfo',
        category: category
      }
    })
    .then(res => {
      console.log('获取分类信息成功:', res);
      
      if (res.result && res.result.success) {
        const totalCount = res.result.total || 0;
        const firstItem = res.result.firstItem;
        
        if (totalCount > 0 && firstItem) {
          // 设置总数量和当前索引
          this.setData({
            totalCount: totalCount,
            currentIndex: 0,
            // 保存分类信息，用于后续加载
            categoryInfo: {
              category: category,
              totalCount: totalCount
            },
            loading: false,
            error: null
          });
          
          // 处理第一条数据
          this.processWordData([firstItem]);
        } else {
          // 尝试加载默认数据
          console.log('未找到该分类的词条，尝试加载默认数据');
          this.loadAllWords();
        }
      } else {
        // 显示错误信息，但同时尝试加载默认数据
        this.setData({ 
          loading: false,
          error: `获取数据失败: ${res.result ? (res.result.error || '未知错误') : '返回结果格式错误'}`
        });
        
        // 尝试加载默认数据
        console.log('加载失败，尝试加载默认数据');
        this.loadAllWords();
      }
    })
    .catch(err => {
      console.error('云函数调用失败:', err);
      this.setData({
        loading: false,
        error: '调用云函数失败: ' + (err.message || JSON.stringify(err))
      });
      
      // 尝试加载默认数据
      console.log('调用失败，尝试加载默认数据');
      this.loadAllWords();
    });
  },

  // 加载指定索引的词条
  loadWordByIndex: function(index) {
    const categoryInfo = this.data.categoryInfo;
    
    if (!categoryInfo || !categoryInfo.category) {
      console.error('没有分类信息，无法加载指定索引的词条');
      return;
    }
    
    // 设置加载状态
    this.setData({
      loading: true,
      error: `正在加载第 ${index + 1}/${categoryInfo.totalCount} 条词条...`
    });
    
    // 调用云函数获取指定索引的词条
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'byIndex',
        category: categoryInfo.category,
        index: index
      }
    })
    .then(res => {
      console.log(`获取索引 ${index} 的词条成功:`, res);
      
      if (res.result && res.result.success && res.result.data) {
        // 处理数据
        this.processWordData([res.result.data]);
      } else {
        this.setData({
          loading: false,
          error: `获取词条失败: ${res.result ? (res.result.error || '未知错误') : '返回结果格式错误'}`
        });
      }
    })
    .catch(err => {
      console.error(`获取索引 ${index} 的词条失败:`, err);
      this.setData({
        loading: false,
        error: '获取词条失败: ' + (err.message || JSON.stringify(err))
      });
    });
  },

  // 加载待复习词条
  loadWordsForReview: function() {
    const progress = this.data.userProgress;
    const reviewWordIds = Object.keys(progress).filter(id => progress[id].status === 'review');
    
    if (reviewWordIds.length === 0) {
      this.setData({ 
        loading: false,
        wordList: [],
        totalCount: 0
      });
      wx.showToast({
        title: '没有待复习的词条',
        icon: 'none'
      });
      return;
    }
    
    // 记录待复习的词条ID
    console.log('待复习词条ID:', reviewWordIds.join(', '));
    
    // 由于这些ID来自本地存储，我们可以使用客户端获取
    // 如果数量很多，也可以使用云函数批量获取
    this.fetchWordsByIds(reviewWordIds);
  },

  // 加载继续学习的词条
  loadWordsForContinue: function() {
    const progress = this.data.userProgress;
    const learningWordIds = Object.keys(progress).filter(id => 
      progress[id].status === 'learning' && 
      progress[id].lastStudied && 
      (new Date().getTime() - progress[id].lastStudied) < 24 * 60 * 60 * 1000
    );
    
    if (learningWordIds.length === 0) {
      // 如果没有正在学习的词条，加载新词
      this.loadNewWords();
      return;
    }
    
    // 记录继续学习的词条ID
    console.log('继续学习词条ID:', learningWordIds.join(', '));
    
    // 获取这些词条的数据
    this.fetchWordsByIds(learningWordIds);
  },

  // 根据ID数组获取词条
  fetchWordsByIds: function(wordIds) {
    if (!wordIds || wordIds.length === 0) {
      this.setData({ 
        loading: false,
        wordList: [],
        totalCount: 0,
        error: '无有效的词条ID'
      });
      return;
    }
    
    // 由于ID数量可能很多，使用多次查询
    const batchSize = 20; // 每批查询的数量
    const batches = [];
    
    for (let i = 0; i < wordIds.length; i += batchSize) {
      const batchIds = wordIds.slice(i, i + batchSize);
      batches.push(batchIds);
    }
    
    console.log(`分批查询，共 ${batches.length} 批`);
    
    // 依次查询每一批
    this.fetchWordsBatch(batches, 0, []);
  },
  
  // 批量查询词条
  fetchWordsBatch: function(batches, currentBatch, allResults) {
    if (currentBatch >= batches.length) {
      // 所有批次都查询完成
      this.processWordData(allResults);
      return;
    }
    
    const batchIds = batches[currentBatch];
    
    console.log(`查询第 ${currentBatch + 1} 批，包含 ${batchIds.length} 个ID`);
    
    // 构建查询条件
    const query = {
      例词id: _.in(batchIds)
    };
    
    // 调用数据库查询
    db.collection('xushici')
      .where(query)
      .get()
      .then(res => {
        const batchResults = res.data || [];
        
        console.log(`第 ${currentBatch + 1} 批查询结果: ${batchResults.length} 条`);
        
        // 合并结果
        const newResults = [...allResults, ...batchResults];
        
        // 查询下一批
        this.fetchWordsBatch(batches, currentBatch + 1, newResults);
      })
      .catch(err => {
        console.error(`第 ${currentBatch + 1} 批查询失败:`, err);
        
        // 即使失败也继续查询下一批
        this.fetchWordsBatch(batches, currentBatch + 1, allResults);
      });
  },

  // 加载新词
  loadNewWords: function() {
    const progress = this.data.userProgress;
    const learnedWordIds = Object.keys(progress);
    
    console.log(`已学习词条数: ${learnedWordIds.length}`);
    
    // 调用云函数，获取用户尚未学习的词条
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'test',  // 此处应改为获取新词的专门类型，暂用test
        limit: 20
      }
    })
    .then(res => {
      console.log('获取新词成功:', res);
      
      if (res.result && res.result.success) {
        const data = res.result.data || [];
        
        // 过滤掉已学习的词条
        const newWords = data.filter(item => !learnedWordIds.includes(item.例词id));
        
        console.log(`过滤后新词数量: ${newWords.length}`);
        
        this.processWordData(newWords);
      } else {
        this.setData({
          loading: false,
          error: res.result.error || '获取新词失败'
        });
      }
    })
    .catch(err => {
      console.error('获取新词失败:', err);
      this.setData({
        loading: false,
        error: '获取新词失败: ' + (err.message || JSON.stringify(err))
      });
    });
  },

  // 加载所有词条
  loadAllWords: function() {
    console.log('加载所有词条');
    
    // 设置加载状态
    this.setData({
      loading: true,
      error: '正在加载所有词条...'
    });
    
    // 调用云函数获取所有词条
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'test',
        limit: 100
      }
    })
    .then(res => {
      console.log('获取所有词条成功:', res);
      
      if (res.result && res.result.success) {
        const data = res.result.data || [];
        
        if (data.length > 0) {
          this.processWordData(data);
        } else {
          // 如果没有数据，创建一些示例数据
          const sampleData = this.createSampleData();
          this.processWordData(sampleData);
        }
      } else {
        console.error('获取所有词条失败:', res.result);
        // 创建示例数据
        const sampleData = this.createSampleData();
        this.processWordData(sampleData);
      }
    })
    .catch(err => {
      console.error('获取所有词条失败:', err);
      // 创建示例数据
      const sampleData = this.createSampleData();
      this.processWordData(sampleData);
    });
  },
  
  // 创建示例数据，用于在数据库连接失败时显示
  createSampleData: function() {
    return [
      {
        _id: 'sample1',
        例词id: 'sample1',
        例词: '之',
        读音: '[zhī]',
        词性: '助词',
        词义: '的，助词，表示修饰、领属关系',
        例句: '不识庐山真面目，只缘身在此山中。',
        出处: '宋·苏轼《题西林壁》',
        释义: '看不清庐山的真实面目，只因为自己身在此山中。',
        合集: '高考虚词合集'
      },
      {
        _id: 'sample2',
        例词id: 'sample2',
        例词: '乎',
        读音: '[hū]',
        词性: '助词',
        词义: '表示疑问、反问的语气词',
        例句: '人之初，性本善。性相近，习相远。',
        出处: '《三字经》',
        释义: '人刚出生的时候，本性都是善良的。人的本性是相近的，但因为后天的习染不同而相距甚远。',
        合集: '高考虚词合集'
      },
      {
        _id: 'sample3',
        例词id: 'sample3',
        例词: '也',
        读音: '[yě]',
        词性: '助词',
        词义: '表示判断、肯定的语气词',
        例句: '学而时习之，不亦说乎？',
        出处: '《论语·学而》',
        释义: '学习了，按时复习，不也很高兴吗？',
        合集: '高考虚词合集'
      }
    ];
  },

  // 处理词条数据
  processWordData: function(words) {
    console.log('处理词条数据，原始数据:', words);
    
    if (!words || words.length === 0) {
      this.setData({ 
        loading: false,
        error: '未收到有效的词条数据'
      });
      wx.showToast({
        title: '未找到词条',
        icon: 'none'
      });
      return;
    }

    try {
      // 记录第一条原始数据，用于调试
      const firstOriginal = words[0];
      console.log('第一条原始数据:', firstOriginal);
      
      // 处理词条数据，转换为页面需要的格式
      const processedWords = words.map(word => {
        try {
          return {
            id: word._id,
            wordId: word.例词id || '',
            word: word.例词 || '',
            pinyin: word.读音 || '',
            usageId: word.用法id || '',
            wordType: word.词性 || '',
            meaning: word.词义 || '',
            example: word.例句 || '',
            source: word.出处 || '',
            translation: word.释义 || '',
            collection: word.合集 || ''
          };
        } catch (mapErr) {
          console.error('处理单个词条数据出错:', mapErr, word);
          return {
            id: word._id || 'unknown',
            word: '数据错误',
            error: mapErr.message
          };
        }
      });

      // 记录第一条处理后的数据，用于调试
      const firstProcessed = processedWords[0];
      console.log('第一条处理后数据:', firstProcessed);

      // 统计学习进度（如果有categoryInfo）
      const progress = this.data.userProgress;
      let learned = 0;
      let toReview = 0;
      let remaining = 0;
      
      if (this.data.categoryInfo && this.data.categoryInfo.totalCount) {
        const totalCount = this.data.categoryInfo.totalCount;
        
        // 计算已学习和待复习的数量
        const learnedIds = Object.keys(progress).filter(id => progress[id].status === 'learned');
        const reviewIds = Object.keys(progress).filter(id => progress[id].status === 'review');
        
        learned = learnedIds.length;
        toReview = reviewIds.length;
        remaining = totalCount - learned - toReview;
      }

      // 更新UI
      this.setData({
        currentWord: processedWords[0],
        loading: false,
        progress: {
          learned: learned,
          toReview: toReview,
          remaining: remaining
        },
        showMeaning: false,
        error: null // 清除错误信息
      });
      
      console.log(`处理完成，当前词条:`, processedWords[0]);
    } catch (err) {
      console.error('处理词条数据出错:', err);
      this.setData({
        loading: false,
        error: '处理数据出错: ' + err.message
      });
    }
  },

  // 显示释义
  showMeaning: function() {
    this.setData({ showMeaning: true });
    
    // 更新学习进度
    if (this.data.currentWord) {
      const wordId = this.data.currentWord.wordId;
      const progress = this.data.userProgress;
      
      if (!progress[wordId]) {
        progress[wordId] = {
          status: 'learning',
          lastStudied: new Date().getTime(),
          studyCount: 1
        };
      } else {
        progress[wordId].lastStudied = new Date().getTime();
        progress[wordId].studyCount = (progress[wordId].studyCount || 0) + 1;
      }
      
      this.setData({ userProgress: progress });
      this.saveUserProgress();
    }
  },

  // 标记为已掌握
  markAsLearned: function() {
    if (this.data.currentWord) {
      const wordId = this.data.currentWord.wordId;
      const progress = this.data.userProgress;
      
      progress[wordId] = {
        ...progress[wordId],
        status: 'learned',
        lastStudied: new Date().getTime()
      };
      
      this.setData({ userProgress: progress });
      this.saveUserProgress();
      this.goToNextWord();
    }
  },

  // 标记为需要复习
  markForReview: function() {
    if (this.data.currentWord) {
      const wordId = this.data.currentWord.wordId;
      const progress = this.data.userProgress;
      
      progress[wordId] = {
        ...progress[wordId],
        status: 'review',
        lastStudied: new Date().getTime()
      };
      
      this.setData({ userProgress: progress });
      this.saveUserProgress();
      this.goToNextWord();
    }
  },

  // 前往下一个词条
  goToNextWord: function() {
    const { currentIndex, wordList } = this.data;
    if (currentIndex < wordList.length - 1) {
      this.setData({
        currentIndex: currentIndex + 1,
        currentPronunciationIndex: 0,
        currentUsageIndex: 0,
        currentExampleIndex: 0,
        showMeaning: false
      }, () => {
        // 处理例句高亮
        this.processExamplesHighlight();
      });
    } else {
      wx.showToast({ title: '已完成所有词条学习', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1500);
    }
  },

  // 前往上一个词条
  goToPrevWord: function() {
    const { currentIndex } = this.data;
    if (currentIndex > 0) {
      this.setData({
        currentIndex: currentIndex - 1,
        currentPronunciationIndex: 0,
        currentUsageIndex: 0,
        currentExampleIndex: 0,
        showMeaning: false
      }, () => {
        // 处理例句高亮
        this.processExamplesHighlight();
      });
    } else {
      wx.showToast({ title: '已经是第一个词条', icon: 'none' });
    }
  },

  // 返回首页
  goBack: function() {
    wx.navigateBack();
  },

  // 通过ID加载词条
  loadWordById: function(wordId) {
    if (!wordId) return;
    
    this.setData({ loading: true });
    
    // 查询数据库
    db.collection('xushici').where({
      例词id: wordId
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        this.processWordData(res.data);
      } else {
        wx.showToast({
          title: '未找到词条',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('加载词条失败:', err);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  // 通过词文本加载词条
  loadWordByText: function(wordText) {
    if (!wordText) return;
    
    this.setData({ loading: true });
    
    // 查询数据库
    db.collection('xushici').where({
      例词: wordText
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        this.processWordData(res.data);
      } else {
        wx.showToast({
          title: '未找到词条',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('加载词条失败:', err);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  // 加载词条列表
  loadWordList: function() {
    this.setData({ loading: true });
    
    // 构建查询条件
    let query = {};
    if (this.data.examType !== '全部') {
      query.合集 = this.data.examType;
    }
    
    // 查询数据库
    db.collection('xushici').where(query).limit(100).get().then(res => {
      if (res.data && res.data.length > 0) {
        this.processWordData(res.data);
      } else {
        wx.showToast({
          title: '未找到词条',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('加载词条列表失败:', err);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  // 获取词条类型
  getWordType: function(collection) {
    // 根据合集名称确定词条类型
    switch(collection) {
      case '高考实词合集':
        return '实词';
      case '高考虚词合集':
        return '虚词';
      case '中考实词合集':
        return '实词';
      case '中考虚词合集':
        return '虚词';
      default:
        return '';
    }
  },

  // 切换收藏状态
  toggleBookmark: function() {
    const { currentWord, isBookmarked } = this.data;
    
    if (!currentWord) return;
    
    // 获取收藏列表
    const bookmarks = wx.getStorageSync('wordBookmarks') || [];
    
    if (isBookmarked) {
      // 取消收藏
      const index = bookmarks.findIndex(item => item === currentWord.id);
      if (index !== -1) {
        bookmarks.splice(index, 1);
        wx.setStorageSync('wordBookmarks', bookmarks);
      }
    } else {
      // 添加收藏
      bookmarks.push(currentWord.id);
      wx.setStorageSync('wordBookmarks', bookmarks);
    }
    
    this.setData({ isBookmarked: !isBookmarked });
    
    wx.showToast({
      title: isBookmarked ? '已取消收藏' : '已收藏',
      icon: 'success'
    });
  },

  // 检查词条是否已收藏
  checkIfBookmarked: function(wordId) {
    const bookmarks = wx.getStorageSync('wordBookmarks') || [];
    return bookmarks.includes(wordId);
  },

  // 计算学习时间
  calculateStudyTime: function() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    this.setData({
      studyTime: `${hours}:${minutes}`
    });
  },

  onShareAppMessage: function() {
    const { currentWord, examType } = this.data;
    
    if (currentWord) {
      return {
        title: `我正在学习"${currentWord.word}"，一起来学习吧！`,
        path: `/pages/word-learning/study/study?wordId=${currentWord.id}&examType=${examType}`
      };
    }
    
    return {
      title: '虚实词学习',
      path: '/pages/word-learning/index/index'
    };
  },

  // 新增：加载唯一词条
  loadUniqueWordsByCategory: function(category) {
    if (!category) return;
    this.setData({ loading: true, error: null, loaded: false });
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'groupByWordId',
        category: category
      }
    }).then(res => {
      if (res.result && res.result.success) {
        let wordList = res.result.data || [];
        
        // 处理读音和用法合并
        wordList = this.processPronunciationsAndUsages(wordList);
        
        this.setData({
          wordList,
          currentIndex: 0,
          currentPronunciationIndex: 0,
          currentUsageIndex: 0,
          currentExampleIndex: 0,
          loading: false,
          loaded: true
        }, () => {
          // 处理例句高亮
          this.processExamplesHighlight();
        });
      } else {
        this.setData({ loading: false, error: res.result.error || '获取数据失败', loaded: true });
      }
    }).catch(err => {
      this.setData({ loading: false, error: err.message || '云函数调用失败', loaded: true });
    });
  },
  
  // 新增：处理读音和用法合并
  processPronunciationsAndUsages: function(wordList) {
    return wordList.map(word => {
      if (!word.pronunciations || word.pronunciations.length === 0) {
        return word;
      }
      
      // 检查是否有多个不同的读音
      const uniquePronunciations = new Set();
      let validPronunciation = null;
      
      // 查找有效的读音
      for (const pron of word.pronunciations) {
        if (pron.pronunciation) {
          uniquePronunciations.add(pron.pronunciation);
          if (!validPronunciation) {
            validPronunciation = pron.pronunciation;
          }
        }
      }
      
      // 如果只有一种读音或者全部为空，则合并用法
      if (uniquePronunciations.size <= 1) {
        const mergedPronunciation = {
          pronunciation: validPronunciation || '',
          usages: []
        };
        
        // 用于跟踪已处理的用法ID，并存储合并后的用法
        const usageMap = new Map(); // 用法ID -> 合并后的用法对象
        
        // 第一遍扫描：收集所有用法，按ID分组
        word.pronunciations.forEach(pron => {
          if (pron.usages && pron.usages.length > 0) {
            pron.usages.forEach(usage => {
              const usageId = usage.usage_id || `anonymous_${Math.random().toString(36).substr(2, 9)}`;
              
              if (!usageMap.has(usageId)) {
                // 创建该用法ID的新条目
                usageMap.set(usageId, {
                  ...usage,
                  examples: [...(usage.examples || [])]
                });
              } else {
                // 合并例句
                const existingUsage = usageMap.get(usageId);
                
                // 确保基本信息一致
                if (!existingUsage.part_of_speech && usage.part_of_speech) {
                  existingUsage.part_of_speech = usage.part_of_speech;
                }
                if (!existingUsage.meaning && usage.meaning) {
                  existingUsage.meaning = usage.meaning;
                }
                
                // 合并例句，避免重复
                if (usage.examples && usage.examples.length > 0) {
                  const existingExampleIds = new Set(
                    existingUsage.examples.map(ex => ex.example_sentence_id || JSON.stringify(ex))
                  );
                  
                  usage.examples.forEach(example => {
                    const exampleId = example.example_sentence_id || JSON.stringify(example);
                    if (!existingExampleIds.has(exampleId)) {
                      existingUsage.examples.push(example);
                      existingExampleIds.add(exampleId);
                    }
                  });
                }
              }
            });
          }
        });
        
        // 将合并后的用法添加到结果中
        mergedPronunciation.usages = Array.from(usageMap.values());
        
        // 替换原有的读音列表
        word.pronunciations = [mergedPronunciation];
        
        console.log(`词条 ${word.word} 的读音已合并，共有 ${mergedPronunciation.usages.length} 个用法`);
      } else {
        // 有多个不同读音，则对每个读音内的用法进行去重和合并
        word.pronunciations.forEach(pron => {
          if (pron.usages && pron.usages.length > 0) {
            // 用于跟踪已处理的用法ID，并存储合并后的用法
            const usageMap = new Map(); // 用法ID -> 合并后的用法对象
            
            // 收集所有用法，按ID分组
            pron.usages.forEach(usage => {
              const usageId = usage.usage_id || `anonymous_${Math.random().toString(36).substr(2, 9)}`;
              
              if (!usageMap.has(usageId)) {
                // 创建该用法ID的新条目
                usageMap.set(usageId, {
                  ...usage,
                  examples: [...(usage.examples || [])]
                });
              } else {
                // 合并例句
                const existingUsage = usageMap.get(usageId);
                
                // 确保基本信息一致
                if (!existingUsage.part_of_speech && usage.part_of_speech) {
                  existingUsage.part_of_speech = usage.part_of_speech;
                }
                if (!existingUsage.meaning && usage.meaning) {
                  existingUsage.meaning = usage.meaning;
                }
                
                // 合并例句，避免重复
                if (usage.examples && usage.examples.length > 0) {
                  const existingExampleIds = new Set(
                    existingUsage.examples.map(ex => ex.example_sentence_id || JSON.stringify(ex))
                  );
                  
                  usage.examples.forEach(example => {
                    const exampleId = example.example_sentence_id || JSON.stringify(example);
                    if (!existingExampleIds.has(exampleId)) {
                      existingUsage.examples.push(example);
                      existingExampleIds.add(exampleId);
                    }
                  });
                }
              }
            });
            
            // 更新为合并后的用法列表
            pron.usages = Array.from(usageMap.values());
          }
        });
        
        console.log(`词条 ${word.word} 有多个不同读音，每个读音内的用法已合并`);
      }
      
      return word;
    });
  },

  // 新增：处理例句中的例词高亮
  highlightKeyword: function(sentence, keyword) {
    if (!sentence || !keyword) return sentence;
    
    // 创建一个正则表达式来匹配关键词（不区分大小写）
    const regex = new RegExp(keyword, 'gi');
    
    // 使用特殊标记替换关键词，以便在wxml中使用rich-text渲染
    const markedSentence = sentence.replace(regex, match => {
      return `<span style="color: #C83E3E; font-weight: bold;">${match}</span>`;
    });
    
    return markedSentence;
  },
  
  // 新增：处理所有例句的高亮
  processExamplesHighlight: function() {
    if (!this.data.wordList || !this.data.wordList.length) return;
    
    const wordList = [...this.data.wordList];
    
    // 遍历所有例句，添加高亮处理后的文本
    wordList.forEach((wordItem, wordIndex) => {
      if (wordItem.pronunciations && wordItem.pronunciations.length) {
        wordItem.pronunciations.forEach(pronunciation => {
          if (pronunciation.usages && pronunciation.usages.length) {
            pronunciation.usages.forEach(usage => {
              if (usage.examples && usage.examples.length) {
                usage.examples.forEach(example => {
                  // 添加高亮处理后的例句
                  example.highlightedSentence = this.highlightKeyword(example.example_sentence, wordItem.word);
                  console.log('高亮处理后的例句:', example.highlightedSentence);
                });
              }
            });
          }
        });
      }
    });
    
    this.setData({ wordList });
  },

  // 切换读音tab
  onPronunciationTabChange: function(e) {
    this.setData({
      currentPronunciationIndex: e.currentTarget.dataset.index,
      currentUsageIndex: 0,
      currentExampleIndex: 0
    }, () => {
      // 处理例句高亮
      this.processExamplesHighlight();
    });
  },
  
  // 切换用法tab
  onUsageTabChange: function(e) {
    this.setData({
      currentUsageIndex: e.currentTarget.dataset.index,
      currentExampleIndex: 0
    }, () => {
      // 处理例句高亮
      this.processExamplesHighlight();
    });
  },
  
  // 切换例句tab
  onExampleTabChange: function(e) {
    this.setData({
      currentExampleIndex: e.currentTarget.dataset.index
    });
  },
});
