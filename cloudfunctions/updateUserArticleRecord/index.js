// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { articleId } = event
  
  try {
    // 获取当前时间
    const now = new Date()
    
    // 首先检查传入的 articleId 是否是文章的 _id 或 article_id
    let actualArticleId = articleId
    
    // 尝试通过 _id 查询文章
    const articleByIdRes = await db.collection('articles').doc(articleId).get()
      .catch(() => ({ data: null }))
    
    if (articleByIdRes.data) {
      // 如果文章存在 article_id 字段，使用该字段
      if (articleByIdRes.data.article_id) {
        actualArticleId = articleByIdRes.data.article_id
      }
    } else {
      // 如果通过 _id 查询失败，尝试通过 article_id 查询
      const articleByArticleIdRes = await db.collection('articles')
        .where({ article_id: articleId })
        .get()
        .catch(() => ({ data: [] }))
      
      if (articleByArticleIdRes.data && articleByArticleIdRes.data.length > 0) {
        // 使用查询到的 article_id
        actualArticleId = articleByArticleIdRes.data[0].article_id
      }
    }
    
    // 查询是否已有该用户该文章的记录
    const recordRes = await db.collection('user_article_record').where({
      user_id: openid,
      article_id: actualArticleId
    }).get()
    
    // 如果没有记录，创建新记录
    if (recordRes.data.length === 0) {
      const result = await db.collection('user_article_record').add({
        data: {
          user_id: openid,
          article_id: actualArticleId,
          last_learn_time: now,
          learn_status: 1, // 1表示学习中
          learn_duration: 0, // 初始学习时长为0秒
          func1_clicked: false,
          func2_clicked: false,
          func3_clicked: false,
          func4_clicked: false,
          func5_clicked: false,
          func6_clicked: false,
          create_time: now
        }
      })
      return {
        success: true,
        isNew: true,
        message: '成功创建学习记录',
        article_id: actualArticleId
      }
    } 
    // 如果已有记录，更新last_learn_time
    else {
      const recordId = recordRes.data[0]._id
      const result = await db.collection('user_article_record').doc(recordId).update({
        data: {
          last_learn_time: now,
          learn_status: 1 // 确保状态为"学习中"
        }
      })
      return {
        success: true,
        isNew: false,
        message: '成功更新学习记录',
        article_id: actualArticleId
      }
    }
  } catch (error) {
    console.error('更新学习记录失败', error)
    return {
      success: false,
      error: error
    }
  }
} 