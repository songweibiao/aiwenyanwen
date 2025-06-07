// 云函数 - userAIChat
// 用于管理用户与AI助手的聊天记录

const cloud = require('wx-server-sdk')

// 初始化 cloud
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const userAIChatCollection = db.collection('user_ai_chat')

/**
 * 用户AI聊天记录管理
 * @param event 
 *   - action: 操作类型 (get/save)
 *   - messages: 聊天消息数组 (仅save操作需要)
 * @param context 
 */
exports.main = async (event, context) => {
  // 获取用户openid
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  if (!openid) {
    return {
      success: false,
      error: '未获取到用户身份信息'
    }
  }
  
  const { action, messages } = event
  
  try {
    // 获取用户聊天记录
    if (action === 'get') {
      const result = await userAIChatCollection.where({
        userId: openid
      }).get()
      
      return {
        success: true,
        messages: result.data.length > 0 ? result.data[0].messages : [
          {
            id: Date.now(),
            role: 'assistant',
            content: '你好！我是李白，有什么文言文、古诗、文学相关问题，尽管问我吧~'
          }
        ]
      }
    }
    
    // 保存/更新用户聊天记录
    else if (action === 'save') {
      if (!Array.isArray(messages)) {
        return {
          success: false,
          error: '消息格式不正确'
        }
      }
      
      // 查询用户是否已有聊天记录
      const existingRecord = await userAIChatCollection.where({
        userId: openid
      }).get()
      
      if (existingRecord.data.length > 0) {
        // 更新现有记录
        const recordId = existingRecord.data[0]._id
        await userAIChatCollection.doc(recordId).update({
          data: {
            messages: messages,
            updatedAt: db.serverDate()
          }
        })
      } else {
        // 创建新记录
        await userAIChatCollection.add({
          data: {
            userId: openid,
            messages: messages,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        })
      }
      
      return {
        success: true
      }
    }
    
    return {
      success: false,
      error: '未知的操作类型'
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      error: error.message
    }
  }
} 