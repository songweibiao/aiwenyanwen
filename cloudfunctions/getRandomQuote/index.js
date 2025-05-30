// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 获取名句总数
    const countResult = await db.collection('famous_quotes').count()
    const total = countResult.total
    
    if (total <= 0) {
      return {
        success: false,
        message: '数据库中没有名句数据'
      }
    }
    
    // 生成随机索引
    const randomIndex = Math.floor(Math.random() * total)
    
    // 获取随机名句
    const quoteResult = await db.collection('famous_quotes')
      .skip(randomIndex)
      .limit(1)
      .get()
    
    if (quoteResult.data && quoteResult.data.length > 0) {
      return {
        success: true,
        data: quoteResult.data[0]
      }
    } else {
      return {
        success: false,
        message: '获取名句失败'
      }
    }
  } catch (error) {
    console.error('获取随机名句失败:', error)
    return {
      success: false,
      message: '获取随机名句失败',
      error: error
    }
  }
} 