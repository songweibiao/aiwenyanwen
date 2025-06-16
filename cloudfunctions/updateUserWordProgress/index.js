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
  const { userId, wordId, collection, status, action } = event
  const now = new Date()
  
  // 增加action参数，区分更新和获取操作
  // action = 'get' 时获取进度，默认为更新操作
  if (action === 'get') {
    return await getUserProgress(userId, collection);
  }
  
  // 更新操作需要检查必要参数
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

// 获取用户学习进度的函数
async function getUserProgress(userId, collection) {
  if (!userId) {
    return { success: false, error: '用户ID不能为空' };
  }
  
  try {
    // 构建查询条件
    const query = { userId };
    
    // 如果指定了合集，添加合集过滤条件
    if (collection) {
      const decodedCollection = decodeIfNeeded(collection);
      query.collection = decodedCollection;
    }
    
    console.log('【查询条件】', query);
    
    // 执行查询
    const result = await db.collection('user_word_progress')
      .where(query)
      .get();
    
    console.log('【查询结果】', result);
    
    return {
      success: true,
      data: result.data || []
    };
  } catch (err) {
    console.error('【获取用户进度异常】', err);
    return { success: false, error: err.message || err };
  }
} 