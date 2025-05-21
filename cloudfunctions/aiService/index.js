// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 导入提示词模板
const prompts = require('./prompts')

/**
 * 调用AI大模型
 * @param {Object} data 请求参数
 * @returns {Promise} AI响应结果
 */
async function callAIModel(data) {
  try {
    // 这里是调用大模型API的代码
    // 实际项目中应该使用类似OpenAI、百度文心一言等API
    // 这里暂时使用模拟数据返回

    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 500))

    // 根据不同类型返回模拟数据
    switch (data.type) {
      case 'translate':
        return {
          success: true,
          translation: `这是"${data.content.substring(0, 10)}..."的现代汉语翻译。在实际项目中，这里会返回真实的翻译结果。`
        }
      case 'sentence_analysis':
        return {
          success: true,
          sentence: data.content,
          phonetic_notation: `拼音标注示例(${data.content.substring(0, 5)})`,
          punctuated_text: `断句标注示例(${data.content.substring(0, 5)})`,
          translation: `句子翻译示例(${data.content.substring(0, 5)})`,
          key_words: [
            {
              word: data.content.charAt(0),
              explanation: `${data.content.charAt(0)}的解释示例`,
              word_type: '实词'
            }
          ],
          sentence_structure: `语法结构分析示例(${data.content.substring(0, 5)})`,
          rhetorical_analysis: `修辞手法分析示例(${data.content.substring(0, 5)})`
        }
      case 'background':
        return {
          success: true,
          author_intro: `${data.author}简介示例`,
          creation_background: `《${data.title}》创作背景示例`,
          historical_background: `${data.dynasty}历史背景示例`,
          main_idea: `《${data.title}》主旨思想示例`
        }
      case 'exercise':
        return {
          success: true,
          exercises: [
            {
              question: '文言文练习题示例1',
              options: ['选项A', '选项B', '选项C', '选项D'],
              answer: '选项A',
              analysis: '解析示例1'
            },
            {
              question: '文言文练习题示例2',
              options: ['选项A', '选项B', '选项C', '选项D'],
              answer: '选项B',
              analysis: '解析示例2'
            }
          ]
        }
      case 'chat':
        return {
          success: true,
          reply: `这是对"${data.content.substring(0, 10)}..."的回复示例。在实际项目中，这里会返回真实的AI回复。`
        }
      default:
        return {
          success: false,
          error: '未知的AI服务类型'
        }
    }
  } catch (error) {
    console.error('调用AI模型失败', error)
    return {
      success: false,
      error: error.message || '服务异常'
    }
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { type } = event

  // 根据类型获取提示词模板
  let promptTemplate = ''
  switch (type) {
    case 'translate':
      promptTemplate = prompts.translatePrompt
      break
    case 'sentence_analysis':
      promptTemplate = prompts.sentenceAnalysisPrompt
      break
    case 'background':
      promptTemplate = prompts.backgroundPrompt
      break
    case 'exercise':
      promptTemplate = prompts.exercisePrompt
      break
    case 'chat':
      promptTemplate = prompts.chatPrompt
      break
    default:
      return {
        success: false,
        error: '未知的AI服务类型'
      }
  }

  // 构建提示词
  const promptData = {
    ...event,
    promptTemplate
  }

  // 调用AI模型
  const result = await callAIModel(promptData)
  return result
} 