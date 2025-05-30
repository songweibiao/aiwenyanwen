// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { articleId, type, content, extra, timestamp } = event
  const now = timestamp ? new Date(timestamp) : new Date()
  
  // 强制 articleId 为字符串
  const articleIdStr = String(articleId)
  
  console.log(`云函数保存AI内容: articleId=${articleIdStr}, type=${type}`)
  
  try {
    // 查询是否已有该文章记录
    const queryResult = await db.collection('article_ai_content')
      .where({ article_id: articleIdStr })
      .get()
    
    if (queryResult.data && queryResult.data.length > 0) {
      // 已有记录，更新内容
      const recordId = queryResult.data[0]._id
      const updateData = {}
      
      // 特殊处理句子解析
      if (type === 'sentence_analysis' && extra && extra.sentence) {
        // 如果没有sentences数组，先创建
        if (!queryResult.data[0][type] || !queryResult.data[0][type].sentences) {
          updateData[`${type}`] = {
            updated_at: now,
            sentences: [{ ...content, original_text: extra.sentence }]
          }
        } else {
          // 检查该句子是否已存在
          const sentences = queryResult.data[0][type].sentences || []
          const existingSentenceIndex = sentences.findIndex(
            item => item.original_text === extra.sentence
          )
          
          if (existingSentenceIndex >= 0) {
            // 更新已存在的句子
            sentences[existingSentenceIndex] = { 
              ...content, 
              original_text: extra.sentence 
            }
          } else {
            // 添加新句子
            sentences.push({ ...content, original_text: extra.sentence })
          }
          
          updateData[`${type}.sentences`] = sentences
          updateData[`${type}.updated_at`] = now
        }
      } else {
        // 其他类型直接更新
        updateData[type] = content
        updateData[`${type}_updated_at`] = now
      }
      
      console.log(`更新记录: recordId=${recordId}`)
      
      // 更新记录
      const updateResult = await db.collection('article_ai_content').doc(recordId).update({
        data: updateData
      })
      
      return {
        success: true,
        operation: 'update',
        result: updateResult
      }
    } else {
      // 没有记录，创建新记录
      const newRecord = {
        article_id: articleIdStr,
        created_at: now,
        updated_at: now
      }
      
      // 特殊处理句子解析
      if (type === 'sentence_analysis' && extra && extra.sentence) {
        newRecord[type] = {
          updated_at: now,
          sentences: [{ ...content, original_text: extra.sentence }]
        }
      } else {
        // 其他类型直接设置
        newRecord[type] = content
        newRecord[`${type}_updated_at`] = now
      }
      
      console.log(`创建新记录: articleId=${articleIdStr}`)
      
      // 创建新记录
      const addResult = await db.collection('article_ai_content').add({
        data: newRecord
      })
      
      return {
        success: true,
        operation: 'add',
        result: addResult
      }
    }
  } catch (err) {
    console.error('保存AI内容失败', err)
    return {
      success: false,
      error: err
    }
  }
} 