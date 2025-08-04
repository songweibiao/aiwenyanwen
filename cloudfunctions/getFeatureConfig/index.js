// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const res = await db.collection('configs').doc('feature_flags').get()
    return res.data
  } catch (e) {
    console.error(e)
    // 如果获取失败，返回一个默认的安全配置
    return {
      showAITab: false,
      isReviewing: false // 默认返回false
    }
  }
}