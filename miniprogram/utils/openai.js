/**
 * OpenAI兼容API调用工具函数
 */

const request = require('./request')

/**
 * OpenAI兼容API配置
 */
const OPENAI_CONFIG = {
  API_URL: 'https://zeaezsezfddc.ap-southeast-1.clawcloudrun.com/v1/chat/completions',
  API_KEY: 'sk-wiibil',
  MODEL: 'gemini-2.5-flash-preview-05-20',
}

/**
 * 调用OpenAI兼容的聊天接口（通过云函数中转）
 * @param {Array} messages 消息列表，格式为[{role: 'system|user|assistant', content: '内容'}]
 * @param {Object} options 可选参数
 * @returns {Promise} 返回AI响应结果
 */
function chatCompletion(messages, options = {}) {
  return new Promise((resolve, reject) => {
    // 通过云函数中转调用API
    request.cloud('aiService', {
      type: 'direct_chat',
      messages: messages,
      model: OPENAI_CONFIG.MODEL,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 2000,
      top_p: options.top_p || 1,
      frequency_penalty: options.frequency_penalty || 0,
      presence_penalty: options.presence_penalty || 0
    })
      .then(res => {
        if (res.success && res.content) {
          resolve(res.content)
        } else {
          console.error('API调用失败', res)
          reject(new Error(res.error || 'AI服务响应异常，请稍后再试'))
        }
      })
      .catch(err => {
        console.error('API请求失败', err)
        reject(new Error('网络请求失败，请检查网络连接'))
      })
  })
}

/**
 * 课文学习页六大功能提示词
 */
const ARTICLE_PROMPTS = {
  // 全文翻译提示词
  TRANSLATE: `

你是一个专业的文言文翻译专家，请将以下文言文翻译成现代汉语。
要求：
1. 翻译准确、流畅，保留原文语意
2. 使用现代汉语表达，让中学生能够理解
3. 注意保留文章的文学性和思想内涵
4. 直接给出翻译结果，不需要解释或分析

注意：请使用纯文本回答，避免使用Markdown格式。需要换行时请使用正常的换行符，确保文本格式正确显示。

文言文原文：
{content}
`,

  // 逐句解析提示词
  SENTENCE_ANALYSIS: `

你是一个文言文教学专家，请对以下文言文句子进行详细解析。
要求：
1. 提供完整的拼音标注
2. 进行断句标注
3. 翻译成现代汉语
4. 解释句中的关键字词（古今异义词、通假字、特殊用法等）
5. 分析句子语法结构
6. 分析修辞手法（如果有）

注意：请使用纯文本回答，避免使用Markdown格式。需要换行时请使用正常的换行符，确保文本格式正确显示。

句子：
{content}

上下文（可选）：
{context}

请按照以下格式回答：
拼音标注：
断句标注：
现代汉语翻译：
关键词解析：
1. 词A：解释...
2. 词B：解释...
语法结构分析：
修辞手法分析：
`,

  // 作者介绍提示词
  AUTHOR_INFO: `

你是一个中国古代文学专家，请提供以下作者的详细介绍。
要求：
1. 作者生平简介（生卒年月、主要经历）
2. 文学成就（代表作品、文学风格）
3. 历史地位和影响
4. 直接给出翻译结果，不需要解释或分析

注意：请使用纯文本回答，避免使用Markdown格式。需要换行时请使用正常的换行符，确保文本格式正确显示。

作者信息：
姓名：{author}
朝代：{dynasty}

请按照以下格式回答：
生平简介：
文学成就：
历史地位：
`,

  // 背景知识提示词
  BACKGROUND: `

你是一个中国古代文学专家，请提供以下文言文的背景知识。
要求：
1. 创作背景（写作缘由、时代背景）
2. 相关历史背景（与文章相关的历史事件或社会环境）
3. 文章主旨思想（中心思想、思想内涵）
4. 文学价值和影响

注意：请使用纯文本回答，避免使用Markdown格式。需要换行时请使用正常的换行符，确保文本格式正确显示。

文章信息：
标题：{title}
作者：{author}
朝代：{dynasty}
内容：{content}

请按照以下格式回答：
创作背景：
历史背景：
主旨思想：
文学价值：
`,

  // 练习题生成提示词
  EXERCISE: `
注意：请使用纯文本回答，避免使用Markdown格式。需要换行时请使用正常的换行符，确保文本格式正确显示。

你是一个中学文言文教师，请根据以下文言文内容，生成{count}道适合{level}学生的练习题。
要求：
1. 题型多样，包括文言文断句题、虚词用法辨析、实词含义选择、句子翻译题、内容理解题、文言现象识别题等
2. 每道题目都要有4个选项，并提供正确答案和详细解析
3. 难度适中，符合学生认知水平

文言文内容：
{content}

适用年级：{level}（primary:小学，junior:初中，senior:高中）
题目数量：{count}

请按照以下格式回答：
题目1：
A. 
B. 
C. 
D. 
正确答案：
解析：

题目2：
...
`,

  // 提问拓展提示词
  QA: `
你是一个拟人化的AI助手，名叫"李白"，是一个文言文学习顾问。
你的人设特点：
1. 有幽默感但不过度，保持礼貌和专业性
2. 说话风格文雅但通俗易懂，偶尔会引用古诗文
3. 知识范围包括中国古代文学、文言文、古代文化、写作技巧等
4. 能够回答文言文相关问题，提供学习指导，进行文言文翻译等

注意：请使用纯文本回答，避免使用Markdown格式。需要换行时请使用正常的换行符，确保文本格式正确显示。

当前学习的文章：
标题：《{title}》
作者：{author}（{dynasty}）
内容：{content}

用户问题：
{question}

请以"李白"的身份回答上述问题，保持人设一致性，回答要专业、准确、易懂，并与当前学习的文章内容相关。
`,

  // 推荐问题提示词
  SUGGESTED_QUESTIONS: `

你是一个文言文学习顾问，请根据以下文言文内容，生成5个学生可能会问的问题。
要求：
1. 问题应该与文章内容、作者、写作背景、文学价值等相关
2. 问题要有深度，能够引导学生思考
3. 问题应该简洁明了，不超过20个字
4. 问题应该覆盖不同方面，如词义理解、句法分析、思想内涵等

注意：请使用纯文本回答，避免使用Markdown格式。需要换行时请使用正常的换行符，确保文本格式正确显示。

文章信息：
标题：{title}
作者：{author}
朝代：{dynasty}
内容：{content}

请直接列出5个问题，每行一个，不要有序号或其他标记。
`
}

