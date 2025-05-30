// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { articleId, type, extra } = event
  
  console.log(`云函数查询AI内容: articleId=${articleId}, type=${type}`)
  
  try {
    // 查询文章记录
    const result = await db.collection('article_ai_content')
      .where({ article_id: articleId })
      .get()
    
    console.log(`查询结果: 找到${result.data.length}条记录`)
    
    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('查询AI内容失败', err)
    return {
      success: false,
      error: err
    }
  }
} 