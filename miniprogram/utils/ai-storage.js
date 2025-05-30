/**
 * AI内容存储和获取工具函数
 * 将同一篇文章的AI内容合并为一条记录
 */

const db = wx.cloud.database()

/**
 * 获取AI内容
 * @param {String} articleId 文章ID
 * @param {String} type 内容类型: translate, sentence_analysis, author_info, background, exercise, suggested_questions, qa
 * @param {Object} extra 额外参数，如句子内容、句子索引等
 * @returns {Promise} 返回查询结果Promise
 */
function getAIContent(articleId, type, extra = null) {
  return new Promise((resolve, reject) => {
    console.log(`查询AI内容: articleId=${articleId}, type=${type}`);
    
    // 确保articleId是字符串类型
    const articleIdStr = String(articleId);
    
    // 使用云函数查询，避免权限问题
    wx.cloud.callFunction({
      name: 'getAIContent',
      data: {
        articleId: articleIdStr,
        type: type,
        extra: extra
      }
    }).then(res => {
      console.log(`云函数查询结果:`, res.result);
      
      // 检查云函数返回结果
      if (res.result && res.result.success && res.result.data && res.result.data.length > 0) {
        const record = res.result.data[0];
        
        // 如果是句子解析，需要匹配具体的句子
        if (type === 'sentence_analysis' && extra && extra.sentence) {
          // 检查是否有该句子的解析
          if (record[type] && record[type].sentences && 
              Array.isArray(record[type].sentences)) {
            const sentenceAnalysis = record[type].sentences.find(
              item => item.original_text === extra.sentence
            );
            
            if (sentenceAnalysis) {
              console.log(`找到句子解析: ${extra.sentence.substring(0, 10)}...`);
              return resolve({ data: [{ content: sentenceAnalysis }] });
            }
          }
          // 没有找到该句子的解析，返回空结果
          console.log(`未找到句子解析: ${extra.sentence.substring(0, 10)}...`);
          return resolve({ data: [] });
        }
        
        // 其他类型内容，直接检查是否存在
        if (record[type]) {
          console.log(`找到${type}类型内容`);
          return resolve({ data: [{ content: record[type] }] });
        }
        
        // 该类型内容不存在
        console.log(`未找到${type}类型内容`);
        resolve({ data: [] });
      } else {
        // 文章记录不存在
        console.log(`未找到文章记录: articleId=${articleIdStr}`);
        resolve({ data: [] });
      }
    }).catch(err => {
      console.error('获取AI内容失败', err);
      reject(err);
    });
  });
}

/**
 * 保存AI内容
 * @param {String} articleId 文章ID
 * @param {String} type 内容类型
 * @param {Object|String|Array} content 内容
 * @param {Object} extra 额外参数
 * @returns {Promise} 返回保存结果Promise
 */
function saveAIContent(articleId, type, content, extra = null) {
  return new Promise((resolve, reject) => {
    const now = new Date();
    
    // 确保articleId是字符串类型
    const articleIdStr = String(articleId);
    
    console.log(`保存AI内容: articleId=${articleIdStr}, type=${type}`);
    
    // 使用云函数保存，避免权限问题
    wx.cloud.callFunction({
      name: 'saveAIContent',
      data: {
        articleId: articleIdStr,
        type: type,
        content: content,
        extra: extra,
        timestamp: now.getTime() // 传递时间戳而不是Date对象
      }
    }).then(result => {
      console.log('保存AI内容成功:', result);
      resolve(result);
    }).catch(err => {
      console.error('保存AI内容失败', err);
      reject(err);
    });
  });
}

module.exports = {
  getAIContent,
  saveAIContent
}; 