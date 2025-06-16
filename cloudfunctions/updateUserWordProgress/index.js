// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

// 解码URL编码的字符串
function decodeIfNeeded(str) {
  if (!str) return '';
  
  try {
    // 检查字符串是否包含URL编码的特殊字符
    if (/%[0-9A-F]{2}/.test(str)) {
      return decodeURIComponent(str);
    }
    return str;
  } catch (e) {
    console.error('解码失败:', e);
    return str;
  }
}

exports.main = async (event, context) => {
  console.log('【云函数参数】', event);
  const { userId, wordId, collection, status } = event
  const now = new Date()
  
  if (!userId || !wordId || !status) {
    console.error('【参数不完整】', { userId, wordId, collection, status });
    return { success: false, error: '参数不完整' }
  }
  
  // 解码集合名称
  const decodedCollection = decodeIfNeeded(collection);
  console.log('【解码后的集合名称】', decodedCollection);
  
  try {
    // 先尝试更新
    const updateRes = await db.collection('user_word_progress').where({
      userId, wordId
    }).update({
      data: {
        collection: decodedCollection, // 只保存一个解码后的集合字段
        status,
        lastStudied: now,
        updateTime: now
      }
    })
    console.log('【update结果】', updateRes);
    if (updateRes.stats && updateRes.stats.updated > 0) {
      return { success: true, updated: true }
    }
    // 若无则插入
    const addRes = await db.collection('user_word_progress').add({
      data: {
        userId, 
        wordId, 
        collection: decodedCollection, // 只保存一个解码后的集合字段
        status,
        lastStudied: now,
        updateTime: now
      }
    })
    console.log('【add结果】', addRes);
    return { success: true, inserted: true }
  } catch (err) {
    console.error('【云函数执行异常】', err);
    return { success: false, error: err.message || err }
  }
} 