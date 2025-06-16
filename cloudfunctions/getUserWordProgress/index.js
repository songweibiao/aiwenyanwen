// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  const { userId, collection } = event
  if (!userId) {
    return { success: false, error: '缺少 userId' }
  }
  let query = { userId }
  if (collection) {
    query.collection = collection
  }
  const res = await db.collection('user_word_progress').where(query).get()
  return { success: true, data: res.data }
} 