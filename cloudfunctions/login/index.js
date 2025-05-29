// 云函数模板
// 部署：在 cloud-functions/login 文件夹右击选择 "上传并部署"

const cloud = require('wx-server-sdk')

// 初始化 cloud
cloud.init({
  // API 调用都保持和云函数当前所在环境一致
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const userCollection = db.collection('user')

// 随机昵称生成函数
function generateRandomNickname() {
  // 生成4位随机数字
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 确保是4位数字
  
  // 返回"书生+4位数字"格式的昵称
  return `书生${randomNum}`;
}

/**
 * 获取用户openid及用户信息，处理用户注册和登录
 * @param event 
 * @param context 
 */
exports.main = async (event, context) => {
  // 获取 WX Context (微信调用上下文)，包括 OPENID、APPID、及 UNIONID（需满足 UNIONID 获取条件）等信息
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 根据操作类型处理不同的逻辑
  const { action, userData } = event
  
  // 基础返回数据
  const baseResult = {
    openid: openid,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    env: cloud.DYNAMIC_CURRENT_ENV,
  }
  
  try {
    // 查询用户是否已注册
    if (action === 'check') {
      const user = await userCollection.where({
        openid: openid
      }).get()
      
      if (user.data.length > 0) {
        // 已注册，返回用户信息
        console.log('用户已存在:', user.data[0])
        return {
          ...baseResult,
          isRegistered: true,
          userData: user.data[0]
        }
      } else {
        // 未注册，自动注册
        const nickname = generateRandomNickname();
        const avatarUrl = userData && userData.avatarUrl ? userData.avatarUrl : '';
        
        console.log('创建新用户, 头像:', avatarUrl)
        
        const userInfo = {
          openid: openid,
          nickname: nickname,
          avatarUrl: avatarUrl,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
        
        const result = await userCollection.add({
          data: userInfo
        })
        
        // 查询新创建的用户完整信息
        const newUser = await userCollection.doc(result._id).get()
        console.log('新用户创建成功:', newUser.data)
        
        return {
          ...baseResult,
          isRegistered: true,
          userData: newUser.data
        }
      }
    }
    
    // 更新用户昵称
    else if (action === 'updateNickname') {
      if (!userData || !userData.nickname) {
        return {
          ...baseResult,
          success: false,
          error: '昵称不能为空'
        }
      }
      
      const result = await userCollection.where({
        openid: openid
      }).update({
        data: {
          nickname: userData.nickname,
          updatedAt: db.serverDate()
        }
      })
      
      // 获取更新后的用户信息
      const updatedUser = await userCollection.where({
        openid: openid
      }).get()
      
      return {
        ...baseResult,
        success: result.stats.updated > 0,
        userData: updatedUser.data.length > 0 ? updatedUser.data[0] : null
      }
    }
    
    // 更新用户信息（如头像）
    else if (action === 'update') {
      const updateData = {
        ...userData,
        updatedAt: db.serverDate()
      }
      
      const result = await userCollection.where({
        openid: openid
      }).update({
        data: updateData
      })
      
      // 获取更新后的用户信息
      const updatedUser = await userCollection.where({
        openid: openid
      }).get()
      
      return {
        ...baseResult,
        success: result.stats.updated > 0,
        userData: updatedUser.data.length > 0 ? updatedUser.data[0] : null
      }
    }
    
    // 登出操作（前端清除缓存即可，这里仅作记录）
    else if (action === 'logout') {
      return {
        ...baseResult,
        success: true,
        message: '登出成功'
      }
    }
    
    // 默认返回用户信息
    else {
      const user = await userCollection.where({
        openid: openid
      }).get()
      
      return {
        ...baseResult,
        userData: user.data.length > 0 ? user.data[0] : null
      }
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      ...baseResult,
      success: false,
      error: error.message
    }
  }
} 