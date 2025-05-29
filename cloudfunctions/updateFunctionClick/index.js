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
  const { articleId, functionIndex } = event
  
  // 确保functionIndex是1-6之间的有效数字
  const funcIndex = parseInt(functionIndex)
  if (isNaN(funcIndex) || funcIndex < 1 || funcIndex > 6) {
    return {
      success: false,
      message: '功能索引无效，必须是1-6之间的整数'
    }
  }
  
  try {
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
    
    // 如果没有记录，创建新记录（理论上不会发生，因为进入页面时已创建）
    if (recordRes.data.length === 0) {
      const now = new Date()
      // 创建初始记录，将对应功能点击状态设为true
      const initialData = {
        user_id: openid,
        article_id: actualArticleId,
        last_learn_time: now,
        learn_status: 1, // 1表示学习中
        learn_duration: 0,
        func1_clicked: false,
        func2_clicked: false,
        func3_clicked: false,
        func4_clicked: false,
        func5_clicked: false,
        func6_clicked: false,
        create_time: now
      }
      
      // 设置对应功能的点击状态
      initialData[`func${funcIndex}_clicked`] = true
      
      const result = await db.collection('user_article_record').add({
        data: initialData
      })
      
      return {
        success: true,
        isNew: true,
        message: `成功创建学习记录并记录功能${funcIndex}点击状态`,
        article_id: actualArticleId
      }
    }
    // 如果已有记录，更新对应功能的点击状态
    else {
      const record = recordRes.data[0]
      const recordId = record._id
      
      // 构建更新对象
      const updateData = {}
      updateData[`func${funcIndex}_clicked`] = true
      
      // 更新最后学习时间
      updateData.last_learn_time = new Date()
      
      // 执行更新
      const result = await db.collection('user_article_record').doc(recordId).update({
        data: updateData
      })
      
      // 检查是否所有功能都已点击，如果是，则更新学习状态为已完成(2)
      const allClicked = 
        (funcIndex === 1 || record.func1_clicked) &&
        (funcIndex === 2 || record.func2_clicked) &&
        (funcIndex === 3 || record.func3_clicked) &&
        (funcIndex === 4 || record.func4_clicked) &&
        (funcIndex === 5 || record.func5_clicked) &&
        (funcIndex === 6 || record.func6_clicked)
      
      if (allClicked) {
        await db.collection('user_article_record').doc(recordId).update({
          data: {
            learn_status: 2 // 2表示已学完
          }
        })
        
        return {
          success: true,
          isNew: false,
          message: `成功更新功能${funcIndex}点击状态，所有功能已点击，学习状态更新为已完成`,
          learnStatus: 2,
          article_id: actualArticleId
        }
      }
      
      return {
        success: true,
        isNew: false,
        message: `成功更新功能${funcIndex}点击状态`,
        learnStatus: 1,
        article_id: actualArticleId
      }
    }
  } catch (error) {
    console.error('更新功能点击状态失败', error)
    return {
      success: false,
      error: error
    }
  }
} 