// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const MAX_LIMIT = 100 // 一次最多获取100条记录

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 获取参数
  const { type } = event // 可选参数，可以是 'history'(默认) 或 'latest'
  
  try {
    // 如果是获取最新的一条记录
    if (type === 'latest') {
      const recordRes = await db.collection('user_article_record')
        .where({
          user_id: openid
        })
        .orderBy('last_learn_time', 'desc')
        .limit(1)
        .get()
      
      if (recordRes.data.length === 0) {
        return {
          success: true,
          data: null,
          message: '未找到学习记录'
        }
      }
      
      // 获取文章详情
      const articleId = recordRes.data[0].article_id
      const articleRes = await db.collection('articles').where({
        _id: articleId
      }).get()
      
      // 如果没找到文章，尝试通过article_id查询
      let article = null
      if (articleRes.data.length > 0) {
        article = articleRes.data[0]
      } else {
        const articleByIdRes = await db.collection('articles').where({
          article_id: articleId
        }).get()
        
        if (articleByIdRes.data.length > 0) {
          article = articleByIdRes.data[0]
        }
      }
      
      // 返回最新学习记录及文章信息
      return {
        success: true,
        data: {
          record: recordRes.data[0],
          article: article
        },
        message: '获取最新学习记录成功'
      }
    }
    
    // 获取学习历史记录列表
    // 首先获取总记录数
    const countResult = await db.collection('user_article_record').where({
      user_id: openid
    }).count()
    
    const total = countResult.total
    
    // 计算需要分几次取
    const batchTimes = Math.ceil(total / MAX_LIMIT)
    
    // 承载所有读操作的 promise 的数组
    const tasks = []
    
    for (let i = 0; i < batchTimes; i++) {
      const promise = db.collection('user_article_record')
        .where({
          user_id: openid
        })
        .orderBy('last_learn_time', 'desc')
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get()
      
      tasks.push(promise)
    }
    
    // 等待所有
    const results = await Promise.all(tasks)
    
    // 合并结果
    let records = []
    results.forEach(result => {
      records = records.concat(result.data)
    })
    
    // 获取对应的文章信息
    const articleIds = [...new Set(records.map(record => record.article_id))]
    
    // 分批获取文章信息
    const articleTasks = []
    const articleBatchTimes = Math.ceil(articleIds.length / MAX_LIMIT)
    
    for (let i = 0; i < articleBatchTimes; i++) {
      const batchIds = articleIds.slice(i * MAX_LIMIT, (i + 1) * MAX_LIMIT)
      
      // 先尝试通过_id查询
      const promise1 = db.collection('articles')
        .where({
          _id: _.in(batchIds)
        })
        .get()
      
      // 再尝试通过article_id查询
      const promise2 = db.collection('articles')
        .where({
          article_id: _.in(batchIds.map(id => id.toString()))
        })
        .get()
      
      articleTasks.push(promise1)
      articleTasks.push(promise2)
    }
    
    const articleResults = await Promise.all(articleTasks)
    
    // 合并文章结果
    let articles = []
    articleResults.forEach(result => {
      articles = articles.concat(result.data)
    })
    
    // 去重（可能通过_id和article_id查到重复文章）
    const uniqueArticles = {}
    articles.forEach(article => {
      const id = article._id || article.article_id
      if (!uniqueArticles[id]) {
        uniqueArticles[id] = article
      }
    })
    
    // 将文章信息关联到记录
    const recordsWithArticle = records.map(record => {
      const articleId = record.article_id
      const article = uniqueArticles[articleId] || 
                     articles.find(a => a.article_id === articleId) || 
                     { title: '未知文章', author: '未知作者', dynasty: '' }
      
      return {
        ...record,
        article: {
          _id: article._id || articleId,
          article_id: article.article_id || articleId,
          title: article.title,
          author: article.author,
          dynasty: article.dynasty
        }
      }
    })
    
    return {
      success: true,
      data: recordsWithArticle,
      total: total,
      message: '获取学习历史记录成功'
    }
    
  } catch (error) {
    console.error('获取学习记录失败', error)
    return {
      success: false,
      error: error
    }
  }
} 