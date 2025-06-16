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
    isProcessing: false,
  },

  onLoad: function (options) {
    console.log('学习页面加载，参数:', options);
    
    // 初始化防抖计时器
    this.updateCloudTimer = null;
    
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
    let wordId = options.wordId || '';
    
    console.log('解析后的参数: 分类=', category, '考试类型=', examType, '模式=', mode, '词条ID=', wordId);
    
    this.setData({
      category: category,
      examType: examType,
      mode: mode,
      loading: true
    });
    
    // 获取用户学习进度
    this.loadUserProgress();

    // 优先处理wordId参数
    if (wordId) {
      console.log('根据词条ID加载:', wordId);
      this.loadWordById(wordId);
      return;
    }

    // 根据其他参数加载不同数据
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

    // 只在没有wordId参数时加载唯一词条
    if (!wordId) {
      this.loadUniqueWordsByCategory(category || examType);
    }
    
    // 确保计数器显示正确
    this.updateWordCounter();
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

    // 调用云函数获取该分类的所有词条
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'groupByWordId',
        category: category
      }
    })
    .then(res => {
      console.log('获取分类词条成功:', res);
      
      if (res.result && res.result.success) {
        const wordList = res.result.data || [];
        const totalCount = wordList.length;
        
        if (totalCount > 0) {
          // 设置总数量和当前索引
          this.setData({
            wordList: wordList,
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
          this.processWordData(wordList);
          
          // 更新计数器显示
          this.updateWordCounter();
        } else {
          // 无词条数据，显示错误
          console.log('未找到该分类的词条');
          this.setData({
            loading: false,
            error: `未找到分类 "${category}" 的词条数据`,
            wordList: [],
            totalCount: 0
          });
          wx.showToast({
            title: '未找到词条数据',
            icon: 'none'
          });
        }
      } else {
        // 显示错误信息
        console.error('获取分类数据失败:', res.result);
        this.setData({ 
          loading: false,
          error: `获取数据失败: ${res.result ? (res.result.error || '未知错误') : '返回结果格式错误'}`,
          wordList: [],
          totalCount: 0
        });
        
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('云函数调用失败:', err);
      this.setData({
        loading: false,
        error: '调用云函数失败: ' + (err.message || JSON.stringify(err)),
        wordList: [],
        totalCount: 0
      });
      
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    });
  },

  // 更新词条计数器显示
  updateWordCounter: function() {
    const { currentIndex, wordList } = this.data;
    if (wordList && wordList.length > 0) {
      this.setData({
        wordCounter: `${currentIndex + 1}/${wordList.length}`
      });
    }
  },

  // 前往下一个词条
  goToNextWord: function() {
    const { currentIndex, wordList } = this.data;
    console.log('======= 切换到下一个词条 =======');
    console.log('当前索引:', currentIndex, '总词条数:', wordList.length);
    
    if (currentIndex < wordList.length - 1) {
      const newIndex = currentIndex + 1;
      const nextWord = wordList[newIndex];
      
      // 确保nextWord有wordId属性
      if (!nextWord.wordId && (nextWord.word_id || nextWord['例词id'] || nextWord._id)) {
        nextWord.wordId = nextWord.word_id || nextWord['例词id'] || nextWord._id;
      }
      
      console.log('新索引:', newIndex);
      console.log('切换到词条:', nextWord.word);
      
      const nextWordWithId = {
        ...nextWord,
        wordId: nextWord.wordId || nextWord.word_id || nextWord._id || nextWord.id || ''
      };
      
      this.setData({
        currentIndex: newIndex,
        currentWord: nextWordWithId,
        currentPronunciationIndex: 0,
        currentUsageIndex: 0,
        currentExampleIndex: 0,
        showMeaning: false,
        isProcessing: false // 解锁操作
      }, () => {
        this.processExamplesHighlight();
        this.updateWordCounter(); // 更新计数器显示
      });
    } else {
      console.log('已经是最后一个词条');
      wx.showToast({ title: '已完成所有词条学习', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1500);
      this.setData({ isProcessing: false });
    }
  },

  // 前往上一个词条
  goToPrevWord: function() {
    const { currentIndex, wordList } = this.data;
    console.log('======= 切换到上一个词条 =======');
    console.log('当前索引:', currentIndex, '总词条数:', wordList.length);
    
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const prevWord = wordList[newIndex];
      
      // 确保prevWord有wordId属性
      if (!prevWord.wordId && (prevWord.word_id || prevWord['例词id'] || prevWord._id)) {
        prevWord.wordId = prevWord.word_id || prevWord['例词id'] || prevWord._id;
      }
      
      console.log('新索引:', newIndex);
      console.log('切换到词条:', prevWord.word);
      
      const prevWordWithId = {
        ...prevWord,
        wordId: prevWord.wordId || prevWord.word_id || prevWord._id || prevWord.id || ''
      };
      
      this.setData({
        currentIndex: newIndex,
        currentWord: prevWordWithId,
        currentPronunciationIndex: 0,
        currentUsageIndex: 0,
        currentExampleIndex: 0,
        showMeaning: false,
        isProcessing: false // 解锁操作
      }, () => {
        this.processExamplesHighlight();
        this.updateWordCounter(); // 更新计数器显示
      });
    } else {
      console.log('已经是第一个词条');
      wx.showToast({ title: '已经是第一个词条', icon: 'none' });
      this.setData({ isProcessing: false });
    }
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
      word_id: _.in(batchIds)
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
          this.setData({
            loading: false,
            error: '没有找到词条数据'
          });
        }
      } else {
        console.error('获取所有词条失败:', res.result);
        this.setData({
          loading: false,
          error: '获取词条数据失败: ' + (res.result ? res.result.error || '未知错误' : '返回结果格式错误')
        });
      }
    })
    .catch(err => {
      console.error('获取所有词条失败:', err);
      this.setData({
        loading: false,
        error: '获取词条数据失败: ' + (err.message || JSON.stringify(err))
      });
    });
  },

  // 处理词条数据
  processWordData: function(words) {
    try {
      // 处理词条数据，转换为页面需要的格式，兼容中英文字段
      const processedWords = words.map(word => {
        try {
          // 优先使用word_id作为唯一标识，确保wordId不为空
          const wordId = word.word_id || word['例词id'] || word._id || '';
          
          // 确保collection字段存在
          let collection = word['合集'] || word.collection || this.data.category || this.data.examType || '';
          
          if (!wordId) {
            console.error('警告：检测到wordId为空的数据:', word);
          }
          
          // 构建基本词条对象
          const processedWord = {
            id: word._id || wordId || '',
            wordId: wordId, // 明确设置wordId优先级
            word: word.word || word['例词'] || '',
            pinyin: word.pronunciation || word['读音'] || '',
            usageId: word.usage_id || word['用法id'] || '',
            wordType: word.part_of_speech || word['词性'] || '',
            meaning: word.meaning || word['词义'] || '',
            example: word.example_sentence || word['例句'] || '',
            source: word.source || word['出处'] || '',
            translation: word.explanation || word['释义'] || '',
            collection: collection // 确保collection字段存在
          };
          
          // 检查是否已有pronunciations字段
          if (!word.pronunciations || !Array.isArray(word.pronunciations) || word.pronunciations.length === 0) {
            // 创建默认的pronunciations结构
            processedWord.pronunciations = [{
              pronunciation: processedWord.pinyin,
              usages: [{
                part_of_speech: processedWord.wordType,
                meaning: processedWord.meaning,
                usage_id: processedWord.usageId || 'default_usage',
                examples: [{
                  example_sentence: processedWord.example,
                  source: processedWord.source,
                  explanation: processedWord.translation,
                  example_sentence_id: 'default_example'
                }]
              }]
            }];
            
            // 生成高亮处理后的例句
            if (processedWord.pronunciations[0].usages[0].examples[0].example_sentence) {
              processedWord.pronunciations[0].usages[0].examples[0].highlightedSentence = 
                this.highlightKeyword(
                  processedWord.pronunciations[0].usages[0].examples[0].example_sentence, 
                  processedWord.word
                );
            }
          } else {
            // 已有pronunciations结构，保留原有结构
            processedWord.pronunciations = word.pronunciations;
            
            // 确保每个pronunciation都有usages
            processedWord.pronunciations.forEach((pron, pronIndex) => {
              if (!pron.usages || !Array.isArray(pron.usages) || pron.usages.length === 0) {
                pron.usages = [{
                  part_of_speech: processedWord.wordType,
                  meaning: processedWord.meaning,
                  usage_id: `usage_${pronIndex}_0`,
                  examples: [{
                    example_sentence: processedWord.example,
                    source: processedWord.source,
                    explanation: processedWord.translation,
                    example_sentence_id: `example_${pronIndex}_0_0`
                  }]
                }];
              } else {
                // 确保每个usage都有examples
                pron.usages.forEach((usage, usageIndex) => {
                  if (!usage.examples || !Array.isArray(usage.examples) || usage.examples.length === 0) {
                    usage.examples = [{
                      example_sentence: processedWord.example,
                      source: processedWord.source,
                      explanation: processedWord.translation,
                      example_sentence_id: `example_${pronIndex}_${usageIndex}_0`
                    }];
                  }
                  
                  // 生成高亮处理后的例句
                  usage.examples.forEach(example => {
                    if (example.example_sentence && !example.highlightedSentence) {
                      example.highlightedSentence = this.highlightKeyword(example.example_sentence, processedWord.word);
                    }
                  });
                });
              }
            });
          }
          
          return processedWord;
        } catch (innerErr) {
          console.error('处理单个词条数据出错:', innerErr, word);
          // 返回原始数据，避免整个列表失败
          return word;
        }
      });
      
      // 如果只有一个词条，则直接设置为当前词条
      if (processedWords.length === 1) {
        const currentWord = processedWords[0];
        
        // 检查是否已收藏
        const isBookmarked = this.checkIfBookmarked(currentWord.wordId);
        
        this.setData({
          wordList: processedWords,
          currentWord: currentWord,
          currentIndex: 0,
          isBookmarked: isBookmarked,
          loading: false,
          loaded: true,
          error: null
        }, () => {
          // 处理例句高亮
          this.processExamplesHighlight();
          // 更新计数器显示
          this.updateWordCounter();
        });
      } else {
        // 如果有多个词条，则设置整个列表，并显示当前索引的词条
        const currentIndex = this.data.currentIndex || 0;
        const currentWord = processedWords[currentIndex] || processedWords[0];
        
        // 检查是否已收藏
        const isBookmarked = this.checkIfBookmarked(currentWord.wordId);
        
        this.setData({
          wordList: processedWords,
          currentWord: currentWord,
          currentIndex: currentIndex,
          isBookmarked: isBookmarked,
          loading: false,
          loaded: true,
          error: null
        }, () => {
          // 处理例句高亮
          this.processExamplesHighlight();
          // 更新计数器显示
          this.updateWordCounter();
        });
      }
    } catch (err) {
      console.error('处理词条数据出错:', err);
      this.setData({
        loading: false,
        error: '处理数据出错: ' + err.message,
        loaded: true
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
    if (this.data.isProcessing) return;
    this.setData({ isProcessing: true });
    
    const { currentIndex, wordList } = this.data;
    
    // 添加调试日志
    console.log('======= 标记为已掌握 =======');
    console.log('当前索引:', currentIndex);
    console.log('总词条数:', wordList.length);
    
    if (wordList && wordList.length > 0 && currentIndex >= 0 && currentIndex < wordList.length) {
      const wordFromList = wordList[currentIndex];
      
      // 确保词条有wordId字段
      if (!wordFromList.wordId) {
        wordFromList.wordId = wordFromList.word_id || wordFromList['例词id'] || wordFromList._id || wordFromList.id || '';
      }
      
      // 确保currentWord与wordList中的当前词一致
      this.setData({ currentWord: wordFromList }, () => {
        const currentWord = this.data.currentWord;
        console.log('当前词条:', currentWord.word);
        
        // 获取有效的wordId
        let wordId = currentWord.wordId;
        if (!wordId) {
          wordId = currentWord.word_id || currentWord['例词id'] || currentWord._id || currentWord.id || '';
          console.log('从其他字段获取wordId:', wordId);
        }
        
        if (!wordId) {
          console.error('无法获取有效的wordId，无法标记学习状态');
          this.setData({ isProcessing: false });
          wx.showToast({
            title: '操作失败，词条ID无效',
            icon: 'none'
          });
          return;
        }
        
        // 获取当前词条的合集/分类
        let collection = '';
        if (currentWord.collection) {
          collection = currentWord.collection;
        } else if (this.data.category) {
          collection = this.data.category;
        } else if (this.data.examType) {
          collection = this.data.examType;
        }
        
        console.log('当前词条合集:', collection);
        
        const progress = this.data.userProgress;
        
        progress[wordId] = {
          ...progress[wordId],
          status: 'learned',
          lastStudied: new Date().getTime(),
          collection: collection
        };
      
        this.setData({ userProgress: progress });
        this.saveUserProgress();
        this.saveRecentLearnHistory(wordId, 'learned', collection);
        this.updateUserWordProgressCloud(wordId, collection, 'learned');
        
        // 调用goToNextWord函数跳转到下一个词条
        this.goToNextWord();
      });
    } else {
      this.setData({ isProcessing: false });
      console.error('wordList无效或currentIndex超出范围，无法标记学习状态');
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 标记为需要复习
  markForReview: function() {
    if (this.data.isProcessing) return;
    this.setData({ isProcessing: true });
    
    const { currentIndex, wordList } = this.data;
    
    // 添加调试日志
    console.log('======= 标记为需要复习 =======');
    console.log('当前索引:', currentIndex);
    console.log('总词条数:', wordList.length);
    
    if (wordList && wordList.length > 0 && currentIndex >= 0 && currentIndex < wordList.length) {
      const wordFromList = wordList[currentIndex];
      
      // 确保词条有wordId字段
      if (!wordFromList.wordId) {
        wordFromList.wordId = wordFromList.word_id || wordFromList['例词id'] || wordFromList._id || wordFromList.id || '';
      }
      
      // 确保currentWord与wordList中的当前词一致
      this.setData({ currentWord: wordFromList }, () => {
        const currentWord = this.data.currentWord;
        console.log('当前词条:', currentWord.word);
        
        // 获取有效的wordId
        let wordId = currentWord.wordId;
        if (!wordId) {
          wordId = currentWord.word_id || currentWord['例词id'] || currentWord._id || currentWord.id || '';
          console.log('从其他字段获取wordId:', wordId);
        }
        
        if (!wordId) {
          console.error('无法获取有效的wordId，无法标记学习状态');
          this.setData({ isProcessing: false });
          wx.showToast({
            title: '操作失败，词条ID无效',
            icon: 'none'
          });
          return;
        }
        
        // 获取当前词条的合集/分类
        let collection = '';
        if (currentWord.collection) {
          collection = currentWord.collection;
        } else if (this.data.category) {
          collection = this.data.category;
        } else if (this.data.examType) {
          collection = this.data.examType;
        }
        
        console.log('当前词条合集:', collection);
        
        const progress = this.data.userProgress;
        
        progress[wordId] = {
          ...progress[wordId],
          status: 'review',
          lastStudied: new Date().getTime(),
          collection: collection
        };
      
        this.setData({ userProgress: progress });
        this.saveUserProgress();
        this.saveRecentLearnHistory(wordId, 'review', collection);
        this.updateUserWordProgressCloud(wordId, collection, 'review');
        
        // 调用goToNextWord函数跳转到下一个词条
        this.goToNextWord();
      });
    } else {
      this.setData({ isProcessing: false });
      console.error('wordList无效或currentIndex超出范围，无法标记学习状态');
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 保存最近学习记录，带合集字段
  saveRecentLearnHistory: function(wordId, status, collection) {
    const word = this.data.currentWord;
    if (!word) return;
    const record = {
      wordId: wordId,
      word: word.word,
      status: status,
      learnTime: new Date().toISOString(),
      collection: collection
    };
    let history = wx.getStorageSync('wordLearnHistory') || [];
    // 按 wordId+collection 去重
    history = history.filter(item => !(item.wordId === wordId && item.collection === collection));
    history.unshift(record);
    wx.setStorageSync('wordLearnHistory', history);
  },

  // 返回首页
  goBack: function() {
    wx.navigateBack();
  },

  // 通过ID加载词条
  loadWordById: function(wordId) {
    if (!wordId) return;
    
    // 尝试解码URL编码的wordId
    try {
      if (/%[0-9A-F]{2}/.test(wordId)) {
        wordId = decodeURIComponent(wordId);
      }
    } catch (e) {
      console.error('解码wordId失败:', e);
    }
    
    this.setData({ 
      loading: true,
      error: `正在加载词条ID: ${wordId}...`
    });
    
    console.log('======= 通过ID加载词条 =======');
    console.log('词条ID:', wordId);
    
    // 尝试直接通过ID查询，不指定字段名
    db.collection('xushici').doc(wordId).get().then(res => {
      console.log('直接通过ID查询结果:', res);
      
      if (res.data) {
        console.log('直接通过ID找到词条:', res.data);
        
        // 获取词条所属的分类
        const category = res.data['合集'] || res.data.collection || this.data.category || '';
        
        // 如果找到分类，加载该分类的所有词条
        if (category) {
          console.log('找到词条所属分类:', category);
          this.loadCategoryAndSetCurrentWord(category, res.data);
        } else {
          // 如果没有找到分类，只处理当前词条
          console.log('未找到词条所属分类，只处理当前词条');
          this.processWordData([res.data]);
        }
        
        return; // 查询成功，直接返回
      }
    }).catch(err => {
      console.log('直接通过ID查询失败，尝试使用字段查询:', err);
      
      // 继续尝试使用字段查询
      // 查询数据库 - 优先使用word_id字段查询
      db.collection('xushici').where({
        word_id: wordId
      }).get().then(res => {
        console.log('通过word_id查询结果:', res);
        
        if (res.data && res.data.length > 0) {
          console.log('通过word_id找到词条:', res.data[0]);
          
          // 获取词条所属的分类
          const category = res.data[0]['合集'] || res.data[0].collection || this.data.category || '';
          
          // 如果找到分类，加载该分类的所有词条
          if (category) {
            console.log('找到词条所属分类:', category);
            this.loadCategoryAndSetCurrentWord(category, res.data[0]);
          } else {
            // 如果没有找到分类，只处理当前词条
            console.log('未找到词条所属分类，只处理当前词条');
            this.processWordData(res.data);
          }
        } else {
          console.log('通过word_id未找到词条，尝试使用例词id查询:', wordId);
          
          // 尝试使用例词id字段查询
          db.collection('xushici').where({
            例词id: wordId
          }).get().then(res2 => {
            if (res2.data && res2.data.length > 0) {
              console.log('通过例词id找到词条:', res2.data[0]);
              
              // 获取词条所属的分类
              const category = res2.data[0]['合集'] || res2.data[0].collection || this.data.category || '';
              
              // 如果找到分类，加载该分类的所有词条
              if (category) {
                console.log('找到词条所属分类:', category);
                this.loadCategoryAndSetCurrentWord(category, res2.data[0]);
              } else {
                // 如果没有找到分类，只处理当前词条
                console.log('未找到词条所属分类，只处理当前词条');
                this.processWordData(res2.data);
              }
            } else {
              console.log('通过例词id未找到词条，尝试使用_id查询:', wordId);
              
              // 再尝试使用_id字段查询
              db.collection('xushici').where({
                _id: wordId
              }).get().then(res3 => {
                if (res3.data && res3.data.length > 0) {
                  console.log('通过_id找到词条:', res3.data[0]);
                  
                  // 获取词条所属的分类
                  const category = res3.data[0]['合集'] || res3.data[0].collection || this.data.category || '';
                  
                  // 如果找到分类，加载该分类的所有词条
                  if (category) {
                    console.log('找到词条所属分类:', category);
                    this.loadCategoryAndSetCurrentWord(category, res3.data[0]);
                  } else {
                    // 如果没有找到分类，只处理当前词条
                    console.log('未找到词条所属分类，只处理当前词条');
                    this.processWordData(res3.data);
                  }
                } else {
                  // 尝试使用模糊查询
                  console.log('尝试使用模糊查询:', wordId);
                  this.tryFuzzySearch(wordId);
                }
              }).catch(err3 => {
                console.error('三次查询失败:', err3);
                // 尝试使用模糊查询
                this.tryFuzzySearch(wordId);
              });
            }
          }).catch(err2 => {
            console.error('二次查询失败:', err2);
            this.setData({ 
              loading: false,
              error: `查询失败: ${err2.message || JSON.stringify(err2)}`,
              loaded: true
            });
          });
        }
      }).catch(err => {
        console.error('加载词条失败:', err);
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
        this.setData({ 
          loading: false,
          error: `加载失败: ${err.message || JSON.stringify(err)}`,
          loaded: true
        });
      });
    });
  },
  
  // 加载分类并设置当前词条
  loadCategoryAndSetCurrentWord: function(category, currentWordData) {
    console.log('加载分类并设置当前词条:', category);
    
    // 调用云函数获取该分类的所有词条
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'groupByWordId',
        category: category
      }
    })
    .then(res => {
      console.log('获取分类词条成功:', res);
      
      if (res.result && res.result.success) {
        const wordList = res.result.data || [];
        const totalCount = wordList.length;
        
        if (totalCount > 0) {
          // 处理词条数据
          const processedWords = this.processAllWords(wordList);
          
          // 找到当前词条在列表中的索引
          const currentWordId = currentWordData.word_id || currentWordData['例词id'] || currentWordData._id || '';
          let currentIndex = 0;
          
          if (currentWordId) {
            const foundIndex = processedWords.findIndex(word => 
              word.wordId === currentWordId || 
              word.word_id === currentWordId || 
              word['例词id'] === currentWordId || 
              word._id === currentWordId
            );
            
            if (foundIndex !== -1) {
              currentIndex = foundIndex;
            }
          }
          
          console.log('当前词条在列表中的索引:', currentIndex);
          
          // 设置数据
          this.setData({
            wordList: processedWords,
            totalCount: totalCount,
            currentIndex: currentIndex,
            currentWord: processedWords[currentIndex],
            categoryInfo: {
              category: category,
              totalCount: totalCount
            },
            loading: false,
            error: null,
            loaded: true
          }, () => {
            // 处理例句高亮
            this.processExamplesHighlight();
            // 更新计数器显示
            this.updateWordCounter();
          });
        } else {
          // 如果没有找到分类词条，只处理当前词条
          console.log('未找到该分类的词条，只处理当前词条');
          this.processWordData([currentWordData]);
        }
      } else {
        // 如果获取分类词条失败，只处理当前词条
        console.log('获取分类词条失败，只处理当前词条');
        this.processWordData([currentWordData]);
      }
    })
    .catch(err => {
      console.error('加载分类词条失败:', err);
      // 如果加载分类词条失败，只处理当前词条
      this.processWordData([currentWordData]);
    });
  },

  // 尝试模糊搜索词条ID
  tryFuzzySearch: function(wordId) {
    // 使用云函数进行模糊查询
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'byFuzzyId',
        wordId: wordId
      }
    }).then(res => {
      if (res.result && res.result.success && res.result.data && res.result.data.length > 0) {
        console.log('通过模糊匹配找到词条:', res.result.data[0]);
        
        // 处理数据前先检查数据结构
        const matchedData = res.result.data;
        
        // 检查是否有词条数据
        if (matchedData.length > 0) {
          // 获取词条所属的分类
          const firstWord = matchedData[0];
          const category = firstWord['合集'] || firstWord.collection || this.data.category || '';
          
          // 如果找到分类，加载该分类的所有词条
          if (category) {
            console.log('找到词条所属分类:', category);
            this.loadCategoryAndSetCurrentWord(category, firstWord);
          } else {
            // 如果没有找到分类，只处理当前词条
            console.log('未找到词条所属分类，只处理当前词条');
            this.processWordData(matchedData);
          }
        } else {
          wx.showToast({
            title: '未找到词条',
            icon: 'none'
          });
          this.setData({ 
            loading: false,
            error: `未找到ID为 ${wordId} 的词条`,
            loaded: true
          });
        }
      } else {
        wx.showToast({
          title: '未找到词条',
          icon: 'none'
        });
        this.setData({ 
          loading: false,
          error: `未找到ID为 ${wordId} 的词条`,
          loaded: true
        });
      }
    }).catch(err => {
      console.error('模糊查询失败:', err);
      this.setData({ 
        loading: false,
        error: `查询失败: ${err.message || JSON.stringify(err)}`,
        loaded: true
      });
    });
  },

  // 通过词文本加载词条
  loadWordByText: function(wordText) {
    if (!wordText) return;
    
    this.setData({ loading: true });
    
    // 查询数据库
    db.collection('xushici').where({
      word: wordText // 优先使用英文字段名
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        this.processWordData(res.data);
        this.setData({ loading: false, error: null });
      } else {
        // 如果使用英文字段名查询失败，尝试使用中文字段名
        db.collection('xushici').where({
          例词: wordText
        }).get().then(res2 => {
          if (res2.data && res2.data.length > 0) {
            this.processWordData(res2.data);
            this.setData({ loading: false, error: null });
      } else {
        wx.showToast({
          title: '未找到词条',
          icon: 'none'
            });
            this.setData({ loading: false, error: '未找到匹配的词条' });
          }
        }).catch(err2 => {
          console.error('使用中文字段名加载词条失败:', err2);
          wx.showToast({
            title: '加载失败，请重试',
            icon: 'none'
          });
          this.setData({ loading: false, error: `加载失败: ${err2.message || JSON.stringify(err2)}` });
        });
      }
    }).catch(err => {
      console.error('加载词条失败:', err);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      this.setData({ loading: false, error: `加载失败: ${err.message || JSON.stringify(err)}` });
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
        path: `/pages/word-learning/study/study?wordId=${currentWord.wordId}&examType=${examType}`
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
    console.log('======= 加载分类词条 =======');
    console.log('分类:', category);
    
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'groupByWordId',
        category: category
      }
    }).then(res => {
      if (res.result && res.result.success) {
        let wordList = res.result.data || [];
        
        console.log('获取到词条数量:', wordList.length);
        
        // 先确保所有词条都有wordId字段
        wordList = wordList.map(word => {
          if (!word.wordId) {
            word.wordId = word.word_id || word['例词id'] || word._id || '';
          }
          
          // 确保collection字段正确
          if (!word.collection) {
            word.collection = word['合集'] || category;
          }
          
          return word;
        });
        
        // 过滤掉没有wordId的词条
        const filteredList = wordList.filter(word => word.wordId);
        if (filteredList.length < wordList.length) {
          console.warn(`过滤掉了${wordList.length - filteredList.length}个没有wordId的词条`);
          wordList = filteredList;
        }
        
        // 处理读音和用法合并
        wordList = this.processPronunciationsAndUsages(wordList);
        
        // 确保有词条存在
        if (wordList.length === 0) {
          this.setData({
            loading: false, 
            error: '该分类下没有词条',
            loaded: true,
            totalCount: 0
          });
          return;
        }
        
        // 确保第一个词条有wordId和collection
        const firstWord = wordList[0];
        const firstWordWithId = {
          ...firstWord,
          wordId: firstWord.wordId || firstWord.word_id || firstWord['例词id'] || firstWord._id || '',
          collection: firstWord.collection || firstWord['合集'] || category
        };
        
        // 更新第一个词条
        wordList[0] = firstWordWithId;
        
        this.setData({
          wordList,
          currentIndex: 0,
          currentWord: firstWordWithId,
          currentPronunciationIndex: 0,
          currentUsageIndex: 0,
          currentExampleIndex: 0,
          loading: false,
          loaded: true,
          totalCount: wordList.length, // 设置总数量
          categoryInfo: {
            category: category,
            totalCount: wordList.length
          }
        }, () => {
          // 处理例句高亮
          this.processExamplesHighlight();
          
          // 添加调试日志
          console.log('======= 设置词条完成 =======');
        });
      } else {
        this.setData({ 
          loading: false, 
          error: res.result.error || '获取数据失败', 
          loaded: true 
        });
      }
    }).catch(err => {
      console.error('加载词条失败:', err);
      this.setData({ 
        loading: false, 
        error: err.message || '云函数调用失败', 
        loaded: true 
      });
    });
  },
  
  // 新增：处理读音和用法合并
  processPronunciationsAndUsages: function(wordList) {
    return wordList.map(word => {
      // 先保留原始的ID字段，避免后面处理中丢失
      const backupId = word.word_id || word['例词id'] || word._id || '';
      
      if (!word.wordId && backupId) {
        // 如果没有wordId字段但有其他ID字段，则添加wordId字段
        word.wordId = backupId;
      }
      
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

  // 云端同步用户学习进度
  updateUserWordProgressCloud: function(wordId, collection, status) {
    if (!wordId) {
      // 尝试从currentWord获取wordId
      const { currentWord, currentIndex, wordList } = this.data;
      console.error('wordId不能为空，尝试从currentWord获取');
      
      // 从wordList的当前索引获取
      let wordFromList = null;
      if (wordList && wordList.length > 0 && currentIndex >= 0 && currentIndex < wordList.length) {
        wordFromList = wordList[currentIndex];
      }
      
      // 尝试获取wordId
      let retrievedWordId = '';
      
      if (currentWord && currentWord.wordId) {
        retrievedWordId = currentWord.wordId;
      } else if (currentWord && (currentWord.word_id || currentWord['例词id'] || currentWord._id || currentWord.id)) {
        retrievedWordId = currentWord.word_id || currentWord['例词id'] || currentWord._id || currentWord.id;
      } else if (wordFromList && wordFromList.wordId) {
        retrievedWordId = wordFromList.wordId;
      } else if (wordFromList && (wordFromList.word_id || wordFromList['例词id'] || wordFromList.id)) {
        retrievedWordId = wordFromList.word_id || wordFromList['例词id'] || wordFromList.id;
      }
      
      if (!retrievedWordId) {
        console.error('无法获取到有效的wordId，无法同步云端进度');
        return;
      }
      
      wordId = retrievedWordId;
    }
    
    // 确保集合名称是有效的字符串
    if (!collection) {
      const { currentWord } = this.data;
      if (currentWord && currentWord.collection) {
        collection = currentWord.collection;
      } else if (this.data.category) {
        collection = this.data.category;
      } else if (this.data.examType) {
        collection = this.data.examType;
      } else {
        collection = '未分类';
      }
    }
    
    // 检查集合名称是否已经是URL编码格式，如果是则解码
    if (/%[0-9A-F]{2}/.test(collection)) {
      try {
        collection = decodeURIComponent(collection);
        console.log('集合名称已解码:', collection);
      } catch (e) {
        console.error('解码集合名称失败:', e);
      }
    }
    
    console.log('======= 同步云端进度 =======');
    console.log('wordId:', wordId);
    console.log('collection:', collection);
    console.log('status:', status);
    
    let userId = '';
    // 优先从 userInfo 获取 openid
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      userId = userInfo.openid;
    } else if (app.globalData && app.globalData.openid) {
      userId = app.globalData.openid;
    }
    
    if (!userId) {
      console.warn('未获取到用户openid，无法同步云端进度');
      return;
    }
    
    // 添加防抖，防止短时间内重复调用
    if (this.updateCloudTimer) clearTimeout(this.updateCloudTimer);
    
    this.updateCloudTimer = setTimeout(() => {
      // 确保collection是原始字符串，不要进行URL编码
      wx.cloud.callFunction({
        name: 'updateUserWordProgress',
        data: {
          userId,
          wordId,
          collection, // 直接传递原始集合名称，云函数会处理解码
          status
        },
        success: res => {
          console.log('云端进度同步成功', res);
        },
        fail: err => {
          console.error('云端进度同步失败', err);
        }
      });
    }, 300); // 300ms防抖延迟
  },

  // 添加onShow函数，在页面显示时更新计数器
  onShow: function() {
    console.log('页面显示');
    // 更新计数器显示
    this.updateWordCounter();
  },

  // 处理所有词条数据
  processAllWords: function(words) {
    if (!words || words.length === 0) {
      console.error('没有词条数据可处理');
      return [];
    }
    
    try {
      // 处理词条数据，转换为页面需要的格式
      const processedWords = words.map(word => this.processSingleWord(word));
      console.log('处理完成，词条数量:', processedWords.length);
      return processedWords;
    } catch (err) {
      console.error('处理所有词条数据出错:', err);
      return [];
    }
  },

  // 处理单个词条
  processSingleWord: function(word) {
    // 优先使用word_id作为唯一标识，确保wordId不为空
    const wordId = word.word_id || word['例词id'] || word._id || '';
    
    // 确保collection字段存在
    let collection = word['合集'] || word.collection || this.data.category || this.data.examType || '';
    
    // 构建基本词条对象
    const processedWord = {
      id: word._id || wordId || '',
      wordId: wordId, // 明确设置wordId优先级
      word: word.word || word['例词'] || '',
      pinyin: word.pronunciation || word['读音'] || '',
      usageId: word.usage_id || word['用法id'] || '',
      wordType: word.part_of_speech || word['词性'] || '',
      meaning: word.meaning || word['词义'] || '',
      example: word.example_sentence || word['例句'] || '',
      source: word.source || word['出处'] || '',
      translation: word.explanation || word['释义'] || '',
      collection: collection // 确保collection字段存在
    };
    
    // 检查是否已有pronunciations字段
    if (!word.pronunciations || !Array.isArray(word.pronunciations) || word.pronunciations.length === 0) {
      // 创建默认的pronunciations结构
      processedWord.pronunciations = [{
        pronunciation: processedWord.pinyin,
        usages: [{
          part_of_speech: processedWord.wordType,
          meaning: processedWord.meaning,
          usage_id: processedWord.usageId || 'default_usage',
          examples: [{
            example_sentence: processedWord.example,
            source: processedWord.source,
            explanation: processedWord.translation,
            example_sentence_id: 'default_example'
          }]
        }]
      }];
      
      // 生成高亮处理后的例句
      if (processedWord.pronunciations[0].usages[0].examples[0].example_sentence) {
        processedWord.pronunciations[0].usages[0].examples[0].highlightedSentence = 
          this.highlightKeyword(
            processedWord.pronunciations[0].usages[0].examples[0].example_sentence, 
            processedWord.word
          );
      }
    } else {
      // 已有pronunciations结构，保留原有结构
      processedWord.pronunciations = word.pronunciations;
      
      // 确保每个pronunciation都有usages
      processedWord.pronunciations.forEach((pron, pronIndex) => {
        if (!pron.usages || !Array.isArray(pron.usages) || pron.usages.length === 0) {
          pron.usages = [{
            part_of_speech: processedWord.wordType,
            meaning: processedWord.meaning,
            usage_id: `usage_${pronIndex}_0`,
            examples: [{
              example_sentence: processedWord.example,
              source: processedWord.source,
              explanation: processedWord.translation,
              example_sentence_id: `example_${pronIndex}_0_0`
            }]
          }];
        } else {
          // 确保每个usage都有examples
          pron.usages.forEach((usage, usageIndex) => {
            if (!usage.examples || !Array.isArray(usage.examples) || usage.examples.length === 0) {
              usage.examples = [{
                example_sentence: processedWord.example,
                source: processedWord.source,
                explanation: processedWord.translation,
                example_sentence_id: `example_${pronIndex}_${usageIndex}_0`
              }];
            }
            
            // 生成高亮处理后的例句
            usage.examples.forEach(example => {
              if (example.example_sentence && !example.highlightedSentence) {
                example.highlightedSentence = this.highlightKeyword(example.example_sentence, processedWord.word);
              }
            });
          });
        }
      });
    }
    
    return processedWord;
  },
});
