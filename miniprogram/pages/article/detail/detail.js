// 课文详情页面 - 中国传统风格优化版
const app = getApp();
// 引入AI服务
const { aiService } = require('../../../utils/ai');
// 引入OpenAI兼容API服务
const { articleAIService } = require('../../../utils/openai');

Page({
  data: {
    // 课文基本信息
    articleId: null,
    article: null,
    loading: true,
    
    // 课文学习状态
    isCollected: false,
    learnStatus: '未开始', // 未开始/学习中/已完成
    
    // 当前展示模块
    currentTab: 'translation', // translation-翻译, author-作者介绍, analysis-逐句解析, background-背景知识, exercise-练习巩固, qa-提问拓展
    
    // 逐句解析相关
    sentences: [],
    currentSentenceIndex: 0,
    
    // 练习巩固相关
    exercises: [],
    userAnswers: [],
    showExerciseResult: false,
    exerciseScore: 0,
    
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
    aiProcessing: false
  },

  onLoad: function (options) {
    console.log('Detail page onLoad with options:', options);
    
    if (options.id) {
      this.setData({
        articleId: options.id
      });
      this.fetchArticleDetail(options.id);
    }

    // 如果URL参数中有tab，则切换到对应选项卡
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
    // 创建动画
    this.createAnimation();
    
    // 设置导航栏按钮
    this.setNavBarButton();
    
    // 页面显示时检查文本高度
    if (this.data.article) {
      this.checkTextHeight();
    }
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
    
    this.setData({
      loading: false
    });
    
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
    
    // 获取到课文数据
    this.setData({
      article: articleData,
      loading: false,
      // 先将内容设置为可见，以便后续测量高度
      contentReady: true,
      // 默认不显示展开/收起按钮，等待高度检测后再决定
      showToggleButton: false
    });
    
    // 设置导航栏标题
    if (articleData.title) {
      wx.setNavigationBarTitle({
        title: articleData.title
      });
    }
    
    // 在数据加载后，等待视图渲染完成，再检查文本高度
    // 使用足够长的延迟确保视图已完全渲染
    setTimeout(() => {
      this.checkTextHeight();
    }, 300);
    
    // 如果有逐句解析，加载逐句解析数据
    if (articleData.sentences && articleData.sentences.length > 0) {
      console.log('使用课文自带的逐句解析数据');
      this.setData({
        sentences: articleData.sentences
      });
    } else {
      console.log('生成简单的句子划分');
      // 没有逐句解析数据，生成简单的句子划分
      this.generateSimpleSentences(articleData.content || articleData.full_content || '');
    }
    
    // 如果有练习数据，加载练习数据
    if (articleData.exercises && articleData.exercises.length > 0) {
      console.log('使用课文自带的练习数据');
      this.setData({
        exercises: articleData.exercises,
        userAnswers: new Array(articleData.exercises.length).fill('')
      });
    } else {
      console.log('生成简单的练习题');
      // 没有练习数据，生成简单的练习题
      this.generateSimpleExercises(articleData);
    }
    
    // 生成推荐问题
    this.generateSuggestedQuestions(articleData);
    
    // 播放加载完成动效
    this.playLoadAnimation();
    
    // 更新最近学习记录
    this.updateLastStudyRecord(articleData);
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
    
    // 简单按句号、问号、感叹号分割
    const sentenceDelimiters = /[。！？]/g;
    const contentWithMarks = content.replace(sentenceDelimiters, match => match + '|');
    const sentencesArray = contentWithMarks.split('|').filter(item => item.trim().length > 0);
    
    const sentences = sentencesArray.map((sentence, index) => {
      return {
        sentence_index: index,
        original_text: sentence,
        punctuated_text: sentence,
        translation: '（暂无翻译）',
        key_words_explanation: '（暂无关键词解释）',
        sentence_structure: '（暂无句子结构分析）',
        rhetorical_analysis: '（暂无修辞手法分析）'
      };
    });
    
    this.setData({
      sentences: sentences
    });
  },
  
  // 生成简单的练习题（当数据库中没有练习数据时）
  generateSimpleExercises: function(article) {
    // 根据文章信息生成简单的练习题
    const exercises = [
      {
        exercise_id: '1',
        question: `《${article.title}》的作者是谁？`,
        options: [article.author, '司马迁', '李白', '杜甫'],
        answer: article.author
      },
      {
        exercise_id: '2',
        question: `《${article.title}》是哪个朝代的作品？`,
        options: [article.dynasty, '唐朝', '宋朝', '清朝'],
        answer: article.dynasty
      },
      {
        exercise_id: '3',
        question: `下列哪一项是《${article.title}》的内容特点？`,
        options: ['言简意赅', '文采飞扬', '意境深远', '情感真挚'],
        answer: '情感真挚'
      }
    ];
    
    // 随机打乱选项的顺序，但保持正确答案
    exercises.forEach(exercise => {
      const correctAnswer = exercise.answer;
      // 确保正确答案在选项中
      if (!exercise.options.includes(correctAnswer)) {
        exercise.options[0] = correctAnswer;
      }
      
      // 打乱选项顺序
      const randomOptions = this.shuffleArray([...exercise.options]);
      exercise.options = randomOptions;
      // 更新正确答案的索引
      exercise.answer = correctAnswer;
    });
    
    this.setData({
      exercises: exercises,
      userAnswers: new Array(exercises.length).fill('')
    });
  },
  
  // 打乱数组顺序
  shuffleArray: function(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },
  
  // 生成推荐问题
  generateSuggestedQuestions: function(article) {
    const suggestedQuestions = [
      `《${article.title}》的写作背景是什么？`,
      `${article.author}的生平有哪些特点？`,
      `《${article.title}》在${article.dynasty}文学史上的地位如何？`,
      `请分析《${article.title}》的艺术特色和思想内涵。`
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
    
    this.setData({
      currentTab: tab
    });
    
    // 根据选项卡加载相应内容
    this.loadTabContent(tab);
    
    // 保存学习记录
    this.saveLearningRecord();
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
  },
  
  // 加载翻译内容
  loadTranslation: function() {
    const article = this.data.article;
    
    // 如果已有翻译，直接显示
    if (article.translation) {
      return;
    }
    
    this.setData({ aiProcessing: true });
    
    // 调用OpenAI兼容API获取翻译
    articleAIService.getTranslation(article.full_content)
      .then(translation => {
        // 更新文章翻译
        this.setData({
          'article.translation': translation,
          aiProcessing: false
        });
        
        // 缓存翻译结果到本地
        this.cacheArticleData({
          translation: translation
        });
      })
      .catch(err => {
        console.error('获取翻译失败', err);
        wx.showToast({
          title: '获取翻译失败',
          icon: 'none'
        });
        this.setData({ aiProcessing: false });
      });
  },
  
  // 加载作者信息
  loadAuthorInfo: function() {
    const article = this.data.article;
    
    // 如果已有作者介绍，直接显示
    if (article.author_intro) {
      return;
    }
    
    this.setData({ aiProcessing: true });
    
    // 调用OpenAI兼容API获取作者信息
    articleAIService.getAuthorInfo(article.author, article.dynasty, article.title)
      .then(authorInfo => {
        console.log('获取作者信息成功', authorInfo);
        
        // 作者信息解析逻辑增强
        let authorIntro = '';
        
        try {
          // 尝试按照常见格式解析内容
          const sections = authorInfo.split(/(?:^|\n)(?:生平简介|文学成就|历史地位|创作背景)[：:]/i);
          
          if (sections.length >= 2) {
            // 合并所有有效内容
            let combinedContent = '';
            
            for (let i = 1; i < sections.length; i++) {
              let content = sections[i].trim();
              
              // 清理每个部分可能包含的下一个标题
              content = content.split(/\n(?:生平简介|文学成就|历史地位|创作背景)[：:]/i)[0].trim();
              
              if (content) {
                combinedContent += (combinedContent ? '\n\n' : '') + content;
              }
            }
            
            authorIntro = combinedContent;
          } else {
            // 如果没有找到明确的章节分隔，直接使用全部内容
            authorIntro = authorInfo;
          }
        } catch (e) {
          console.error('解析作者信息出错', e);
          // 出错时直接使用原始内容
          authorIntro = authorInfo;
        }
        
        // 确保作者介绍不为空
        if (!authorIntro) {
          authorIntro = authorInfo;
        }
        
        // 更新作者介绍
        this.setData({
          'article.author_intro': authorIntro,
          aiProcessing: false
        });
        
        // 缓存作者信息到本地
        this.cacheArticleData({
          author_intro: authorIntro
        });
      })
      .catch(err => {
        console.error('获取作者信息失败', err);
        wx.showToast({
          title: '获取作者信息失败',
          icon: 'none'
        });
        this.setData({ aiProcessing: false });
      });
  },
  
  // 加载逐句解析
  loadSentenceAnalysis: function() {
    const article = this.data.article;
    
    // 如果已有句子解析，直接显示
    if (this.data.sentences && this.data.sentences.length > 0) {
      return;
    }
    
    // 分割文章为句子
    const sentences = this.splitArticleIntoSentences(article.full_content);
    
    // 初始化句子数组
    const sentenceObjects = sentences.map(sentence => ({
      original_text: sentence,
      phonetic_notation: '',
      punctuated_text: '',
      translation: '',
      key_words_explanation: '',
      sentence_structure: '',
      rhetorical_analysis: ''
    }));
    
    this.setData({
      sentences: sentenceObjects,
      currentSentenceIndex: 0
    });
    
    // 加载第一句的详细解析
    this.loadSentenceDetail(0);
  },
  
  // 分割文章为句子
  splitArticleIntoSentences: function(content) {
    // 简单的按。！？；分割
    // 在实际应用中，可能需要更复杂的分割逻辑
    const sentences = content
      .replace(/([。！？；])/g, '$1|')
      .split('|')
      .filter(s => s.trim() !== '');
    
    return sentences;
  },
  
  // 加载句子详细解析
  loadSentenceDetail: function(index) {
    if (index < 0 || index >= this.data.sentences.length) return;
    
    const sentence = this.data.sentences[index];
    
    // 如果已有解析，直接返回
    if (sentence.phonetic_notation && sentence.translation) {
      return;
    }
    
    this.setData({ aiProcessing: true });
    
    // 获取上下文
    let context = '';
    if (index > 0) {
      context += this.data.sentences[index - 1].original_text + '。';
    }
    if (index < this.data.sentences.length - 1) {
      context += this.data.sentences[index + 1].original_text + '。';
    }
    
    // 调用OpenAI兼容API获取句子解析
    articleAIService.getSentenceAnalysis(sentence.original_text, context)
      .then(analysisResult => {
        console.log('获取句子解析成功', analysisResult);
        
        // 解析结果
        const lines = analysisResult.split('\n');
        let phonetic = '';
        let punctuated = '';
        let translation = '';
        let keywords = '';
        let structure = '';
        let rhetoric = '';
        
        // 更灵活的解析逻辑，支持多种格式
        let currentSection = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // 跳过空行和分隔符
          if (line === '' || line === '---') continue;
          
          // 检测段落标题
          if (line.includes('拼音标注') || line.match(/^拼音.*[:：]/)) {
            currentSection = 'phonetic';
            const content = line.replace(/拼音标注[:：]/, '').replace(/^拼音.*[:：]/, '').trim();
            if (content) phonetic = content;
            continue;
          } else if (line.includes('断句标注') || line.match(/^断句.*[:：]/)) {
            currentSection = 'punctuated';
            const content = line.replace(/断句标注[:：]/, '').replace(/^断句.*[:：]/, '').trim();
            if (content) punctuated = content;
            continue;
          } else if (line.includes('现代汉语翻译') || line.match(/^翻译.*[:：]/) || line.match(/^现代.*[:：]/)) {
            currentSection = 'translation';
            const content = line.replace(/现代汉语翻译[:：]/, '').replace(/^翻译.*[:：]/, '').replace(/^现代.*[:：]/, '').trim();
            if (content) translation = content;
            continue;
          } else if (line.includes('关键词解析') || line.match(/^关键.*[:：]/)) {
            currentSection = 'keywords';
            const content = line.replace(/关键词解析[:：]/, '').replace(/^关键.*[:：]/, '').trim();
            if (content) keywords = content;
            continue;
          } else if (line.includes('语法结构分析') || line.match(/^语法.*[:：]/) || line.match(/^结构.*[:：]/)) {
            currentSection = 'structure';
            const content = line.replace(/语法结构分析[:：]/, '').replace(/^语法.*[:：]/, '').replace(/^结构.*[:：]/, '').trim();
            if (content) structure = content;
            continue;
          } else if (line.includes('修辞手法分析') || line.match(/^修辞.*[:：]/)) {
            currentSection = 'rhetoric';
            const content = line.replace(/修辞手法分析[:：]/, '').replace(/^修辞.*[:：]/, '').trim();
            if (content) rhetoric = content;
            continue;
          }
          
          // 根据当前段落类型添加内容
          if (currentSection === 'phonetic') {
            phonetic += (phonetic ? '\n' : '') + line;
          } else if (currentSection === 'punctuated') {
            punctuated += (punctuated ? '\n' : '') + line;
          } else if (currentSection === 'translation') {
            translation += (translation ? '\n' : '') + line;
          } else if (currentSection === 'keywords') {
            keywords += (keywords ? '\n' : '') + line;
          } else if (currentSection === 'structure') {
            structure += (structure ? '\n' : '') + line;
          } else if (currentSection === 'rhetoric') {
            rhetoric += (rhetoric ? '\n' : '') + line;
          }
        }
        
        // 如果没有成功解析出结构化内容，则整体作为翻译
        if (!phonetic && !punctuated && !translation && !keywords && !structure && !rhetoric) {
          translation = analysisResult;
        }
        
        // 更新句子解析
        const sentences = this.data.sentences;
        sentences[index].phonetic_notation = phonetic;
        sentences[index].punctuated_text = punctuated;
        sentences[index].translation = translation;
        sentences[index].key_words_explanation = keywords;
        sentences[index].sentence_structure = structure;
        sentences[index].rhetorical_analysis = rhetoric;
        
        this.setData({
          sentences: sentences,
          aiProcessing: false
        });
        
        // 缓存句子解析到本地
        this.cacheSentenceAnalysis(index, sentences[index]);
      })
      .catch(err => {
        console.error('获取句子解析失败', err);
        wx.showToast({
          title: '获取句子解析失败',
          icon: 'none'
        });
        this.setData({ aiProcessing: false });
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
    
    // 如果已有背景知识，直接显示
    if (article.creation_background && article.historical_background && article.main_idea) {
      return;
    }
    
    this.setData({ aiProcessing: true });
    
    // 调用OpenAI兼容API获取背景知识
    articleAIService.getBackground(article.title, article.author, article.dynasty, article.full_content)
      .then(backgroundInfo => {
        console.log('获取背景知识成功', backgroundInfo);
        
        // 解析背景知识
        let creationBg = '';
        let historicalBg = '';
        let mainIdea = '';
        let literaryValue = '';
        
        try {
          // 尝试按照格式解析内容
          const sections = backgroundInfo.split(/(?:^|\n)(?:创作背景|历史背景|主旨思想|文学价值)[：:]/i);
          
          if (sections.length >= 2) {
            // 提取各部分内容
            creationBg = sections[1].trim();
            if (sections.length >= 3) historicalBg = sections[2].trim();
            if (sections.length >= 4) mainIdea = sections[3].trim();
            if (sections.length >= 5) literaryValue = sections[4].trim();
            
            // 清理每个部分可能包含的下一个标题
            creationBg = creationBg.split(/\n(?:历史背景|主旨思想|文学价值)[：:]/i)[0].trim();
            if (historicalBg) historicalBg = historicalBg.split(/\n(?:主旨思想|文学价值)[：:]/i)[0].trim();
            if (mainIdea) mainIdea = mainIdea.split(/\n(?:文学价值)[：:]/i)[0].trim();
          } else {
            // 如果不符合预期格式，尝试其他解析方法
            const lines = backgroundInfo.split('\n');
            let currentSection = '';
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              // 跳过空行和分隔符
              if (line === '' || line === '---') continue;
              
              // 检测段落标题
              if (line.match(/创作背景/i)) {
                currentSection = 'creation';
                continue;
              } else if (line.match(/历史背景/i)) {
                currentSection = 'history';
                continue;
              } else if (line.match(/主旨思想/i)) {
                currentSection = 'idea';
                continue;
              } else if (line.match(/文学价值/i)) {
                currentSection = 'value';
                continue;
              }
              
              // 根据当前段落类型添加内容
              if (currentSection === 'creation') {
                creationBg += (creationBg ? '\n' : '') + line;
              } else if (currentSection === 'history') {
                historicalBg += (historicalBg ? '\n' : '') + line;
              } else if (currentSection === 'idea') {
                mainIdea += (mainIdea ? '\n' : '') + line;
              } else if (currentSection === 'value') {
                literaryValue += (literaryValue ? '\n' : '') + line;
              }
            }
          }
        } catch (e) {
          console.error('解析背景知识出错', e);
        }
        
        // 如果没有成功解析出结构化内容，则整体作为创作背景
        if (!creationBg && !historicalBg && !mainIdea && !literaryValue) {
          creationBg = backgroundInfo;
        }
        
        // 更新背景知识
        this.setData({
          'article.creation_background': creationBg,
          'article.historical_background': historicalBg,
          'article.main_idea': mainIdea,
          'article.literary_value': literaryValue,
          aiProcessing: false
        });
        
        // 缓存背景知识到本地
        this.cacheArticleData({
          creation_background: creationBg,
          historical_background: historicalBg,
          main_idea: mainIdea,
          literary_value: literaryValue
        });
      })
      .catch(err => {
        console.error('获取背景知识失败', err);
        wx.showToast({
          title: '获取背景知识失败',
          icon: 'none'
        });
        this.setData({ aiProcessing: false });
      });
  },
  
  // 加载练习题
  loadExercises: function() {
    const article = this.data.article;
    
    // 如果已有练习题，直接显示
    if (this.data.exercises && this.data.exercises.length > 0) {
      return;
    }
    
    this.setData({ aiProcessing: true });
    
    // 确定适用年级
    let level = 'junior'; // 默认初中
    if (article.education_stage === 'primary') {
      level = 'primary';
    } else if (article.education_stage === 'senior') {
      level = 'senior';
    }
    
    // 调用OpenAI兼容API生成练习题
    articleAIService.generateExercises(article.full_content, level, 5)
      .then(exercisesResult => {
        // 解析练习题
        const exercises = this.parseExercises(exercisesResult);
        
        // 更新练习题
        this.setData({
          exercises: exercises,
          userAnswers: new Array(exercises.length).fill(''),
          showExerciseResult: false,
          exerciseScore: 0,
          aiProcessing: false
        });
        
        // 缓存练习题到本地
        this.cacheExercises(exercises);
      })
      .catch(err => {
        console.error('生成练习题失败', err);
        wx.showToast({
          title: '生成练习题失败',
          icon: 'none'
        });
        this.setData({ aiProcessing: false });
      });
  },
  
  // 解析练习题
  parseExercises: function(exercisesText) {
    const exercises = [];
    
    // 按题目分割
    const questionBlocks = exercisesText.split(/题目\d+：/).filter(block => block.trim() !== '');
    
    for (let i = 0; i < questionBlocks.length; i++) {
      const block = questionBlocks[i];
      const lines = block.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length < 6) continue; // 跳过格式不正确的题目
      
      const question = lines[0].trim();
      const options = [];
      let answer = '';
      let analysis = '';
      
      // 解析选项
      for (let j = 1; j <= 4; j++) {
        if (j < lines.length) {
          const optionLine = lines[j].trim();
          // 移除选项标记（如A. B. C. D.）
          const option = optionLine.replace(/^[A-D]\.\s*/, '').trim();
          options.push(option);
        }
      }
      
      // 解析答案和解析
      for (let j = 5; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.startsWith('正确答案：')) {
          answer = line.replace('正确答案：', '').trim();
          // 如果答案是选项字母，转换为选项内容
          if (['A', 'B', 'C', 'D'].includes(answer)) {
            const index = answer.charCodeAt(0) - 65; // A->0, B->1, C->2, D->3
            if (index >= 0 && index < options.length) {
              answer = options[index];
            }
          }
        } else if (line.startsWith('解析：')) {
          analysis = line.replace('解析：', '').trim();
          // 收集多行解析
          for (let k = j + 1; k < lines.length; k++) {
            analysis += '\n' + lines[k].trim();
          }
          break;
        }
      }
      
      exercises.push({
        exercise_id: `ex_${Date.now()}_${i}`,
        question: question,
        options: options,
        answer: answer,
        analysis: analysis
      });
    }
    
    return exercises;
  },
  
  // 选择答案
  selectAnswer: function(e) {
    const index = e.currentTarget.dataset.index;
    const option = e.currentTarget.dataset.option;
    
    // 更新用户答案
    const userAnswers = this.data.userAnswers;
    userAnswers[index] = option;
    
    this.setData({
      userAnswers: userAnswers
    });
  },
  
  // 提交答案
  submitExercise: function() {
    const exercises = this.data.exercises;
    const userAnswers = this.data.userAnswers;
    
    // 检查是否所有题目都已作答
    const unanswered = userAnswers.findIndex(answer => answer === '');
    if (unanswered !== -1) {
      wx.showToast({
        title: `第${unanswered + 1}题未作答`,
        icon: 'none'
      });
      return;
    }
    
    // 计算得分
    let correctCount = 0;
    for (let i = 0; i < exercises.length; i++) {
      if (userAnswers[i] === exercises[i].answer) {
        correctCount++;
      }
    }
    
    const score = Math.round((correctCount / exercises.length) * 100);
    
    // 显示结果
    this.setData({
      showExerciseResult: true,
      exerciseScore: score
    });
  },
  
  // 重置练习
  resetExercise: function() {
    this.setData({
      userAnswers: new Array(this.data.exercises.length).fill(''),
      showExerciseResult: false,
      exerciseScore: 0
    });
  },
  
  // 加载问答功能
  loadQA: function() {
    const article = this.data.article;
    
    // 如果已有推荐问题，直接显示
    if (this.data.suggestedQuestions && this.data.suggestedQuestions.length > 0) {
      return;
    }
    
    this.setData({ aiProcessing: true });
    
    // 调用OpenAI兼容API获取推荐问题
    articleAIService.getSuggestedQuestions(article.title, article.author, article.dynasty, article.full_content)
      .then(questions => {
        // 更新推荐问题
        this.setData({
          suggestedQuestions: questions,
          aiProcessing: false
        });
      })
      .catch(err => {
        console.error('获取推荐问题失败', err);
        wx.showToast({
          title: '获取推荐问题失败',
          icon: 'none'
        });
        this.setData({ aiProcessing: false });
      });
  },
  
  // 提问
  askQuestion: function(e) {
    // 获取问题内容（可能来自输入框或推荐问题）
    let question = '';
    
    if (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.question) {
      // 点击推荐问题
      question = e.currentTarget.dataset.question;
    } else {
      // 输入框提交
      question = this.data.userQuestion;
      if (!question || question.trim() === '') {
        wx.showToast({
          title: '请输入问题',
          icon: 'none'
        });
        return;
      }
    }
    
    const article = this.data.article;
    
    // 添加用户问题到消息列表
    const qaMessages = this.data.qaMessages.concat([{
      role: 'user',
      content: question,
      timestamp: Date.now()
    }]);
    
    this.setData({
      qaMessages: qaMessages,
      userQuestion: '',
      aiProcessing: true
    });
    
    // 调用OpenAI兼容API回答问题
    articleAIService.answerQuestion(
      question,
      article.title,
      article.author,
      article.dynasty,
      article.full_content
    )
      .then(answer => {
        // 添加助手回答到消息列表
        const newMessages = this.data.qaMessages.concat([{
          role: 'assistant',
          content: answer,
          timestamp: Date.now()
        }]);
        
        this.setData({
          qaMessages: newMessages,
          aiProcessing: false
        });
      })
      .catch(err => {
        console.error('回答问题失败', err);
        wx.showToast({
          title: '回答问题失败',
          icon: 'none'
        });
        this.setData({ aiProcessing: false });
      });
  },
  
  // 输入问题
  inputQuestion: function(e) {
    this.setData({
      userQuestion: e.detail.value
    });
  },
  
  // 点击推荐问题
  tapSuggestedQuestion: function(e) {
    const question = e.currentTarget.dataset.question;
    this.askQuestion({
      currentTarget: {
        dataset: {
          question: question
        }
      }
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
      // 加载文章缓存数据
      const cacheKey = `article_cache_${articleId}`;
      const cachedData = wx.getStorageSync(cacheKey);
      
      if (cachedData) {
        // 更新文章数据
        const article = this.data.article || {};
        this.setData({
          article: { ...article, ...cachedData }
        });
      }
      
      // 加载句子解析缓存
      const sentencesCacheKey = `article_sentences_${articleId}`;
      const cachedSentences = wx.getStorageSync(sentencesCacheKey);
      
      if (cachedSentences && cachedSentences.length > 0) {
        this.setData({
          sentences: cachedSentences,
          currentSentenceIndex: 0
        });
      }
      
      // 加载练习题缓存
      const exercisesCacheKey = `article_exercises_${articleId}`;
      const cachedExercises = wx.getStorageSync(exercisesCacheKey);
      
      if (cachedExercises && cachedExercises.length > 0) {
        this.setData({
          exercises: cachedExercises,
          userAnswers: new Array(cachedExercises.length).fill(''),
          showExerciseResult: false
        });
      }
      
      return true;
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
});
