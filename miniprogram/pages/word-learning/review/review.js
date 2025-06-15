const app = getApp();

Page({
  data: {
    examType: '',          // 考试类型
    currentWord: null,     // 当前词条
    wordList: [],          // 词条列表
    currentIndex: 0,       // 当前词条索引
    totalWords: 0,         // 总词条数
    loading: true,         // 加载状态
    userInfo: null,        // 用户信息
    showAnswer: false,     // 是否显示答案
    rememberedCount: 0,    // 已记住的词数
    forgotCount: 0,        // 未记住的词数
    masteryRate: 0,        // 掌握率
    progressPercent: '0%', // 进度百分比
    isComplete: false      // 是否完成所有复习
  },

  onLoad: function (options) {
    if (options.examType) {
      this.setData({
        examType: options.examType
      });
      
      // 设置导航栏标题
      wx.setNavigationBarTitle({
        title: options.examType === '中考实词合集' ? '中考虚实词复习' : '高考虚实词复习'
      });
      
      // 获取用户信息
      if (app.globalData.userInfo) {
        this.setData({
          userInfo: app.globalData.userInfo
        });
        // 加载复习词条数据
        this.loadReviewWords(options.wordId);
      } else {
        app.userInfoReadyCallback = res => {
          this.setData({
            userInfo: res.userInfo
          });
          // 加载复习词条数据
          this.loadReviewWords(options.wordId);
        };
      }
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载复习词条数据
  loadReviewWords: function (wordId) {
    this.setData({ loading: true });
    
    // 调用云函数获取需要复习的词条
    wx.cloud.callFunction({
      name: 'getWordReviewList',
      data: {
        examType: this.data.examType,
        wordId: wordId || ''
      },
      success: res => {
        if (res.result && res.result.success) {
          const wordList = res.result.data || [];
          
          if (wordList.length === 0) {
            wx.showToast({
              title: '暂无需要复习的词条',
              icon: 'none'
            });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
            return;
          }
          
          let currentIndex = 0;
          
          // 如果指定了词条ID，则定位到该词条
          if (wordId && wordList.length > 0) {
            const index = wordList.findIndex(word => word.wordId === wordId);
            if (index !== -1) {
              currentIndex = index;
            }
          }
          
          this.setData({
            wordList,
            totalWords: wordList.length,
            currentIndex,
            currentWord: wordList[currentIndex] || null,
            showAnswer: false,
            progressPercent: this.calculateProgressPercent(currentIndex, wordList.length)
          });
          
          // 更新学习记录
          if (this.data.currentWord) {
            this.updateReviewRecord();
          }
        } else {
          wx.showToast({
            title: '获取复习词条失败',
            icon: 'none'
          });
        }
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  // 计算进度百分比
  calculateProgressPercent: function(currentIndex, totalWords) {
    if (totalWords === 0) return '0%';
    const percent = Math.floor((currentIndex + 1) / totalWords * 100);
    return percent + '%';
  },

  // 计算掌握率
  calculateMasteryRate: function() {
    const { rememberedCount, totalWords } = this.data;
    if (totalWords === 0) return 0;
    const rate = Math.floor(rememberedCount / totalWords * 100);
    return rate;
  },

  // 更新复习记录
  updateReviewRecord: function () {
    if (!this.data.currentWord) return;
    
    wx.cloud.callFunction({
      name: 'updateWordStudyRecord',
      data: {
        wordId: this.data.currentWord.wordId,
        word: this.data.currentWord.word,
        examType: this.data.examType,
        isReview: true
      }
    });
  },

  // 显示答案
  toggleAnswer: function () {
    this.setData({
      showAnswer: !this.data.showAnswer
    });
  },

  // 下一个词条
  nextWord: function () {
    if (this.data.currentIndex < this.data.wordList.length - 1) {
      const nextIndex = this.data.currentIndex + 1;
      this.setData({
        currentIndex: nextIndex,
        currentWord: this.data.wordList[nextIndex],
        showAnswer: false,
        progressPercent: this.calculateProgressPercent(nextIndex, this.data.totalWords)
      });
      // 更新复习记录
      this.updateReviewRecord();
    } else {
      wx.showToast({
        title: '已经是最后一个词条',
        icon: 'none'
      });
    }
  },

  // 标记为已记住
  markAsRemembered: function () {
    if (!this.data.currentWord) return;
    
    // 更新已记住的词数
    const rememberedCount = this.data.rememberedCount + 1;
    this.setData({ rememberedCount });
    
    // 检查是否已完成所有词的复习
    if (this.data.currentIndex === this.data.wordList.length - 1) {
      this.completeReview();
      return;
    }
    
    // 进入下一个词
    this.nextWord();
    
    wx.cloud.callFunction({
      name: 'updateWordMasteryStatus',
      data: {
        wordId: this.data.currentWord.wordId,
        isMastered: true,
        needReview: false
      }
    });
  },

  // 标记为未记住
  markAsForgot: function () {
    if (!this.data.currentWord) return;
    
    // 更新未记住的词数
    const forgotCount = this.data.forgotCount + 1;
    this.setData({ forgotCount });
    
    // 检查是否已完成所有词的复习
    if (this.data.currentIndex === this.data.wordList.length - 1) {
      this.completeReview();
      return;
    }
    
    // 进入下一个词
    this.nextWord();
    
    wx.cloud.callFunction({
      name: 'updateWordMasteryStatus',
      data: {
        wordId: this.data.currentWord.wordId,
        isMastered: false,
        needReview: true
      }
    });
  },

  // 完成复习
  completeReview: function() {
    const masteryRate = this.calculateMasteryRate();
    this.setData({
      isComplete: true,
      masteryRate
    });
  },

  // 返回首页
  navigateToIndex: function() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 重新开始复习
  restartReview: function() {
    this.setData({
      currentIndex: 0,
      rememberedCount: 0,
      forgotCount: 0,
      masteryRate: 0,
      isComplete: false,
      showAnswer: false,
      progressPercent: this.calculateProgressPercent(0, this.data.totalWords),
      currentWord: this.data.wordList[0] || null
    });
  }
});
