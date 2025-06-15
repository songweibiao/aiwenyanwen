const db = wx.cloud.database();

Page({
  data: {
    loading: true,
    wordItems: [],
    error: null,
    debugInfo: '' // 添加调试信息字段
  },

  onLoad: function() {
    // 检查云环境是否正确初始化
    if (!wx.cloud) {
      this.setData({
        error: '云开发未初始化，请检查基础库版本',
        loading: false,
        debugInfo: '云开发未初始化'
      });
      return;
    }
    
    // 记录当前云环境
    const currentEnv = wx.cloud.DYNAMIC_CURRENT_ENV || '未获取到环境ID';
    console.log('当前云环境:', currentEnv);
    
    this.setData({
      debugInfo: `当前云环境: ${currentEnv}`
    });
    
    this.loadWordData();
  },

  loadWordData: function() {
    this.setData({ 
      loading: true, 
      error: null,
      debugInfo: this.data.debugInfo + '\n开始加载数据，调用云函数getXushiciData...'
    });

    // 调用云函数获取数据
    wx.cloud.callFunction({
      name: 'getXushiciData',
      data: {
        type: 'test'
      }
    })
    .then(res => {
      console.log('云函数调用成功:', res);
      
      this.setData({
        debugInfo: this.data.debugInfo + `\n云函数调用成功，返回: ${JSON.stringify(res.result)}`
      });
      
      if (res.result && res.result.success) {
        const data = res.result.data || [];
        
        this.setData({
          debugInfo: this.data.debugInfo + `\n获取到 ${data.length} 条数据`
        });
        
        if (data.length > 0) {
          // 记录第一条数据的字段名，用于调试
          const firstItem = data[0];
          const fields = Object.keys(firstItem).join(', ');
          
          this.setData({
            debugInfo: this.data.debugInfo + `\n第一条数据字段: ${fields}`
          });
          
          // 将中文字段名转换为英文字段名
          const processedData = data.map(item => {
            return {
              id: item._id,
              word: item.例词 || '',
              wordId: item.例词id || '',
              pinyin: item.读音 || '',
              usage: item.用法id || '',
              wordType: item.词性 || '',
              meaning: item.词义 || '',
              example: item.例句 || '',
              source: item.出处 || '',
              translation: item.释义 || '',
              collection: item.合集 || ''
            };
          });
          
          this.setData({
            wordItems: processedData,
            loading: false
          });
        } else {
          this.setData({
            error: '未获取到数据',
            loading: false,
            debugInfo: this.data.debugInfo + '\n查询成功但未获取到数据'
          });
        }
      } else {
        this.setData({
          error: res.result.error || '查询失败',
          loading: false,
          debugInfo: this.data.debugInfo + `\n查询失败: ${res.result.error || '未知错误'}`
        });
      }
    })
    .catch(err => {
      console.error('云函数调用失败:', err);
      this.setData({
        error: err.message || '获取数据失败',
        loading: false,
        debugInfo: this.data.debugInfo + `\n云函数调用失败: ${JSON.stringify(err)}`
      });
    });
  },

  refresh: function() {
    this.loadWordData();
  }
}); 