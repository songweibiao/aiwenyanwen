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
    toView: ''  // 初始不设置toView，让滚动视图显示从顶部开始
  },

  onLoad() {
    // 延迟滚动到初始消息
    setTimeout(() => {
      this.scrollToBottom();
    }, 300);
  },

  onInput(e) {
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
          // 简单的滚动方式
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
          // 简单的滚动方式
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
  }
});
