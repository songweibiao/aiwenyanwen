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
  
  // 功能索引对应的功能名称
  const functionNames = {
    1: '全文翻译',
    2: '逐句解析',
    3: '作者介绍',
    4: '背景知识',
    5: '练习巩固',
    6: 'AI互动'
  }
  
  // 功能索引对应的字段名称
  const functionFields = {
    1: 'func1_clicked',
    2: 'func2_clicked',
    3: 'func3_clicked',
    4: 'func4_clicked',
    5: 'func5_clicked',
    6: 'func6_clicked'
  }
  
  // 获取当前功能的名称
  const functionName = functionNames[funcIndex]
  
  try {
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
        create_time: now,
        // 添加功能名称记录
        function_clicks: [{
          name: functionName,
          time: now
        }]
      }
      
      // 设置对应功能的点击状态
      initialData[functionFields[funcIndex]] = true
      
      const result = await db.collection('user_article_record').add({
        data: initialData
      })
      
      return {
        success: true,
        isNew: true,
        message: `成功创建学习记录并记录功能"${functionName}"点击状态`,
        article_id: actualArticleId,
        function_name: functionName
      }
    }
    // 如果已有记录，更新对应功能的点击状态
    else {
      const record = recordRes.data[0]
      const recordId = record._id
      
      // 构建更新对象
      const updateData = {}
      updateData[functionFields[funcIndex]] = true
      
      // 更新最后学习时间
      updateData.last_learn_time = new Date()
      
      // 添加功能点击记录
      updateData[`function_clicks`] = _.push({
        name: functionName,
        time: new Date()
      })
      
      // 执行更新
      const result = await db.collection('user_article_record').doc(recordId).update({
        data: updateData
      })
      
      // 获取更新后的记录，以便正确判断所有功能是否都已点击
      const updatedRecord = await db.collection('user_article_record').doc(recordId).get()
        .then(res => res.data)
        .catch((err) => {
          console.error('获取更新后的记录失败:', err);
          return record; // 如果获取失败，使用原始记录
        });
      
      console.log('更新前的记录:', JSON.stringify(record));
      console.log('更新后的记录:', JSON.stringify(updatedRecord));
      
      // 使用更新后的记录检查是否所有功能都已点击
      const allClicked = 
        updatedRecord.func1_clicked &&
        updatedRecord.func2_clicked &&
        updatedRecord.func3_clicked &&
        updatedRecord.func4_clicked &&
        updatedRecord.func5_clicked &&
        updatedRecord.func6_clicked;
      
      console.log('所有功能是否都已点击 (基于更新后的记录):', allClicked);
      console.log('功能点击状态:', JSON.stringify({
        func1: updatedRecord.func1_clicked,
        func2: updatedRecord.func2_clicked,
        func3: updatedRecord.func3_clicked,
        func4: updatedRecord.func4_clicked,
        func5: updatedRecord.func5_clicked,
        func6: updatedRecord.func6_clicked
      }));
      
      // 如果所有功能都已点击，更新学习状态为已完成
      if (allClicked) {
        console.log('所有功能都已点击，更新学习状态为已完成(2)');
        
        try {
          // 强制更新学习状态为已完成
          const updateResult = await db.collection('user_article_record').doc(recordId).update({
            data: {
              learn_status: 2 // 2表示已学完
            }
          });
          
          console.log('更新学习状态结果:', JSON.stringify(updateResult));
          
          // 再次获取记录，确认状态已更新
          const finalRecord = await db.collection('user_article_record').doc(recordId).get()
            .then(res => res.data)
            .catch(err => {
              console.error('获取最终记录失败:', err);
              return null;
            });
          
          if (finalRecord) {
            console.log('最终记录状态:', finalRecord.learn_status);
          }
          
          return {
            success: true,
            isNew: false,
            message: `成功更新功能"${functionName}"点击状态，所有功能已点击，学习状态更新为已完成`,
            learnStatus: 2,
            article_id: actualArticleId,
            function_name: functionName,
            allFunctionsClicked: true
          }
        } catch (updateError) {
          console.error('更新学习状态为已完成时出错:', updateError);
          
          // 尽管更新失败，仍然返回成功，但标记更新状态失败
          return {
            success: true,
            isNew: false,
            message: `功能"${functionName}"点击状态已更新，但更新学习状态失败`,
            learnStatus: 1, // 保持原状态
            article_id: actualArticleId,
            function_name: functionName,
            allFunctionsClicked: true,
            statusUpdateFailed: true
          }
        }
      }
      
      console.log('不是所有功能都已点击，保持学习状态为学习中(1)');
      
      return {
        success: true,
        isNew: false,
        message: `成功更新功能"${functionName}"点击状态`,
        learnStatus: 1,
        article_id: actualArticleId,
        function_name: functionName,
        allFunctionsClicked: false
      }
    }
  } catch (error) {
    console.error('更新功能点击状态失败', error)
    return {
      success: false,
      error: JSON.stringify(error)
    }
  }
} 