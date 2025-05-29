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
    let articleData = null
    
    // 优先通过 article_id 查询文章
    const articleByArticleIdRes = await db.collection('articles')
      .where({ article_id: articleId.toString() })
      .get()
      .catch(() => ({ data: [] }))
    
    if (articleByArticleIdRes.data && articleByArticleIdRes.data.length > 0) {
      // 使用查询到的 article_id
      articleData = articleByArticleIdRes.data[0]
      actualArticleId = articleData.article_id
    } else {
      // 如果通过 article_id 查询失败，尝试通过 _id 查询
      try {
        const articleByIdRes = await db.collection('articles').doc(articleId).get()
          .catch(() => ({ data: null }))
        
        if (articleByIdRes.data) {
          articleData = articleByIdRes.data
          // 如果文章存在 article_id 字段，使用该字段
          if (articleData.article_id) {
            actualArticleId = articleData.article_id
          } else {
            // 如果不存在 article_id，则使用 _id 作为 article_id
            actualArticleId = articleId
            // 更新文章，添加 article_id 字段
            await db.collection('articles').doc(articleId).update({
              data: {
                article_id: articleId
              }
            }).catch(err => {
              console.error('更新文章 article_id 失败:', err)
            })
          }
        }
      } catch (err) {
        console.error('通过 _id 查询文章失败:', err)
        // 如果两种方式都查询失败，使用传入的 articleId
        actualArticleId = articleId
      }
    }
    
    // 查询是否已有该用户该文章的记录
    const recordRes = await db.collection('user_article_record').where({
      user_id: openid,
      article_id: actualArticleId
    }).get()
    
    // 如果没有记录，创建新记录
    if (recordRes.data.length === 0) {
      // 创建初始记录
      const result = await db.collection('user_article_record').add({
        data: {
          user_id: openid,
          article_id: actualArticleId,
          last_learn_time: now,
          learn_status: 0, // 0表示未开始
          learn_duration: 0,
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
    // 如果已有记录，更新最后学习时间
    else {
      const record = recordRes.data[0]
      const recordId = record._id
      
      // 只更新最后学习时间，保留原有的学习状态
      const updateData = {
        last_learn_time: now
      }
      
      // 如果是未开始状态，更新为学习中
      if (record.learn_status === 0) {
        updateData.learn_status = 1 // 1表示学习中
      }
      
      // 重要：如果当前状态是"已完成"(2)，不要改变状态
      // 只有在状态为0时才更新为1，如果已经是2则保持不变
      
      // 记录当前所有功能点击状态，用于日志
      console.log('当前学习记录状态:', {
        learn_status: record.learn_status,
        func1_clicked: record.func1_clicked,
        func2_clicked: record.func2_clicked,
        func3_clicked: record.func3_clicked,
        func4_clicked: record.func4_clicked,
        func5_clicked: record.func5_clicked,
        func6_clicked: record.func6_clicked
      });
      
      // 检查是否所有功能都已点击
      const allFunctionsClicked = 
        record.func1_clicked &&
        record.func2_clicked &&
        record.func3_clicked &&
        record.func4_clicked &&
        record.func5_clicked &&
        record.func6_clicked;
      
      console.log('所有功能是否已点击:', allFunctionsClicked);
      
      // 如果所有功能都已点击，确保状态为"已完成"(2)
      if (allFunctionsClicked && record.learn_status !== 2) {
        updateData.learn_status = 2; // 确保状态为已完成
        console.log('所有功能都已点击，强制更新状态为已完成(2)');
      }
      
      // 更新最后学习时间，但不改变已完成的状态
      const result = await db.collection('user_article_record').doc(recordId).update({
        data: updateData
      })
      
      console.log('更新结果:', result);
      console.log('更新后的状态:', updateData.learn_status !== undefined ? updateData.learn_status : record.learn_status);
      
      return {
        success: true,
        isNew: false,
        message: '成功更新学习记录',
        article_id: actualArticleId,
        learnStatus: updateData.learn_status !== undefined ? updateData.learn_status : record.learn_status, // 返回更新后的学习状态
        allFunctionsClicked: allFunctionsClicked
      }
    }
  } catch (error) {
    console.error('更新学习记录失败', error)
    return {
      success: false,
      error: JSON.stringify(error)
    }
  }
} 