/**
 * 填充提示词模板
 * @param {String} template 提示词模板
 * @param {Object} data 填充数据
 * @returns {String} 填充后的提示词
 */
function fillPromptTemplate(template, data) {
  let result = template
  
  // 替换模板中的变量
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{${key}}`, 'g')
    result = result.replace(regex, data[key])
  })
  
  return result
}

/**
 * 课文学习页六大功能AI服务
 */
const articleAIService = {
  /**
   * 获取全文翻译
   * @param {String} content 文言文原文内容
   * @returns {Promise} 翻译结果
   */
  getTranslation: async (content) => {
    const prompt = fillPromptTemplate(ARTICLE_PROMPTS.TRANSLATE, { content })
    const messages = [
      { role: 'system', content: '你是一个专业的文言文翻译专家' },
      { role: 'user', content: prompt }
    ]
    
    try {
      const result = await chatCompletion(messages)
      return result
    } catch (error) {
      console.error('获取翻译失败', error)
      throw error
    }
  },
  
  /**
   * 获取句子解析
   * @param {String} sentence 原句
   * @param {String} context 上下文（可选）
   * @returns {Promise} 解析结果
   */
  getSentenceAnalysis: async (sentence, context = '') => {
    const prompt = fillPromptTemplate(ARTICLE_PROMPTS.SENTENCE_ANALYSIS, { 
      content: sentence,
      context
    })
    
    const messages = [
      { role: 'system', content: '你是一个文言文教学专家' },
      { role: 'user', content: prompt }
    ]
    
    try {
      const result = await chatCompletion(messages)
      return result
    } catch (error) {
      console.error('获取句子解析失败', error)
      throw error
    }
  },
  
  /**
   * 获取作者信息
   * @param {String} author 作者
   * @param {String} dynasty 朝代
   * @param {String} title 作品标题
   * @returns {Promise} 作者信息
   */
  getAuthorInfo: async (author, dynasty, title) => {
    const prompt = fillPromptTemplate(ARTICLE_PROMPTS.AUTHOR_INFO, {
      author,
      dynasty,
      title
    })
    
    const messages = [
      { role: 'system', content: '你是一个中国古代文学专家' },
      { role: 'user', content: prompt }
    ]
    
    try {
      const result = await chatCompletion(messages, { max_tokens: 3000 })
      return result
    } catch (error) {
      console.error('获取作者信息失败', error)
      throw error
    }
  },
  
  /**
   * 获取背景知识
   * @param {String} title 标题
   * @param {String} author 作者
   * @param {String} dynasty 朝代
   * @param {String} content 原文
   * @returns {Promise} 背景知识
   */
  getBackground: async (title, author, dynasty, content) => {
    const prompt = fillPromptTemplate(ARTICLE_PROMPTS.BACKGROUND, {
      title,
      author,
      dynasty,
      content
    })
    
    const messages = [
      { role: 'system', content: '你是一个中国古代文学专家' },
      { role: 'user', content: prompt }
    ]
    
    try {
      const result = await chatCompletion(messages, { max_tokens: 3000 })
      return result
    } catch (error) {
      console.error('获取背景知识失败', error)
      throw error
    }
  },
  
  /**
   * 生成练习题
   * @param {String} content 文言文内容
   * @param {String} level 适用年级 primary/junior/senior
   * @param {Number} count 题目数量
   * @returns {Promise} 练习题列表
   */
  generateExercises: async (content, level, count = 5) => {
    const prompt = fillPromptTemplate(ARTICLE_PROMPTS.EXERCISE, {
      content,
      level,
      count
    })
    
    const messages = [
      { role: 'system', content: '你是一个中学文言文教师' },
      { role: 'user', content: prompt }
    ]
    
    try {
      const result = await chatCompletion(messages, { max_tokens: 3000 })
      return result
    } catch (error) {
      console.error('生成练习题失败', error)
      throw error
    }
  },
  
  /**
   * 回答问题
   * @param {String} question 问题
   * @param {String} title 文章标题
   * @param {String} author 作者
   * @param {String} dynasty 朝代
   * @param {String} content 文章内容
   * @returns {Promise} 回答
   */
  answerQuestion: async (question, title, author, dynasty, content) => {
    const prompt = fillPromptTemplate(ARTICLE_PROMPTS.QA, {
      question,
      title,
      author,
      dynasty,
      content
    })
    
    const messages = [
      { role: 'system', content: '你是一个拟人化的AI助手，名叫"李白"，是一个文言文学习顾问' },
      { role: 'user', content: prompt }
    ]
    
    try {
      const result = await chatCompletion(messages)
      return result
    } catch (error) {
      console.error('回答问题失败', error)
      throw error
    }
  },
  
  /**
   * 获取推荐问题
   * @param {String} title 文章标题
   * @param {String} author 作者
   * @param {String} dynasty 朝代
   * @param {String} content 文章内容
   * @returns {Promise} 推荐问题列表
   */
  getSuggestedQuestions: async (title, author, dynasty, content) => {
    const prompt = fillPromptTemplate(ARTICLE_PROMPTS.SUGGESTED_QUESTIONS, {
      title,
      author,
      dynasty,
      content: content.substring(0, 1000) // 限制内容长度
    })
    
    const messages = [
      { role: 'system', content: '你是一个文言文学习顾问' },
      { role: 'user', content: prompt }
    ]
    
    try {
      const result = await chatCompletion(messages)
      // 将结果按行分割成数组
      return result.split('\n').filter(q => q.trim() !== '').slice(0, 5)
    } catch (error) {
      console.error('获取推荐问题失败', error)
      throw error
    }
  }
}

module.exports = {
  chatCompletion,
  articleAIService,
  ARTICLE_PROMPTS
} 