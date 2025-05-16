/**
 * AI功能相关工具函数
 */

const request = require('./request')

/**
 * AI服务类型
 */
const AI_SERVICE_TYPES = {
  TRANSLATE: 'translate', // 全文翻译
  SENTENCE_ANALYSIS: 'sentence_analysis', // 逐句解析
  BACKGROUND: 'background', // 背景知识
  EXERCISE: 'exercise', // 练习题生成
  CHAT: 'chat', // 聊天对话
}

/**
 * AI服务
 */
const aiService = {
  /**
   * 获取全文翻译
   * @param {String} content 文言文原文内容
   * @returns {Promise} 翻译结果
   */
  getTranslation: (content) => {
    return request.cloud('aiService', {
      type: AI_SERVICE_TYPES.TRANSLATE,
      content
    })
  },
  
  /**
   * 获取句子解析
   * @param {String} sentence 原句
   * @param {String} context 上下文（可选）
   * @returns {Promise} 解析结果
   */
  getSentenceAnalysis: (sentence, context = '') => {
    return request.cloud('aiService', {
      type: AI_SERVICE_TYPES.SENTENCE_ANALYSIS,
      content: sentence,
      context
    })
  },
  
  /**
   * 获取背景知识
   * @param {String} author 作者
   * @param {String} title 标题
   * @param {String} dynasty 朝代
   * @param {String} content 原文
   * @returns {Promise} 背景知识
   */
  getBackground: (author, title, dynasty, content) => {
    return request.cloud('aiService', {
      type: AI_SERVICE_TYPES.BACKGROUND,
      author,
      title,
      dynasty,
      content
    })
  },
  
  /**
   * 生成练习题
   * @param {String} content 文言文内容
   * @param {String} level 适用年级 primary/junior/senior
   * @param {Number} count 题目数量
   * @returns {Promise} 练习题列表
   */
  generateExercises: (content, level, count = 5) => {
    return request.cloud('aiService', {
      type: AI_SERVICE_TYPES.EXERCISE,
      content,
      level,
      count
    })
  },
  
  /**
   * 聊天对话
   * @param {Array} messages 消息历史
   * @param {String} content 当前提问内容
   * @returns {Promise} 回复内容
   */
  chat: (messages, content) => {
    return request.cloud('aiService', {
      type: AI_SERVICE_TYPES.CHAT,
      messages,
      content
    })
  }
}

module.exports = {
  AI_SERVICE_TYPES,
  aiService
} 