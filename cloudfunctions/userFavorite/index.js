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
  
  // 如果没有传入openid，则使用当前用户的openid
  const userId = event.userId || openid
  
  // 获取操作类型
  const { action, type, id, data } = event
  
  // 根据操作类型执行不同的逻辑
  switch (action) {
    case 'add':
      // 添加收藏
      return await addFavorite(userId, type, id, data)
    case 'remove':
      // 取消收藏
      return await removeFavorite(userId, type, id)
    case 'check':
      // 检查是否已收藏
      return await checkFavorite(userId, type, id)
    case 'list':
      // 获取收藏列表
      return await listFavorites(userId, type)
    default:
      return {
        success: false,
        message: '未知操作类型'
      }
  }
}

/**
 * 添加收藏
 * @param {string} userId - 用户ID
 * @param {string} type - 收藏类型：'article' 或 'quote'
 * @param {string} id - 收藏项目ID
 * @param {object} data - 收藏项目数据
 */
async function addFavorite(userId, type, id, data) {
  try {
    // 检查是否已收藏
    const checkResult = await checkFavorite(userId, type, id)
    
    if (checkResult.isFavorite) {
      return {
        success: true,
        message: '已经收藏过了',
        data: checkResult.data
      }
    }
    
    // 根据类型准备数据
    let favoriteData = {
      userId: userId,
      type: type,
      itemId: id,
      createTime: db.serverDate()
    }
    
    // 添加数据字段
    if (type === 'article') {
      favoriteData.article = data || {}
    } else if (type === 'quote') {
      favoriteData.quote = data || {}
    }
    
    // 添加到收藏集合
    const result = await db.collection('user_favorite').add({
      data: favoriteData
    })
    
    return {
      success: true,
      message: '收藏成功',
      data: {
        _id: result._id,
        ...favoriteData
      }
    }
  } catch (error) {
    console.error('添加收藏失败:', error)
    return {
      success: false,
      message: '添加收藏失败',
      error: error
    }
  }
}

/**
 * 取消收藏
 * @param {string} userId - 用户ID
 * @param {string} type - 收藏类型：'article' 或 'quote'
 * @param {string} id - 收藏项目ID
 */
async function removeFavorite(userId, type, id) {
  try {
    // 查询收藏记录
    const record = await db.collection('user_favorite')
      .where({
        userId: userId,
        type: type,
        itemId: id
      })
      .get()
    
    if (record.data.length === 0) {
      return {
        success: false,
        message: '未找到收藏记录'
      }
    }
    
    // 删除收藏记录
    await db.collection('user_favorite').doc(record.data[0]._id).remove()
    
    return {
      success: true,
      message: '取消收藏成功'
    }
  } catch (error) {
    console.error('取消收藏失败:', error)
    return {
      success: false,
      message: '取消收藏失败',
      error: error
    }
  }
}

/**
 * 检查是否已收藏
 * @param {string} userId - 用户ID
 * @param {string} type - 收藏类型：'article' 或 'quote'
 * @param {string} id - 收藏项目ID
 */
async function checkFavorite(userId, type, id) {
  try {
    // 查询收藏记录
    const record = await db.collection('user_favorite')
      .where({
        userId: userId,
        type: type,
        itemId: id
      })
      .get()
    
    return {
      success: true,
      isFavorite: record.data.length > 0,
      data: record.data[0] || null
    }
  } catch (error) {
    console.error('检查收藏状态失败:', error)
    return {
      success: false,
      message: '检查收藏状态失败',
      error: error,
      isFavorite: false
    }
  }
}

/**
 * 获取收藏列表
 * @param {string} userId - 用户ID
 * @param {string} type - 收藏类型：'article' 或 'quote'，可选
 */
async function listFavorites(userId, type) {
  try {
    // 构建查询条件
    const condition = { userId: userId }
    
    // 如果指定了类型，则添加类型条件
    if (type) {
      condition.type = type
    }
    
    // 查询收藏记录
    const records = await db.collection('user_favorite')
      .where(condition)
      .orderBy('createTime', 'desc')
      .get()
    
    return {
      success: true,
      data: records.data
    }
  } catch (error) {
    console.error('获取收藏列表失败:', error)
    return {
      success: false,
      message: '获取收藏列表失败',
      error: error
    }
  }
} 