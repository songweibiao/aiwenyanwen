const OPENAI_CONFIG = require('../../../utils/openai').OPENAI_CONFIG;

Page({
  data: {
    messages: [
      {
        id: 1,
        role: 'assistant',
        content: '你好！我是李白，有什么文言文、古诗、文学相关问题，尽管问我吧~'
      }
    ],
    inputValue: '',
    loading: false,
    toView: '',  // 初始不设置toView，让滚动视图显示从顶部开始
    showBackButton: false, // 是否显示返回按钮
    articleId: null, // 来源文章ID
    isLoggedIn: false, // 用户是否已登录
    loginModalShown: false, // 是否已弹出登录提示
    userInfo: null
  },

  onLoad(options) {
    console.log('AI助手页面加载，参数:', options);
    
    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = !!userInfo;
    
    // 设置初始状态
    this.setData({
      isLoggedIn: isLoggedIn,
      messages: [
        {
          id: 1,
          role: 'assistant',
          content: '你好！我是李白，有什么文言文、古诗、文学相关问题，尽管问我吧~'
        }
      ]
    });
    
    // 延迟滚动到初始消息
    setTimeout(() => {
      this.scrollToBottom();
    }, 300);
  },

  onShow() {
    if (typeof this.getTabBar === 'function' &&
      this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
    console.log('AI助手页面显示');
    this.checkLoginStatus();
    const app = getApp();
    const isFromArticle = app.globalData && app.globalData.fromArticleDetail;
    const isLoggedIn = this.data.isLoggedIn;
    
    // 只根据上下文和登录状态判断按钮显示，不主动清理上下文
    if (isFromArticle && isLoggedIn) {
      this.setData({
        showBackButton: true,
        articleId: app.globalData.articleId
      });
    } else {
      this.setData({
        showBackButton: false,
        articleId: null
      });
    }
    
    // 如果未登录，不执行后续操作
    if (!this.data.isLoggedIn) {
      this.setData({
        messages: [
          {
            id: 1,
            role: 'assistant',
            content: '你好！我是李白，有什么文言文、古诗、文学相关问题，尽管问我吧~'
          }
        ],
        inputValue: ''
      });
      return;
    }
    // 检查全局数据中是否有待处理的问题
    if (app.globalData && app.globalData.pendingQuestion) {
      const contextQuestion = app.globalData.pendingQuestion;
      console.log('发现待处理问题:', contextQuestion);
      app.globalData.pendingQuestion = null;
      if (this.data.isLoggedIn) {
      this.setData({
        inputValue: contextQuestion
      }, () => {
        setTimeout(() => {
          console.log('自动发送带上下文的问题:', this.data.inputValue);
          this.onSend();
        }, 500);
      });
      } else {
        this.setData({
          inputValue: ''
        });
      }
    } else {
      this.loadChatHistory();
    }
  },

  // 检查登录状态（只设置状态，不弹窗）
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = !!userInfo;
    this.setData({
      isLoggedIn: isLoggedIn,
      userInfo: userInfo
    });
  },
  
  // 加载聊天历史
  loadChatHistory() {
    wx.showLoading({
      title: '加载中...',
    });
    
    wx.cloud.callFunction({
      name: 'userAIChat',
      data: {
        action: 'get'
      },
      success: (res) => {
        console.log('获取聊天历史结果:', res.result);
        
        if (res.result.success && res.result.messages && res.result.messages.length > 0) {
          this.setData({
            messages: res.result.messages
          }, () => {
            // 滚动到底部
            this.scrollToBottom();
          });
        }
      },
      fail: (err) => {
        console.error('获取聊天历史失败:', err);
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },
  
  // 保存聊天记录
  saveChatHistory(messages) {
    // 如果未登录，不保存聊天记录
    if (!this.data.isLoggedIn) return;
    
    wx.cloud.callFunction({
      name: 'userAIChat',
      data: {
        action: 'save',
        messages: messages
      },
      success: (res) => {
        console.log('保存聊天记录结果:', res.result);
      },
      fail: (err) => {
        console.error('保存聊天记录失败:', err);
      }
    });
  },

  // 检查登录状态并在未登录时提示
  checkLoginBeforeInput(e) {
    if (this.data.isLoggedIn) return;
    if (this.data.loginModalShown) return;
    this.setData({ loginModalShown: true });
    wx.showModal({
      title: '提示',
      content: '请先登录后再使用AI助手功能',
      showCancel: false,
      success: (res) => {
        this.setData({ loginModalShown: false });
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/my/index/index'
          });
        }
      }
    });
    // 失去焦点，防止页面切回来又自动聚焦
    wx.hideKeyboard();
  },

  // 检查登录状态并在登录后发送消息
  checkLoginAndSend(e) {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再使用AI助手功能',
        showCancel: false,
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/my/index/index'
            });
          }
        }
      });
      return;
    }
    this.onSend();
    // 用户主动提问，清理课文上下文和隐藏返回按钮
    const app = getApp();
    if (app.globalData) {
      app.globalData.fromArticleDetail = false;
      app.globalData.articleId = null;
    }
    this.setData({ showBackButton: false });
  },

  onInput(e) {
    // 由于input已经设置了disabled，理论上未登录状态不会触发此函数
    // 但为了安全起见，仍然进行检查
    if (!this.data.isLoggedIn) {
      return;
    }
    
    this.setData({ inputValue: e.detail.value });
  },

  onSend() {
    const question = this.data.inputValue.trim();
    if (!question || this.data.loading) return;
    
    // 发送消息时收起键盘
    wx.hideKeyboard();
    
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: question
    };
    // 先插入用户消息和"思考中..."消息
    const thinkingId = Date.now() + 1;
    const thinkingMsg = {
      id: thinkingId,
      role: 'assistant',
      content: '李白思考中...'
    };
    const messages = this.data.messages.concat(userMsg, thinkingMsg);
    this.setData({ 
      messages, 
      inputValue: '', 
      loading: true, 
      toView: 'msg' + thinkingId 
    });

    // 延迟滚动确保新消息可见
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);

    // 构造OpenAI API请求
    const apiMessages = [
      {
        role: 'system',
        content: '你是一个拟人化的AI助手，名叫"李白"，风格文雅但通俗，知识范围包括文言文、古代文化、写作技巧、古诗创作、文学典故讲解、文言文翻译、学习方法指导等。请使用纯文本回复，不要使用Markdown格式。换行请直接使用换行符，不要使用Markdown语法。'
      },
      ...messages.filter(m => m.content !== '李白思考中...').map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
    ];

    wx.request({
      url: OPENAI_CONFIG.API_URL,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENAI_CONFIG.API_KEY
      },
      data: {
        model: OPENAI_CONFIG.MODEL,
        messages: apiMessages
      },
      success: (res) => {
        let reply = '';
        try {
          reply = res.data.choices[0].message.content.trim();
        } catch (e) {
          reply = '李白一时语塞，请稍后再试~';
        }
        // 替换"思考中..."为正式回复
        const newMessages = this.data.messages.map(m => {
          if (m.id === thinkingId) {
            return Object.assign({}, m, { content: reply });
          }
          return m;
        });
        this.setData({
          messages: newMessages,
          loading: false,
          toView: 'msg' + thinkingId
        }, () => {
          // 保存聊天记录
          this.saveChatHistory(newMessages);
          // 滚动到底部
          this.scrollToBottom();
        });
      },
      fail: () => {
        const newMessages = this.data.messages.map(m => {
          if (m.id === thinkingId) {
            return Object.assign({}, m, { content: '网络异常，李白暂时无法作答，请稍后再试~' });
          }
          return m;
        });
        this.setData({
          messages: newMessages,
          loading: false,
          toView: 'msg' + thinkingId
        }, () => {
          // 保存聊天记录
          this.saveChatHistory(newMessages);
          // 滚动到底部
          this.scrollToBottom();
        });
      }
    });
  },

  scrollToBottom() {
    // 使用简单的方式设置滚动位置
    if (this.data.messages && this.data.messages.length > 0) {
      const lastMessageId = this.data.messages[this.data.messages.length - 1].id;
      this.setData({
        toView: 'msg' + lastMessageId
      });
    }
  },

  // 返回文章详情页
  goBackToArticle() {
    if (this.data.articleId) {
      wx.reLaunch({
        url: `/pages/article/detail/detail?id=${this.data.articleId}&tab=qa`,
        fail: (err) => {
          console.error('返回文章详情页失败:', err);
          wx.showToast({
            title: '返回失败，请重试',
            icon: 'none'
          });
        }
      });
      // 清除来源标记
      const app = getApp();
      if (app.globalData) {
        app.globalData.fromArticleDetail = false;
        app.globalData.articleId = null;
      }
    }
  }
});
