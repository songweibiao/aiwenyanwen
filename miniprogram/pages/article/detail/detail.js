// 课文详情页面 - 中国传统风格优化版
const app = getApp();

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
      loading: false
    });
    
    // 设置导航栏标题
    if (articleData.title) {
      wx.setNavigationBarTitle({
        title: articleData.title
      });
    }
    
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
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    
    // 创建切换动画
    const animation = wx.createAnimation({
      duration: 400,
      timingFunction: 'ease',
    });
    
    animation.opacity(0).step();
    
    this.setData({
      animationData: animation.export()
    });
    
    // 延迟切换内容，实现过渡效果
    setTimeout(() => {
      this.setData({
        currentTab: tab
      });
      
      // 记录学习进度
      this.updateLearningProgress(tab);
      
      // 恢复透明度
      animation.opacity(1).step();
      this.setData({
        animationData: animation.export()
      });
    }, 200);
  },
  
  // 更新学习进度
  updateLearningProgress: function (tab) {
    // 如果之前是"未开始"状态，切换为"学习中"状态
    if (this.data.learnStatus === '未开始') {
      this.setData({
        learnStatus: '学习中'
      });
    }
    
    // 如果是练习巩固页面，并且之前做过练习且成绩为100分，更新为"已完成"
    if (tab === 'exercise' && this.data.showExerciseResult && this.data.exerciseScore === 100) {
      this.setData({
        learnStatus: '已完成'
      });
    }
    
    // 保存学习记录到本地
    this.saveLearningRecord();
    
    // 在实际应用中，这里应该向服务器发送请求，更新学习进度
    // 在MVP版本中，我们仅更新本地状态
  },
  
  // 处理收藏/取消收藏
  toggleCollect: function () {
    const newState = !this.data.isCollected;
    
    this.setData({
      isCollected: newState
    });
    
    // 保存收藏状态
    this.saveLearningRecord();
    
    // 在实际应用中，这里应该向服务器发送请求，更新收藏状态
    wx.showToast({
      title: newState ? '已收藏' : '已取消收藏',
      icon: 'success',
      duration: 1500
    });
  },
  
  // 逐句解析 - 上一句
  prevSentence: function () {
    if (this.data.currentSentenceIndex > 0) {
      // 创建切换动画
      const animation = wx.createAnimation({
        duration: 300,
        timingFunction: 'ease',
      });
      
      animation.opacity(0).translateX(50).step();
      
      this.setData({
        animationData: animation.export()
      });
      
      // 延迟切换内容，实现过渡效果
      setTimeout(() => {
        this.setData({
          currentSentenceIndex: this.data.currentSentenceIndex - 1
        });
        
        // 恢复位置和透明度
        animation.opacity(1).translateX(0).step();
        this.setData({
          animationData: animation.export()
        });
      }, 150);
    }
  },
  
  // 逐句解析 - 下一句
  nextSentence: function () {
    if (this.data.currentSentenceIndex < this.data.sentences.length - 1) {
      // 创建切换动画
      const animation = wx.createAnimation({
        duration: 300,
        timingFunction: 'ease',
      });
      
      animation.opacity(0).translateX(-50).step();
      
      this.setData({
        animationData: animation.export()
      });
      
      // 延迟切换内容，实现过渡效果
      setTimeout(() => {
        this.setData({
          currentSentenceIndex: this.data.currentSentenceIndex + 1
        });
        
        // 恢复位置和透明度
        animation.opacity(1).translateX(0).step();
        this.setData({
          animationData: animation.export()
        });
      }, 150);
    }
  },
  
  // 练习巩固 - 选择答案
  selectAnswer: function (e) {
    const { index, option } = e.currentTarget.dataset;
    const userAnswers = this.data.userAnswers;
    userAnswers[index] = option;
    
    this.setData({
      userAnswers: userAnswers
    });
    
    // 播放选择音效
    this.playSelectionSound();
  },
  
  // 播放选择音效
  playSelectionSound: function() {
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = 'https://example.com/selection_sound.mp3'; // 选择音效文件
    innerAudioContext.play();
  },
  
  // 练习巩固 - 提交答案
  submitExercise: function () {
    // 检查是否所有题目都已作答
    if (this.data.userAnswers.some(answer => !answer)) {
      wx.showToast({
        title: '请完成所有题目',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    // 计算得分
    let score = 0;
    this.data.exercises.forEach((exercise, index) => {
      if (exercise.answer === this.data.userAnswers[index]) {
        score++;
      }
    });
    
    const totalScore = Math.round((score / this.data.exercises.length) * 100);
    
    // 创建结果展示动画
    const animation = wx.createAnimation({
      duration: 600,
      timingFunction: 'ease',
    });
    
    animation.opacity(0).scale(0.8).step();
    
    this.setData({
      animationData: animation.export()
    });
    
    // 延迟显示结果，实现过渡效果
    setTimeout(() => {
      this.setData({
        showExerciseResult: true,
        exerciseScore: totalScore
      });
      
      // 如果得分100分，更新学习状态为"已完成"
      if (totalScore === 100) {
        this.setData({
          learnStatus: '已完成'
        });
        // 保存学习记录
        this.saveLearningRecord();
      }
      
      // 恢复动画
      animation.opacity(1).scale(1).step();
      this.setData({
        animationData: animation.export()
      });
    }, 300);
  },
  
  // 练习巩固 - 重新练习
  resetExercise: function () {
    this.setData({
      userAnswers: new Array(this.data.exercises.length).fill(''),
      showExerciseResult: false
    });
  },
  
  // 提问拓展 - 输入问题
  inputQuestion: function (e) {
    this.setData({
      userQuestion: e.detail.value
    });
  },
  
  // 提问拓展 - 选择推荐问题
  selectSuggestedQuestion: function (e) {
    const question = e.currentTarget.dataset.question;
    this.setData({
      userQuestion: question
    });
    this.askQuestion();
  },
  
  // 提问拓展 - 提交问题
  askQuestion: function () {
    if (!this.data.userQuestion.trim()) {
      wx.showToast({
        title: '请输入问题',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    // 将用户问题添加到消息列表
    const qaMessages = this.data.qaMessages;
    qaMessages.push({
      role: 'user',
      content: this.data.userQuestion,
      timestamp: new Date().getTime()
    });
    
    this.setData({
      qaMessages: qaMessages,
      userQuestion: ''
    });
    
    // 显示AI正在输入的提示
    wx.showLoading({
      title: '正在思考...',
      mask: true
    });
    
    // 模拟AI回答
    setTimeout(() => {
      wx.hideLoading();
      
      let response = '';
      if (qaMessages[qaMessages.length - 1].content.includes('背景')) {
        response = `《${this.data.article.title}》的写作背景与${this.data.article.author}所处的${this.data.article.dynasty}时期的社会背景和个人经历密切相关。这篇作品反映了当时的文化思潮和作者的思想情感。`;
      } else if (qaMessages[qaMessages.length - 1].content.includes('生平')) {
        response = `${this.data.article.author}是${this.data.article.dynasty}时期的著名文学家，其一生经历了丰富的政治和文学活动，作品风格鲜明，思想深刻，对中国文学产生了深远的影响。`;
      } else if (qaMessages[qaMessages.length - 1].content.includes('地位')) {
        response = `《${this.data.article.title}》在${this.data.article.dynasty}文学史上具有重要地位，它代表了当时文学的一种典型风格，展现了作者独特的艺术才华和思想境界，对后世产生了深远影响。`;
      } else if (qaMessages[qaMessages.length - 1].content.includes('特色') || qaMessages[qaMessages.length - 1].content.includes('内涵')) {
        response = `《${this.data.article.title}》在艺术表现上善用修辞手法，语言精炼生动；在思想内涵上体现了作者对人生、社会的深刻思考，表达了追求理想、热爱生活的情感。`;
      } else {
        response = `这是一个很好的问题。《${this.data.article.title}》作为${this.data.article.dynasty}时期${this.data.article.author}的代表作，不仅文词优美，而且思想内容丰富。通过深入分析可以发现作者独特的艺术风格和思想观念，体现了那个时代的文化特征。`;
      }
      
      qaMessages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().getTime()
      });
      
      this.setData({
        qaMessages: qaMessages
      });
      
      // 滚动到最新消息
      this.scrollToBottom();
    }, 1500);
  },
  
  // 滚动到对话底部
  scrollToBottom: function() {
    setTimeout(() => {
      wx.createSelectorQuery()
        .select('.messages-container')
        .node()
        .exec((res) => {
          if (res[0] && res[0].node) {
            res[0].node.scrollTop = res[0].node.scrollHeight;
          }
        });
    }, 100);
  },
  
  // 返回上一页
  goBack: function () {
    // 保存学习记录
    this.saveLearningRecord();
    
    wx.navigateBack();
  },
  
  // 分享按钮点击处理
  onShareTap: function() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },
  
  // 用户点击右上角分享或使用分享按钮
  onShareAppMessage: function () {
    const article = this.data.article || {};
    return {
      title: article.title || '文言文学习',
      path: `/pages/article/detail/detail?id=${this.data.articleId}`,
      imageUrl: 'https://example.com/share_cover.png' // 分享封面图
    };
  },
  
  // 页面卸载时触发
  onUnload: function() {
    // 保存学习记录
    this.saveLearningRecord();
  }
});
