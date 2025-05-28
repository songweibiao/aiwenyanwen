/**
 * 通用工具函数
 */

/**
 * 格式化时间
 * @param {Date} date 日期对象
 * @param {String} format 格式化模式 'YYYY-MM-DD HH:mm:ss'
 * @returns {String} 格式化后的时间字符串
 */
const formatTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return ''
  
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  const formatNumber = n => {
    n = n.toString()
    return n[1] ? n : `0${n}`
  }
  
  const obj = {
    'YYYY': year,
    'MM': formatNumber(month),
    'DD': formatNumber(day),
    'HH': formatNumber(hour),
    'mm': formatNumber(minute),
    'ss': formatNumber(second)
  }
  
  return format.replace(/(YYYY|MM|DD|HH|mm|ss)/g, (key) => obj[key])
}

/**
 * 根据时间段返回问候语
 * @returns {String} 问候语
 */
const getGreeting = () => {
  const hour = new Date().getHours()
  
  if (hour >= 0 && hour < 5) {
    return '夜深了'
  } else if (hour >= 5 && hour < 12) {
    return '早上好'
  } else if (hour >= 12 && hour < 14) {
    return '中午好'
  } else if (hour >= 14 && hour < 18) {
    return '下午好'
  } else {
    return '晚上好'
  }
}

/**
 * 生成随机字符串
 * @param {Number} length 字符串长度
 * @returns {String} 随机字符串
 */
const randomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 计算距离现在的时间
 * @param {Date|String} dateTime 
 * @returns {String} 时间描述
 */
const timeAgo = (dateTime) => {
  if (!dateTime) return ''
  
  // 如果是字符串，则转为日期对象
  const time = typeof dateTime === 'string' ? new Date(dateTime) : dateTime
  const now = new Date()
  const diff = now.getTime() - time.getTime()
  
  const minute = 1000 * 60
  const hour = minute * 60
  const day = hour * 24
  const month = day * 30
  const year = day * 365
  
  if (diff < minute) {
    return '刚刚'
  } else if (diff < hour) {
    return Math.floor(diff / minute) + '分钟前'
  } else if (diff < day) {
    return Math.floor(diff / hour) + '小时前'
  } else if (diff < month) {
    return Math.floor(diff / day) + '天前'
  } else if (diff < year) {
    return Math.floor(diff / month) + '个月前'
  } else {
    return Math.floor(diff / year) + '年前'
  }
}

/**
 * 深度克隆对象
 * @param {Object} obj 
 * @returns {Object} 克隆后的对象
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj
  
  const clone = Array.isArray(obj) ? [] : {}
  
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone(obj[key])
    }
  }
  
  return clone
}

/**
 * 截断文本
 * @param {String} str 文本
 * @param {Number} length 截断长度
 * @param {String} suffix 后缀
 * @returns {String} 截断后的文本
 */
const truncateText = (str, length = 30, suffix = '...') => {
  if (!str) return ''
  return str.length > length ? str.substring(0, length) + suffix : str
}

/**
 * 计算学习进度百分比
 * @param {Number} completed 已完成部分
 * @param {Number} total 总数
 * @returns {Number} 百分比
 */
const calculateProgress = (completed, total) => {
  if (!completed || !total) return 0
  const percentage = Math.floor((completed / total) * 100)
  return percentage > 100 ? 100 : percentage
}

/**
 * 格式化音频时间（秒转mm:ss）
 * @param {Number} seconds 秒数
 * @returns {String} 格式化后的时间字符串
 */
const formatAudioTime = (seconds) => {
  seconds = Math.floor(seconds || 0);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

module.exports = {
  formatTime,
  getGreeting,
  randomString,
  timeAgo,
  deepClone,
  truncateText,
  calculateProgress,
  formatAudioTime
} 