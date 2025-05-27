// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 导入提示词模板
const prompts = require('./prompts')

// OpenAI兼容API配置
const OPENAI_CONFIG = {
  API_URL: 'https://zeaezsezfddc.ap-southeast-1.clawcloudrun.com/v1/chat/completions',
  API_KEY: 'sk-wiibil',
  MODEL: 'gemini-2.5-flash-preview-05-20',
}

/**
 * 直接调用OpenAI兼容API
 * @param {Object} data 请求参数
 * @returns {Promise} AI响应结果
 */
async function directCallOpenAI(data) {
  try {
    console.log('直接调用API参数:', data);
    const { messages, model, temperature, max_tokens, top_p, frequency_penalty, presence_penalty } = data;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return {
        success: false,
        error: '消息参数不能为空'
      };
    }
    
    const response = await axios({
      method: 'post',
      url: OPENAI_CONFIG.API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_CONFIG.API_KEY}`
      },
      data: {
        model: model || OPENAI_CONFIG.MODEL,
        messages: messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2000,
        top_p: top_p || 1,
        frequency_penalty: frequency_penalty || 0,
        presence_penalty: presence_penalty || 0
      }
    });
    
    console.log('API响应:', response.status, response.data);
    
    if (response.status === 200 && response.data && response.data.choices && response.data.choices.length > 0) {
      return {
        success: true,
        content: response.data.choices[0].message.content
      };
    } else {
      throw new Error('API响应格式异常');
    }
  } catch (error) {
    console.error('直接调用OpenAI API失败', error);
    return {
      success: false,
      error: error.message || 'API调用失败'
    };
  }
}

/**
 * 调用OpenAI兼容API
 * @param {Array} messages 消息列表
 * @param {Object} options 可选参数
 * @returns {Promise} AI响应结果
 */
async function callOpenAIAPI(messages, options = {}) {
  try {
    const response = await axios({
      method: 'post',
      url: OPENAI_CONFIG.API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_CONFIG.API_KEY}`
      },
      data: {
        model: OPENAI_CONFIG.MODEL,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 2000,
        top_p: options.top_p || 1,
        frequency_penalty: options.frequency_penalty || 0,
        presence_penalty: options.presence_penalty || 0
      }
    });
    
    if (response.status === 200 && response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      throw new Error('API响应格式异常');
    }
  } catch (error) {
    console.error('调用OpenAI API失败', error);
    throw new Error(error.message || 'API调用失败');
  }
}

/**
 * 调用AI大模型
 * @param {Object} data 请求参数
 * @returns {Promise} AI响应结果
 */
async function callAIModel(data) {
  try {
    const { type, promptTemplate } = data;
    let systemPrompt = '';
    let userPrompt = '';
    let messages = [];
    
    switch (type) {
      case 'translate':
        systemPrompt = '你是一个专业的文言文翻译专家';
        userPrompt = promptTemplate.replace('{content}', data.content);
        break;
      case 'sentence_analysis':
        systemPrompt = '你是一个文言文教学专家';
        userPrompt = promptTemplate
          .replace('{content}', data.content)
          .replace('{context}', data.context || '');
        break;
      case 'background':
        systemPrompt = '你是一个中国古代文学专家';
        userPrompt = promptTemplate
          .replace('{title}', data.title)
          .replace('{author}', data.author)
          .replace('{dynasty}', data.dynasty)
          .replace('{content}', data.content);
        break;
      case 'exercise':
        systemPrompt = '你是一个中学文言文教师';
        userPrompt = promptTemplate
          .replace('{content}', data.content)
          .replace('{level}', data.level)
          .replace('{count}', data.count);
        break;
      case 'chat':
        systemPrompt = '你是一个拟人化的AI助手，名叫"李白"，是一个文言文学习顾问';
        userPrompt = promptTemplate
          .replace('{messages}', JSON.stringify(data.messages || []))
          .replace('{content}', data.content);
        break;
      default:
        throw new Error('未知的AI服务类型');
    }
    
    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    // 调用OpenAI兼容API
    const result = await callOpenAIAPI(messages, {
      max_tokens: type === 'exercise' ? 3000 : 2000
    });
    
    // 根据不同类型处理结果
    switch (type) {
      case 'translate':
        return {
          success: true,
          translation: result
        };
      case 'sentence_analysis':
        return {
          success: true,
          analysis: result
        };
      case 'background':
        return {
          success: true,
          background_info: result
        };
      case 'exercise':
        return {
          success: true,
          exercises: result
        };
      case 'chat':
        return {
          success: true,
          reply: result
        };
      default:
        return {
          success: true,
          result
        };
    }
  } catch (error) {
    console.error('调用AI模型失败', error);
    return {
      success: false,
      error: error.message || '服务异常'
    };
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('云函数收到请求:', event);
  const { type } = event;

  // 直接调用API的情况
  if (type === 'direct_chat') {
    console.log('处理direct_chat请求');
    return await directCallOpenAI(event);
  }

  // 根据类型获取提示词模板
  let promptTemplate = '';
  switch (type) {
    case 'translate':
      promptTemplate = prompts.translatePrompt;
      break;
    case 'sentence_analysis':
      promptTemplate = prompts.sentenceAnalysisPrompt;
      break;
    case 'background':
      promptTemplate = prompts.backgroundPrompt;
      break;
    case 'exercise':
      promptTemplate = prompts.exercisePrompt;
      break;
    case 'chat':
      promptTemplate = prompts.chatPrompt;
      break;
    default:
      console.error('未知的AI服务类型:', type);
      return {
        success: false,
        error: '未知的AI服务类型'
      };
  }

  // 构建提示词
  const promptData = {
    ...event,
    promptTemplate,
    type
  };

  // 调用AI模型
  const result = await callAIModel(promptData);
  return result;
} 