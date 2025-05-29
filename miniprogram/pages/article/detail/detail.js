// 课文详情页面 - 中国传统风格优化版
const app = getApp();
// 引入OpenAI配置
const OPENAI_CONFIG = require('../../../utils/openai').OPENAI_CONFIG;
// 引入文章提示词
const { ARTICLE_PROMPTS } = require('../../../utils/openai');
// 在文件顶部引入云开发数据库
const db = wx.cloud.database();

Page({
  data: {
    // 课文基本信息
    articleId: null,
    article: null,
    
    // 课文学习状态
    isCollected: false,
    learnStatus: '未开始', // 未开始/学习中/已完成
    
    // 当前展示模块
    currentTab: 'translation', // translation-翻译, author-作者介绍, analysis-逐句解析, background-背景知识, exercise-练习巩固, qa-提问拓展
    
    // 逐句解析相关
    sentences: [],
    currentSentenceIndex: 0,
    
    // 句子导航相关
    showSentenceListDrawer: false,
    
    // 练习巩固相关
    exercises: [],
    userAnswers: [],
    showExerciseResult: false,
    exerciseScore: 0,
    optionLetters: ['A', 'B', 'C', 'D'],
    optionClassList: [],
    currentExerciseIndex: 0, // 当前题目索引
    
    // 提问拓展相关
    suggestedQuestions: [],
    qaMessages: [],
    userQuestion: '',
    
    // 样式相关
    statusBarHeight: app.globalData.statusBarHeight || 20,
    screenHeight: app.globalData.screenHeight || 667,

    // 动画相关
    animationData: {},
    
    // 原文展开/收起状态 - 默认为收起状态
    isContentCollapsed: true,
    // 是否显示展开/收起按钮
    showToggleButton: false,
    // 原文内容是否已准备好显示（用于控制初始加载时的显示逻辑）
    contentReady: false,
    // 滚动提示和底部遮罩
    showScrollTip: false,
    showBottomMask: false,
    // 展开后是否自适应高度
    isAutoExpand: false,
    
    // AI处理状态
    aiProcessing: false,
    
    // 自动加载状态
    autoLoad: false,
    
    // 学习记录相关
    enterTime: 0, // 进入页面的时间戳
    learnDuration: 0, // 本次学习时长（秒）
    isRecordingTime: false // 是否正在记录时间
  },

  onLoad: function (options) {
    console.log('Detail page onLoad with options:', options);
    // 记录进入页面的时间戳
    this.setData({
      enterTime: Date.now(),
      isRecordingTime: true
    });
    
    if (options.id) {
      this.setData({
        articleId: options.id,
        // 如果传入了auto参数，设置为自动加载状态
        autoLoad: options.auto === 'true'
      });
      this.fetchArticleDetail(options.id);
      
      // 调用云函数，记录学习记录
      this.updateUserArticleRecord(options.id);
    }
    // 只设置currentTab，不在这里直接加载tab内容
    if (options.tab && ['translation', 'analysis', 'author', 'background', 'exercise', 'qa'].includes(options.tab)) {
      console.log('Setting tab to:', options.tab);
      this.setData({
        currentTab: options.tab
      });
    }
    // 检查是否有本地学习记录
    this.checkLearningRecord();
  },
  
  // 页面显示时触发
  onShow: function() {
    // 如果之前记录过时间，且不是第一次加载（enterTime已设置）
    if (!this.data.isRecordingTime && this.data.enterTime > 0) {
      // 重新开始记录时间
      this.setData({
        enterTime: Date.now(),
        isRecordingTime: true
      });
    }
    
    // 创建动画
    this.createAnimation();
    
    // 设置导航栏按钮
    this.setNavBarButton();
    
    // 页面显示时检查文本高度
    if (this.data.article) {
      this.checkTextHeight();
    }
  },
  
  // 页面隐藏时触发
  onHide: function() {
    // 停止记录时间，计算本次学习时长
    this.calculateLearnDuration();
  },
  
  // 页面卸载时触发
  onUnload: function() {
    // 停止记录时间，计算本次学习时长
    this.calculateLearnDuration();
  },
  
  // 计算学习时长并上报
  calculateLearnDuration: function() {
    if (!this.data.isRecordingTime) return;
    
    const now = Date.now();
    const enterTime = this.data.enterTime;
    const articleId = this.data.articleId;
    
    if (enterTime > 0 && articleId) {
      // 计算停留时长（秒）
      const duration = Math.floor((now - enterTime) / 1000);
      
      // 只有当停留时间大于1秒时才记录
      if (duration > 1) {
        console.log(`本次学习时长: ${duration}秒`);
        
        // 更新本地数据
        this.setData({
          learnDuration: this.data.learnDuration + duration,
          isRecordingTime: false
        });
        
        // 调用云函数更新学习时长
        this.updateLearnDuration(articleId, duration);
      }
    }
  },
  
  // 更新学习时长
  updateLearnDuration: function(articleId, duration) {
    // 调用云函数更新学习时长
    wx.cloud.callFunction({
      name: 'updateLearnDuration',
      data: {
        articleId: articleId,
        duration: duration
      },
      success: res => {
        console.log('更新学习时长成功:', res.result);
      },
      fail: err => {
        console.error('更新学习时长失败:', err);
      }
    });
  },
  
  // 设置导航栏按钮
  setNavBarButton: function() {
    if (this.data.article && this.data.article.title) {
      wx.setNavigationBarTitle({
        title: this.data.article.title
      });
    }
    
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#FFFFFF'
    });
    
    // 使用页面自定义按钮，因为微信小程序没有导航栏右侧按钮API
    // 在页面中添加一个悬浮按钮用于收藏功能
  },

  // 创建页面切换动画
  createAnimation: function() {
    const animation = wx.createAnimation({
      duration: 500,
      timingFunction: 'ease',
    });
    
    animation.opacity(1).step();
    
    this.setData({
      animationData: animation.export()
    });
  },
  
  // 检查本地学习记录
  checkLearningRecord: function() {
    const articleId = this.data.articleId;
    if (!articleId) return;
    
    try {
      const learningRecord = wx.getStorageSync(`learning_record_${articleId}`);
      if (learningRecord) {
        // 恢复学习状态，但不覆盖已经设置的tab
        this.setData({
          learnStatus: learningRecord.status || '未开始',
          isCollected: learningRecord.isCollected || false
        });
      }
    } catch (e) {
      console.error('获取学习记录失败:', e);
    }
  },
  
  // 保存学习记录到本地
  saveLearningRecord: function() {
    const articleId = this.data.articleId;
    if (!articleId) return;
    
    try {
      wx.setStorageSync(`learning_record_${articleId}`, {
        status: this.data.learnStatus,
        lastTab: this.data.currentTab,
        lastTime: new Date().getTime(),
        isCollected: this.data.isCollected
      });
    } catch (e) {
      console.error('保存学习记录失败:', e);
    }
  },
  
  // 获取课文详情
  fetchArticleDetail: function (articleId) {
    console.log('尝试获取课文详情, ID:', articleId);
    
    const db = wx.cloud.database();
    
    // 首先尝试通过ID直接查询
    try {
      // 先尝试通过云数据库的_id查询（优先）
      db.collection('articles').doc(articleId).get()
        .then(res => {
          console.log('通过_id查询结果:', res);
          if (res.data) {
            // 处理获取到的课文数据
            this.processArticleData(res.data);
          } else {
            // 如果_id查询失败，尝试通过article_id字段查询
            this.queryArticleByArticleId(articleId);
          }
        })
        .catch(err => {
          console.error('通过_id查询失败:', err);
          // 尝试通过article_id字段查询
          this.queryArticleByArticleId(articleId);
        });
    } catch (err) {
      console.error('查询过程发生错误:', err);
      this.queryArticleByArticleId(articleId);
    }
  },
  
  // 通过article_id字段查询课文
  queryArticleByArticleId: function(articleId) {
    console.log('尝试通过article_id查询课文:', articleId);
    
    const db = wx.cloud.database();
    
    db.collection('articles')
      .where({
        article_id: articleId.toString()
      })
      .get()
      .then(res => {
        console.log('通过article_id查询结果:', res);
        if (res.data && res.data.length > 0) {
          // 找到了课文
          this.processArticleData(res.data[0]);
        } else {
          // 两种查询方式都失败了，显示错误
          this.showArticleNotFoundError();
        }
      })
      .catch(err => {
        console.error('通过article_id查询失败:', err);
        this.showArticleNotFoundError();
      });
  },
  
  // 显示课文未找到错误
  showArticleNotFoundError: function() {
    console.log('未找到课文数据');
    
    wx.showModal({
      title: '提示',
      content: '未找到课文数据，请返回重试',
      showCancel: false,
      success: () => {
        wx.navigateBack();
      }
    });
  },
  
  // 处理获取到的课文数据
  processArticleData: function(articleData) {
    console.log('处理课文数据:', articleData);
    if (!articleData.full_content && articleData.content) {
      articleData.full_content = articleData.content;
    }
    
    // 如果有翻译内容，处理翻译段落
    if (articleData.translation) {
      articleData.translationParagraphs = articleData.translation.split(/\n+/).filter(p => p.trim() !== '');
    } else {
      articleData.translationParagraphs = [];
    }
    
    this.setData({
      article: articleData,
      contentReady: true,
      showToggleButton: false
    });
    if (articleData.title) {
      wx.setNavigationBarTitle({ title: articleData.title });
    }
    setTimeout(() => { this.checkTextHeight(); }, 300);
    if (articleData.sentences && articleData.sentences.length > 0) {
      console.log('使用课文自带的逐句解析数据');
      this.setData({ sentences: articleData.sentences });
    } else {
      console.log('生成简单的句子划分');
      this.generateSimpleSentences(articleData.content || articleData.full_content || '');
    }
    this.generateSuggestedQuestions(articleData);
    this.playLoadAnimation();
    this.updateLastStudyRecord(articleData);
    // 只在这里自动加载tab内容，确保数据已准备好
    if (this.data.autoLoad || this.data.currentTab) {
      console.log('自动加载当前标签页内容:', this.data.currentTab);
      setTimeout(() => { this.loadTabContent(this.data.currentTab); }, 200);
    }
  },
  
  // 更新最近学习记录
  updateLastStudyRecord: function(articleData) {
    try {
      const lastStudyRecord = {
        article: {
          _id: articleData._id,
          title: articleData.title,
          author: articleData.author,
          dynasty: articleData.dynasty,
        },
        position: {
          section_type: '文章详情',
          section_index: 0
        },
        progress: 0,
        time: new Date().getTime()
      };
      
      // 保存到本地存储
      wx.setStorageSync('lastStudyRecord', lastStudyRecord);
    } catch (e) {
      console.error('保存学习记录失败:', e);
    }
  },
  
  // 生成简单的句子划分（当数据库中没有逐句解析数据时）
  generateSimpleSentences: function(content) {
    if (!content) return;
    // 统一使用新分句逻辑
    const sentencesArray = this.splitArticleIntoSentences(content);
    const sentences = sentencesArray.map((sentence, index) => {
      return {
        sentence_index: index,
        original_text: sentence,
        translation: '（暂无翻译）',
        key_words: [],
        grammar_analysis: '（暂无句子结构分析）',
        rhetorical_analysis: '（暂无修辞手法分析）'
      };
    });
    this.setData({
      sentences: sentences
    });
  },
  
  // 生成推荐问题
  generateSuggestedQuestions: function(article) {
    // 根据文章信息生成5个常见问题
    const suggestedQuestions = [
      `《${article.title}》的写作背景是什么？`,
      `${article.author}的生平经历有哪些？`,
      `《${article.title}》的主要内容是什么？`,
      `《${article.title}》的艺术特色有哪些？`,
      `《${article.title}》在${article.dynasty}文学史上的地位如何？`
    ];
    
    this.setData({
      suggestedQuestions: suggestedQuestions
    });
  },
  
  // 页面加载完成动效
  playLoadAnimation: function() {
    const animation = wx.createAnimation({
      duration: 800,
      timingFunction: 'ease',
    });
    
    animation.opacity(0).step();
    animation.opacity(1).step();
    
    this.setData({
      animationData: animation.export()
    });
    
    // 设置导航栏标题
    if (this.data.article && this.data.article.title) {
      wx.setNavigationBarTitle({
        title: this.data.article.title
      });
    }
  },
  
  // 切换标签页
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    
    if (this.data.currentTab === tab) return;
    
    console.log('切换到标签页:', tab);
    
    this.setData({
      currentTab: tab,
      // 手动切换标签页时，确保不是自动加载模式
      autoLoad: false
    });
    
    // 根据选项卡加载相应内容
    this.loadTabContent(tab);
    
    // 记录功能点击状态
    this.updateFunctionClick(tab);
    
    // 保存学习记录
    this.saveLearningRecord();
  },
  
  // 更新功能点击状态
  updateFunctionClick: function(tab) {
    const articleId = this.data.articleId;
    if (!articleId) return;
    
    // 根据tab名称映射到功能索引
    const tabToFunctionMap = {
      'translation': 1,  // 翻译功能
      'author': 2,       // 作者介绍功能
      'analysis': 3,     // 逐句解析功能
      'background': 4,   // 背景知识功能
      'exercise': 5,     // 练习巩固功能
      'qa': 6            // 提问拓展功能
    };
    
    const functionIndex = tabToFunctionMap[tab];
    if (!functionIndex) return;
    
    // 调用云函数记录功能点击
    wx.cloud.callFunction({
      name: 'updateFunctionClick',
      data: {
        articleId: articleId,
        functionIndex: functionIndex
      },
      success: res => {
        console.log('更新功能点击状态成功:', res.result);
        
        // 如果返回了学习状态，更新本地状态
        if (res.result && res.result.learnStatus) {
          const statusMap = {
            0: '未开始',
            1: '学习中',
            2: '已完成'
          };
          
          const learnStatus = statusMap[res.result.learnStatus] || this.data.learnStatus;
          
          this.setData({
            learnStatus: learnStatus
          });
          
          // 更新本地存储
          this.saveLearningRecord();
        }
      },
      fail: err => {
        console.error('更新功能点击状态失败:', err);
      }
    });
  },
  
  // 加载选项卡内容
  loadTabContent: function(tab) {
    const article = this.data.article;
    if (!article) return;
    
    switch (tab) {
      case 'translation':
        this.loadTranslation();
        break;
      case 'author':
        this.loadAuthorInfo();
        break;
      case 'analysis':
        this.loadSentenceAnalysis();
        break;
      case 'background':
        this.loadBackgroundInfo();
        break;
      case 'exercise':
        this.loadExercises();
        break;
      case 'qa':
        this.loadQA();
        break;
    }
    
    // 内容加载请求发起后，重置autoLoad状态，防止重复加载
    if (this.data.autoLoad) {
      this.setData({
        autoLoad: false
      });
    }
  },
  
  // 加载翻译内容
  loadTranslation: function() {
    const article = this.data.article;
    const article_id = article.article_id;
    const type = 'translate';
    this.setData({ aiProcessing: true });
    // 先查数据库
    db.collection('article_ai_content').where({ article_id, type }).get().then(res => {
      if (res.data && res.data.length > 0) {
        // 数据库已有，直接显示
        const translation = res.data[0].content;
        // 处理翻译文本，按换行符分割成段落
        const translationParagraphs = translation.split(/\n+/).filter(p => p.trim() !== '');
        
        this.setData({
          'article.translation': translation,
          'article.translationParagraphs': translationParagraphs,
          aiProcessing: false
        });
        this.cacheArticleData({ translation: translation });
        return;
      }
      // 数据库无，调用AI
      const prompt = this.fillPromptTemplate(ARTICLE_PROMPTS.TRANSLATE, { content: article.full_content });
      const apiMessages = [
        { role: 'system', content: '你是一个专业的文言文翻译专家，请提供准确、流畅的现代汉语翻译。请使用纯文本回复，不要使用Markdown格式。' },
        { role: 'user', content: prompt }
      ];
      wx.request({
        url: OPENAI_CONFIG.API_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OPENAI_CONFIG.API_KEY
        },
        data: { model: OPENAI_CONFIG.MODEL, messages: apiMessages, max_tokens: 4000 },
        success: (res) => {
          let translation = '';
          try {
            translation = res.data.choices[0].message.content.trim();
            // 处理翻译文本，按换行符分割成段落
            const translationParagraphs = translation.split(/\n+/).filter(p => p.trim() !== '');
            
            this.setData({
              'article.translation': translation,
              'article.translationParagraphs': translationParagraphs,
              aiProcessing: false
            });
            this.cacheArticleData({ translation });
            // 存入数据库
            db.collection('article_ai_content').add({
              data: {
                article_id,
                type,
                content: translation,
                created_at: new Date(),
                updated_at: new Date()
              }
            });
          } catch (e) {
            console.error('解析翻译结果失败', e);
            wx.showToast({ title: '翻译结果解析失败', icon: 'none' });
            this.setData({ aiProcessing: false });
          }
        },
        fail: (err) => {
          console.error('获取翻译失败', err);
          wx.showToast({ title: '获取翻译失败', icon: 'none' });
          this.setData({ aiProcessing: false });
        }
      });
    });
  },
  
  // 填充提示词模板
  fillPromptTemplate: function(template, data) {
    let result = template;
    
    // 替换模板中的变量
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, data[key]);
    });
    
    return result;
  },
  
  // 加载作者信息
  loadAuthorInfo: function() {
    const article = this.data.article;
    const article_id = article.article_id;
    const type = 'author_info';
    this.setData({ aiProcessing: true });
    db.collection('article_ai_content').where({ article_id, type }).get().then(res => {
      if (res.data && res.data.length > 0) {
        this.setData({ 'article.author_intro': res.data[0].content, aiProcessing: false });
        this.cacheArticleData({ author_intro: res.data[0].content });
        return;
      }
      const prompt = this.fillPromptTemplate(ARTICLE_PROMPTS.AUTHOR_INFO, { author: article.author, dynasty: article.dynasty });
      const apiMessages = [
        { role: 'system', content: '你是一个中国古代文学专家，请提供作者的简要介绍。请使用纯文本回复，不要使用Markdown格式。' },
        { role: 'user', content: prompt }
      ];
      wx.request({
        url: OPENAI_CONFIG.API_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OPENAI_CONFIG.API_KEY
        },
        data: { model: OPENAI_CONFIG.MODEL, messages: apiMessages },
        success: (res) => {
          try {
            const authorInfo = res.data.choices[0].message.content.trim();
            this.setData({ 'article.author_intro': authorInfo, aiProcessing: false });
            this.cacheArticleData({ author_intro: authorInfo });
            db.collection('article_ai_content').add({
              data: {
                article_id,
                type,
                content: authorInfo,
                created_at: new Date(),
                updated_at: new Date()
              }
            });
          } catch (e) {
            console.error('解析作者信息失败', e);
            wx.showToast({ title: '作者信息解析失败', icon: 'none' });
            this.setData({ aiProcessing: false });
          }
        },
        fail: (err) => {
          console.error('获取作者信息失败', err);
          wx.showToast({ title: '获取作者信息失败', icon: 'none' });
          this.setData({ aiProcessing: false });
        }
      });
    });
  },
  
  // 加载逐句解析
  loadSentenceAnalysis: function() {
    const article = this.data.article;
    // 检查是否已有句子解析，且内容完整
    let hasSentenceContent = false;
    if (this.data.sentences && this.data.sentences.length > 0 && !this.data.autoLoad) {
      // 检查第一句是否已有完整内容（拼音和翻译）
      if (this.data.sentences[0].phonetic_notation && 
          this.data.sentences[0].translation) {
        hasSentenceContent = true;
      }
    }
    // 如果已有完整句子解析，直接显示
    if (hasSentenceContent) {
      return;
    }
    // 如果已经有sentences数组但内容不完整，直接加载第一句详细解析
    if (this.data.sentences && this.data.sentences.length > 0) {
      console.log('句子数组已存在但内容不完整，加载详细解析...');
      this.setData({
        currentSentenceIndex: 0
      });
      this.loadSentenceDetail(0);
      return;
    }
    // 分割文章为句子
    const sentences = this.splitArticleIntoSentences(article.full_content);
    // 初始化句子数组
    const sentenceObjects = sentences.map(sentence => ({
      original_text: sentence,
      phonetic_notation: '',
      translation: '',
      key_words: [],
      grammar_analysis: '',
      rhetorical_analysis: ''
    }));
    this.setData({
      sentences: sentenceObjects,
      currentSentenceIndex: 0
    });
    // 加载第一句的详细解析
    this.loadSentenceDetail(0);
  },
  
  // 智能分句，支持引号处理
  splitArticleIntoSentencesSmart: function(content) {
    if (!content) return [];
    const quotePairs = {
      '“': '”',
      '‘': '’',
      '《': '》',
      '『': '』',
      '（': '）',
      '【': '】',
      '〈': '〉'
    };
    const openQuotes = Object.keys(quotePairs);
    const closeQuotes = Object.values(quotePairs);
    const result = [];
    let sentence = '';
    let inQuote = false;
    let expectedClose = '';
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      sentence += char;
      // 进入引号
      if (!inQuote && openQuotes.includes(char)) {
        inQuote = true;
        expectedClose = quotePairs[char];
        continue;
      }
      // 引号内
      if (inQuote) {
        if (char === expectedClose) {
          inQuote = false;
          expectedClose = '';
          // 判断下一个字符是否是句号（。！？；），如是则一并加入本句
          let nextChar = content[i + 1];
          if (nextChar && /[。！？；]/.test(nextChar)) {
            sentence += nextChar;
            i++; // 跳过下一个字符
          }
          // 引号闭合后立即分句
          result.push(sentence.trim());
          sentence = '';
        }
        continue;
      }
      // 句外遇到分句标点
      if (!inQuote && /[。！？；]/.test(char)) {
        result.push(sentence.trim());
        sentence = '';
      }
    }
    if (sentence.trim().length > 0) {
      result.push(sentence.trim());
    }
    return result.filter(s => s.trim().length > 0);
  },
  
  // 替换原有分句函数调用
  splitArticleIntoSentences: function(content) {
    return this.splitArticleIntoSentencesSmart(content);
  },
  
  // 加载句子详细解析
  loadSentenceDetail: function(index) {
    const sentences = this.data.sentences;
    if (!sentences || index >= sentences.length) return;
    
    const sentence = sentences[index];
    const article = this.data.article;
    const article_id = article.article_id;
    const type = 'sentence_analysis';
    this.setData({ aiProcessing: true });
    // 查库，extra为当前句子内容
    db.collection('article_ai_content').where({ article_id, type, 'extra.sentence': sentence.original_text }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const dbData = res.data[0];
        const updatedSentences = [...sentences];
        updatedSentences[index] = {
          ...sentence,
          phonetic_notation: dbData.content.phonetic_notation || '',
          translation: dbData.content.translation || '',
          key_words: dbData.content.key_words || [],
          grammar_analysis: dbData.content.grammar_analysis || '',
          rhetorical_analysis: dbData.content.rhetorical_analysis || ''
        };
        this.setData({ sentences: updatedSentences, aiProcessing: false });
        this.cacheSentenceAnalysis(index, updatedSentences[index]);
        return;
      }
      // 数据库无，调用AI
      const prompt = this.fillPromptTemplate(ARTICLE_PROMPTS.SENTENCE_ANALYSIS, { content: sentence.original_text });
      const apiMessages = [
        { role: 'system', content: '你是一个文言文教学专家，请对文言文句子进行详细解析。请使用纯文本回复，不要使用Markdown格式。' },
        { role: 'user', content: prompt }
      ];
      wx.request({
        url: OPENAI_CONFIG.API_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OPENAI_CONFIG.API_KEY
        },
        data: { model: OPENAI_CONFIG.MODEL, messages: apiMessages },
        success: (res) => {
          try {
            const analysisResult = res.data.choices[0].message.content.trim();
            // 解析结果（与原有逻辑一致）
            let phonetic = '';
            let translation = '';
            let keyWords = [];
            let grammar = '';
            let rhetoric = '';
            const phoneticMatch = analysisResult.match(/拼音标注[：:]([\s\S]*?)(?=现代汉语翻译[：:]|$)/i);
            const translationMatch = analysisResult.match(/现代汉语翻译[：:]([\s\S]*?)(?=关键词解析[：:]|$)/i);
            const keyWordsMatch = analysisResult.match(/关键词解析[：:]([\s\S]*?)(?=语法结构分析[：:]|$)/i);
            const grammarMatch = analysisResult.match(/语法结构分析[：:]([\s\S]*?)(?=修辞手法分析[：:]|$)/i);
            const rhetoricMatch = analysisResult.match(/修辞手法分析[：:]([\s\S]*?)$/i);
            if (phoneticMatch) phonetic = phoneticMatch[1].trim();
            if (translationMatch) translation = translationMatch[1].trim();
            if (keyWordsMatch) {
              const keyWordsText = keyWordsMatch[1].trim();
              const keyWordLines = keyWordsText.split('\n');
              keyWordLines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && /^\d+\./.test(trimmedLine)) {
                  const numberMatch = trimmedLine.match(/^(\d+\.)/);
                  const number = numberMatch ? numberMatch[1] : '';
                  const parts = trimmedLine.split(/[：:]/);
                  if (parts.length >= 2) {
                    const word = parts[0].trim();
                    const explanation = parts.slice(1).join(':').trim();
                    keyWords.push({ number: number, word: word.replace(/^\d+\./, '').trim(), fullWord: word, explanation: explanation });
                  }
                }
              });
            }
            if (grammarMatch) grammar = grammarMatch[1].trim();
            if (rhetoricMatch) rhetoric = rhetoricMatch[1].trim();
            const updatedSentences = [...sentences];
            updatedSentences[index] = {
              ...sentence,
              phonetic_notation: phonetic,
              translation: translation,
              key_words: keyWords,
              grammar_analysis: grammar,
              rhetorical_analysis: rhetoric
            };
            this.setData({ sentences: updatedSentences, aiProcessing: false });
            this.cacheSentenceAnalysis(index, updatedSentences[index]);
            // 存入数据库，content为结构化对象，extra为句子内容
            db.collection('article_ai_content').add({
              data: {
                article_id,
                type,
                content: {
                  phonetic_notation: phonetic,
                  translation: translation,
                  key_words: keyWords,
                  grammar_analysis: grammar,
                  rhetorical_analysis: rhetoric
                },
                extra: { sentence: sentence.original_text, sentence_index: index },
                created_at: new Date(),
                updated_at: new Date()
              }
            });
          } catch (e) {
            wx.showToast({ title: '句子解析失败', icon: 'none' });
            this.setData({ aiProcessing: false });
          }
        },
        fail: (err) => {
          wx.showToast({ title: '获取句子解析失败', icon: 'none' });
          this.setData({ aiProcessing: false });
        }
      });
    });
  },
  
  // 上一句
  prevSentence: function() {
    if (this.data.currentSentenceIndex > 0) {
      const newIndex = this.data.currentSentenceIndex - 1;
      this.setData({
        currentSentenceIndex: newIndex
      });
      
      // 加载句子详细解析
      this.loadSentenceDetail(newIndex);
    }
  },
  
  // 下一句
  nextSentence: function() {
    if (this.data.currentSentenceIndex < this.data.sentences.length - 1) {
      const newIndex = this.data.currentSentenceIndex + 1;
      this.setData({
        currentSentenceIndex: newIndex
      });
      
      // 加载句子详细解析
      this.loadSentenceDetail(newIndex);
    }
  },
  
  // 加载背景知识
  loadBackgroundInfo: function() {
    const article = this.data.article;
    const article_id = article.article_id;
    const type = 'background';
    this.setData({ aiProcessing: true });
    db.collection('article_ai_content').where({ article_id, type }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const backgroundInfo = res.data[0].content;
        // 解析三部分
        let creationBackground = '';
        let historicalBackground = '';
        let mainIdea = '';
        const creationMatch = backgroundInfo.match(/创作背景[：:]([\s\S]*?)(?=历史背景[：:]|$)/i);
        if (creationMatch) creationBackground = creationMatch[1].trim();
        const historicalMatch = backgroundInfo.match(/历史背景[：:]([\s\S]*?)(?=主旨思想[：:]|$)/i);
        if (historicalMatch) historicalBackground = historicalMatch[1].trim();
        const mainIdeaMatch = backgroundInfo.match(/主旨思想[：:]([\s\S]*?)$/i);
        if (mainIdeaMatch) mainIdea = mainIdeaMatch[1].trim();
        this.setData({
          'article.background_info': backgroundInfo,
          'article.creation_background': creationBackground || backgroundInfo,
          'article.historical_background': historicalBackground || '暂无历史背景信息',
          'article.main_idea': mainIdea || '暂无主旨思想信息',
          aiProcessing: false
        });
        this.cacheArticleData({
          background_info: backgroundInfo,
          creation_background: creationBackground || backgroundInfo,
          historical_background: historicalBackground || '暂无历史背景信息',
          main_idea: mainIdea || '暂无主旨思想信息'
        });
        return;
      }
      const prompt = this.fillPromptTemplate(ARTICLE_PROMPTS.BACKGROUND, { title: article.title, author: article.author, dynasty: article.dynasty, content: article.full_content });
      const apiMessages = [
        { role: 'system', content: '你是一个中国古代文学专家，请提供文章的背景知识介绍。请使用纯文本回复，不要使用Markdown格式。' },
        { role: 'user', content: prompt }
      ];
      wx.request({
        url: OPENAI_CONFIG.API_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OPENAI_CONFIG.API_KEY
        },
        data: { model: OPENAI_CONFIG.MODEL, messages: apiMessages },
        success: (res) => {
          try {
            const backgroundInfo = res.data.choices[0].message.content.trim();
            // 解析三部分
            let creationBackground = '';
            let historicalBackground = '';
            let mainIdea = '';
            const creationMatch = backgroundInfo.match(/创作背景[：:]([\s\S]*?)(?=历史背景[：:]|$)/i);
            if (creationMatch) creationBackground = creationMatch[1].trim();
            const historicalMatch = backgroundInfo.match(/历史背景[：:]([\s\S]*?)(?=主旨思想[：:]|$)/i);
            if (historicalMatch) historicalBackground = historicalMatch[1].trim();
            const mainIdeaMatch = backgroundInfo.match(/主旨思想[：:]([\s\S]*?)$/i);
            if (mainIdeaMatch) mainIdea = mainIdeaMatch[1].trim();
            this.setData({
              'article.background_info': backgroundInfo,
              'article.creation_background': creationBackground || backgroundInfo,
              'article.historical_background': historicalBackground || '暂无历史背景信息',
              'article.main_idea': mainIdea || '暂无主旨思想信息',
              aiProcessing: false
            });
            this.cacheArticleData({
              background_info: backgroundInfo,
              creation_background: creationBackground || backgroundInfo,
              historical_background: historicalBackground || '暂无历史背景信息',
              main_idea: mainIdea || '暂无主旨思想信息'
            });
            db.collection('article_ai_content').add({
              data: {
                article_id,
                type,
                content: backgroundInfo,
                created_at: new Date(),
                updated_at: new Date()
              }
            });
          } catch (e) {
            console.error('解析背景知识失败', e);
            wx.showToast({ title: '背景知识解析失败', icon: 'none' });
            this.setData({ aiProcessing: false });
          }
        },
        fail: (err) => {
          console.error('获取背景知识失败', err);
          wx.showToast({ title: '获取背景知识失败', icon: 'none' });
          this.setData({ aiProcessing: false });
        }
      });
    });
  },
  
  // 加载练习题
  loadExercises: function() {
    const article = this.data.article;
    const article_id = article.article_id;
    const type = 'exercise';
    this.setData({ aiProcessing: true, exercises: [], userAnswers: [], showExerciseResult: false, optionClassList: [], currentExerciseIndex: 0 });
    db.collection('article_ai_content').where({ article_id, type }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const exercises = res.data[0].content;
        const optionClassList = exercises.map(() => ['exercise-option', 'exercise-option', 'exercise-option', 'exercise-option']);
        this.setData({
          exercises,
          userAnswers: new Array(exercises.length).fill(-1),
          optionClassList,
          aiProcessing: false
        });
        this.cacheArticleData({ exercises });
        return;
      }
      // 获取适合的年级水平
      const gradeLevel = this.getArticleGradeLevel();
      const prompt = this.fillPromptTemplate(ARTICLE_PROMPTS.EXERCISE, { content: article.full_content, level: gradeLevel });
      const apiMessages = [
        { role: 'system', content: '你是一个中学文言文教师，请生成适合学生水平的练习题。请使用纯文本回复，不要使用Markdown格式。请以JSON格式返回结果。' },
        { role: 'user', content: prompt }
      ];
      wx.request({
        url: OPENAI_CONFIG.API_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OPENAI_CONFIG.API_KEY
        },
        data: { model: OPENAI_CONFIG.MODEL, messages: apiMessages },
        success: (res) => {
          try {
            const responseText = res.data.choices[0].message.content.trim();
            let exercises = [];
            try {
              const jsonMatch = responseText.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                exercises = JSON.parse(jsonMatch[0]);
              } else {
                throw new Error('无法找到有效的JSON数据');
              }
            } catch (jsonError) {
              const exerciseMatches = responseText.match(/\{"question"[\s\S]*?\}/g);
              if (exerciseMatches) {
                exercises = exerciseMatches.map(match => {
                  try { return JSON.parse(match); } catch (e) { return null; }
                }).filter(Boolean);
              }
            }
            if (exercises && exercises.length > 0) {
              const optionClassList = exercises.map(() => ['exercise-option', 'exercise-option', 'exercise-option', 'exercise-option']);
              this.setData({
                exercises,
                userAnswers: new Array(exercises.length).fill(-1),
                optionClassList,
                aiProcessing: false
              });
              this.cacheArticleData({ exercises });
              db.collection('article_ai_content').add({
                data: {
                  article_id,
                  type,
                  content: exercises,
                  extra: { level: gradeLevel },
                  created_at: new Date(),
                  updated_at: new Date()
                }
              });
            } else {
              throw new Error('未能生成有效的练习题');
            }
          } catch (e) {
            wx.showToast({ title: '练习题生成失败', icon: 'none' });
            this.setData({ aiProcessing: false });
          }
        },
        fail: (err) => {
          wx.showToast({ title: '获取练习题失败', icon: 'none' });
          this.setData({ aiProcessing: false });
        }
      });
    });
  },
  
  // 获取文章适合的年级水平
  getArticleGradeLevel: function() {
    const article = this.data.article;
    if (!article) return 'junior';
    
    // 根据文章标签或类型判断适合的年级
    if (article.tags && article.tags.includes('高中')) {
      return 'senior';
    } else if (article.tags && article.tags.includes('小学')) {
      return 'primary';
    } else {
      // 默认为初中水平
      return 'junior';
    }
  },
  
  // 加载问答功能
  loadQA: function() {
    const article = this.data.article;
    const article_id = article.article_id;
    const type = 'suggested_questions';
    this.setData({ aiProcessing: true, qaMessages: [], suggestedQuestions: [] });
    db.collection('article_ai_content').where({ article_id, type }).get().then(res => {
      if (res.data && res.data.length > 0) {
        this.setData({
          suggestedQuestions: res.data[0].content.slice(0, 5),
          aiProcessing: false
        });
        this.cacheArticleData({ suggested_questions: res.data[0].content.slice(0, 5) });
        return;
      }
      const prompt = this.fillPromptTemplate(ARTICLE_PROMPTS.SUGGESTED_QUESTIONS, { title: article.title, author: article.author, dynasty: article.dynasty, content: article.full_content });
      const apiMessages = [
        { role: 'system', content: '你是一个文言文学习顾问，请生成适合学生提问的问题。请使用纯文本回复，不要使用Markdown格式。' },
        { role: 'user', content: prompt }
      ];
      wx.request({
        url: OPENAI_CONFIG.API_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OPENAI_CONFIG.API_KEY
        },
        data: { model: OPENAI_CONFIG.MODEL, messages: apiMessages },
        success: (res) => {
          try {
            const responseText = res.data.choices[0].message.content.trim();
            const questions = responseText.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('问题') && !line.match(/^\d+[\.\、]/));
            this.setData({
              suggestedQuestions: questions.slice(0, 5),
              aiProcessing: false
            });
            this.cacheArticleData({ suggested_questions: questions.slice(0, 5) });
            db.collection('article_ai_content').add({
              data: {
                article_id,
                type,
                content: questions,
                created_at: new Date(),
                updated_at: new Date()
              }
            });
          } catch (e) {
            wx.showToast({ title: '推荐问题生成失败', icon: 'none' });
            this.setData({ aiProcessing: false });
          }
        },
        fail: (err) => {
          wx.showToast({ title: '获取推荐问题失败', icon: 'none' });
          this.setData({ aiProcessing: false });
        }
      });
    });
  },
  
  // 处理用户输入问题
  inputQuestion: function(e) {
    this.setData({
      userQuestion: e.detail.value
    });
  },
  
  // 处理点击推荐问题
  tapSuggestedQuestion: function(e) {
    const question = e.currentTarget.dataset.question;
    console.log('点击了推荐问题:', question);
    
    // 将问题和文章信息保存到全局数据
    const app = getApp();
    if (!app.globalData) {
      app.globalData = {};
    }
    
    // 构建带有上下文的问题
    const article = this.data.article;
    const contextQuestion = `关于${article.author}创作的《${article.title}》，我有一个问题，请你帮我解答，问题是：${question}`;
    
    app.globalData.pendingQuestion = contextQuestion;
    // 标记来源为文章详情页，并保存文章ID便于返回
    app.globalData.fromArticleDetail = true;
    app.globalData.articleId = this.data.articleId;
    
    // 跳转到AI助手页面（使用switchTab而不是navigateTo）
    wx.switchTab({
      url: `/pages/ai/index/index`,
      fail: (err) => {
        console.error('跳转到AI助手页面失败:', err);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none'
        });
      }
    });
  },
  
  // 提问并跳转到AI助手页面
  askQuestion: function() {
    const question = this.data.userQuestion.trim();
    if (!question) {
      wx.showToast({
        title: '请输入问题',
        icon: 'none'
      });
      return;
    }
    
    console.log('提交问题:', question);
    
    // 将问题和文章信息保存到全局数据
    const app = getApp();
    if (!app.globalData) {
      app.globalData = {};
    }
    
    // 构建带有上下文的问题
    const article = this.data.article;
    const contextQuestion = `关于${article.author}创作的《${article.title}》，我有一个问题，请你帮我解答，问题是：${question}`;
    
    app.globalData.pendingQuestion = contextQuestion;
    // 标记来源为文章详情页，并保存文章ID便于返回
    app.globalData.fromArticleDetail = true;
    app.globalData.articleId = this.data.articleId;
    
    // 跳转到AI助手页面（使用switchTab而不是navigateTo）
    wx.switchTab({
      url: `/pages/ai/index/index`,
      fail: (err) => {
        console.error('跳转到AI助手页面失败:', err);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none'
        });
      }
    });
    
    // 清空输入框
    this.setData({
      userQuestion: ''
    });
  },
  
  // 缓存文章数据到本地
  cacheArticleData: function(data) {
    const articleId = this.data.articleId;
    if (!articleId) return;
    
    try {
      const cacheKey = `article_cache_${articleId}`;
      let cachedData = wx.getStorageSync(cacheKey) || {};
      
      // 合并新数据
      cachedData = { ...cachedData, ...data };
      
      wx.setStorageSync(cacheKey, cachedData);
    } catch (e) {
      console.error('缓存文章数据失败', e);
    }
  },
  
  // 缓存句子解析到本地
  cacheSentenceAnalysis: function(index, sentenceData) {
    const articleId = this.data.articleId;
    if (!articleId) return;
    
    try {
      const cacheKey = `article_sentences_${articleId}`;
      let cachedSentences = wx.getStorageSync(cacheKey) || [];
      
      // 确保数组长度足够
      while (cachedSentences.length <= index) {
        cachedSentences.push({});
      }
      
      // 更新指定索引的句子数据
      cachedSentences[index] = sentenceData;
      
      wx.setStorageSync(cacheKey, cachedSentences);
    } catch (e) {
      console.error('缓存句子解析失败', e);
    }
  },
  
  // 缓存练习题到本地
  cacheExercises: function(exercises) {
    const articleId = this.data.articleId;
    if (!articleId) return;
    
    try {
      const cacheKey = `article_exercises_${articleId}`;
      wx.setStorageSync(cacheKey, exercises);
    } catch (e) {
      console.error('缓存练习题失败', e);
    }
  },
  
  // 从本地缓存加载数据
  loadFromCache: function() {
    const articleId = this.data.articleId;
    if (!articleId) return false;
    try {
      const cacheKey = `article_cache_${articleId}`;
      const cachedData = wx.getStorageSync(cacheKey);
      if (cachedData) {
        const article = this.data.article || {};
        this.setData({ article: { ...article, ...cachedData } });
      }
      // 只加载练习题缓存
      const exercisesCacheKey = `article_exercises_${articleId}`;
      const cachedExercises = wx.getStorageSync(exercisesCacheKey);
      if (cachedExercises && cachedExercises.length > 0) {
        const optionClassList = cachedExercises.map(() => ['exercise-option', 'exercise-option', 'exercise-option', 'exercise-option']);
        this.setData({
          exercises: cachedExercises,
          userAnswers: new Array(cachedExercises.length).fill(-1),
          showExerciseResult: false,
          optionClassList: optionClassList
        });
      }
      return { hasData: !!cachedData };
    } catch (e) {
      console.error('从缓存加载数据失败', e);
      return false;
    }
  },
  
  // 检查文本高度是否超出阈值，决定是否显示展开/收起按钮
  checkTextHeight: function() {
    console.log('开始检查文本高度...');
    
    // 将rpx转为px的辅助函数
    const rpxToPx = function(rpx) {
      return rpx / 750 * wx.getSystemInfoSync().windowWidth;
    };
    
    // 设置的收起状态高度阈值，应与CSS中的max-height对应
    const collapsedHeight = 600; // rpx单位
    const collapsedHeightPx = rpxToPx(collapsedHeight);
    
    // 使用选择器获取文本元素
    const query = wx.createSelectorQuery();
    query.select('.ancient-text').boundingClientRect();
    query.exec(res => {
      console.log('文本元素查询结果:', res);
      
      if (res && res[0]) {
        // 文本实际高度
        const textHeight = res[0].height;
        console.log('文本高度:', textHeight, 'px, 收起阈值:', collapsedHeightPx, 'px');
        
        // 只有当文本高度超过阈值时，才显示展开/收起按钮
        const shouldShowToggleButton = textHeight > collapsedHeightPx;
        
        this.setData({
          showToggleButton: shouldShowToggleButton,
          // 如果需要显示按钮，则默认为收起状态
          isContentCollapsed: shouldShowToggleButton
        });
        
        console.log('展开/收起按钮状态:', shouldShowToggleButton ? '显示' : '隐藏');
      } else {
        console.log('未能获取文本元素高度，稍后重试');
        // 如果没有获取到元素，稍后重试
        setTimeout(() => {
          this.checkTextHeight();
        }, 500);
      }
    });
  },
  
  // 屏幕尺寸变化时触发
  onResize: function() {
    // 屏幕尺寸变化时重新检查文本高度
    if (this.data.article) {
      this.checkTextHeight();
    }
  },
  
  // 监听原文区域滚动
  onAncientScroll: function(e) {
    // 只在展开状态且不是自适应高度时处理
    if (!this.data.showToggleButton || this.data.isContentCollapsed || this.data.isAutoExpand) return;
    
    const { scrollTop, scrollHeight, clientHeight } = e.detail;
    // 距底部20px以内算到底
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      if (this.data.showBottomMask) {
        this.setData({ showBottomMask: false });
      }
    } else {
      if (!this.data.showBottomMask) {
        this.setData({ showBottomMask: true });
      }
    }
  },
  
  // 展开/收起全文
  toggleContent: function() {
    console.log('切换全文展开/收起状态');
    
    // 切换展开/收起状态
    const isContentCollapsed = !this.data.isContentCollapsed;
    
    this.setData({
      isContentCollapsed: isContentCollapsed,
      // 只在展开时显示滚动提示，收起时不显示
      showScrollTip: !isContentCollapsed,
      // 展开时默认显示底部遮罩
      showBottomMask: !isContentCollapsed
    });
    
    // 如果是展开操作，设置2.5秒后自动隐藏提示
    if (!isContentCollapsed) {
      setTimeout(() => {
        this.setData({
          showScrollTip: false
        });
      }, 2500);
      
      // 等待渲染完成后滚动到顶部
      setTimeout(() => {
        wx.createSelectorQuery()
          .select('.ancient-text-container scroll-view')
          .node()
          .exec((res) => {
            if (res && res[0] && res[0].node) {
              const scrollView = res[0].node;
              scrollView.scrollTo({ top: 0, behavior: 'smooth' });
            }
          });
      }, 100);
    }
  },
  
  // 显示句子列表抽屉
  showSentenceList: function() {
    console.log('显示句子列表');
    this.setData({
      showSentenceListDrawer: true
    });
  },
  
  // 关闭句子列表抽屉
  closeSentenceList: function() {
    this.setData({
      showSentenceListDrawer: false
    });
  },
  
  // 从列表中选择句子
  selectSentenceFromList: function(e) {
    const index = e.currentTarget.dataset.index;
    console.log('从列表选择句子:', index);
    
    this.setData({
      currentSentenceIndex: index,
      showSentenceListDrawer: false
    });
    
    // 加载句子详细解析
    this.loadSentenceDetail(index);
  },
  
  // 阻止事件冒泡
  stopPropagation: function(e) {
    return false;
  },
  
  // 阻止触摸滑动事件
  preventTouchMove: function() {
    return false;
  },

  // 生成每个选项的class
  updateOptionClassList: function() {
    const { exercises, userAnswers, showExerciseResult } = this.data;
    if (!exercises || exercises.length === 0) return;
    
    const optionClassList = exercises.map((ex, idx) => {
      return ex.options.map((opt, optIdx) => {
        let baseClass = 'exercise-option';
        if (showExerciseResult) {
          if (optIdx === ex.answer) {
            return `${baseClass} option-correct`;
          } else if (userAnswers[idx] === optIdx) {
            return `${baseClass} option-wrong`;
          } else {
            return baseClass;
          }
        } else {
          if (userAnswers[idx] === optIdx) {
            return `${baseClass} option-selected`;
          } else {
            return baseClass;
          }
        }
      });
    });
    this.setData({ optionClassList });
  },

  // 选择练习选项
  selectExerciseOption: function(e) {
    const questionIndex = e.currentTarget.dataset.questionIndex;
    const optionIndex = e.currentTarget.dataset.optionIndex;
    
    console.log('选择了选项:', questionIndex, optionIndex);
    
    // 更新用户答案
    const userAnswers = [...this.data.userAnswers];
    userAnswers[questionIndex] = optionIndex;
    
    this.setData({ userAnswers });
    
    // 更新选项样式
    this.updateOptionClassList();
    
    // 如果不是最后一题，自动跳转到下一题
    if (questionIndex !== this.data.exercises.length - 1) {
      setTimeout(() => {
        this.nextExercise();
      }, 300);
    }
    // 最后一题不自动提交，等待用户点击提交按钮
  },
  
  // 下一题
  nextExercise: function() {
    const { currentExerciseIndex, exercises } = this.data;
    if (currentExerciseIndex < exercises.length - 1) {
      this.setData({
        currentExerciseIndex: currentExerciseIndex + 1
      });
    }
  },
  
  // 上一题
  prevExercise: function() {
    const { currentExerciseIndex } = this.data;
    if (currentExerciseIndex > 0) {
      this.setData({
        currentExerciseIndex: currentExerciseIndex - 1
      });
    }
  },
  
  // 提交练习答案
  submitExercises: function() {
    const { exercises, userAnswers } = this.data;
    
    // 检查是否所有题目都已作答
    const unansweredIndex = userAnswers.findIndex(answer => answer === -1);
    if (unansweredIndex !== -1) {
      wx.showToast({
        title: `第${unansweredIndex + 1}题未作答`,
        icon: 'none'
      });
      
      // 跳转到未作答的题目
      this.setData({
        currentExerciseIndex: unansweredIndex
      });
      return;
    }
    
    // 计算得分
    let score = 0;
    exercises.forEach((exercise, index) => {
      if (userAnswers[index] === exercise.answer) {
        score++;
      }
    });
    
    // 显示结果
    this.setData({
      showExerciseResult: true,
      exerciseScore: score
    });
    
    // 更新选项样式
    this.updateOptionClassList();
    
    // 更新学习状态
    if (score / exercises.length >= 0.6) {
      this.setData({
        learnStatus: '已完成'
      });
      this.saveLearningRecord();
    }
  },
  
  // 重置练习
  resetExercises: function() {
    this.setData({
      userAnswers: new Array(this.data.exercises.length).fill(-1),
      showExerciseResult: false,
      currentExerciseIndex: 0
    });
    
    // 更新选项样式
    this.updateOptionClassList();
  },
  
  // 更新用户文章学习记录
  updateUserArticleRecord: function(articleId) {
    // 调用云函数记录学习记录
    wx.cloud.callFunction({
      name: 'updateUserArticleRecord',
      data: {
        articleId: articleId
      },
      success: res => {
        console.log('更新学习记录成功:', res.result);
      },
      fail: err => {
        console.error('更新学习记录失败:', err);
      }
    });
  },
});
