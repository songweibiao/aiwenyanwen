/**
 * 网络请求封装
 */

const request = {
  /**
   * 调用云函数
   * @param {String} name 云函数名称
   * @param {Object} data 请求参数
   */
  cloud: (name, data = {}) => {
    wx.showLoading({
      title: '加载中',
      mask: true
    })
    
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        success: res => {
          wx.hideLoading()
          resolve(res.result)
        },
        fail: err => {
          wx.hideLoading()
          wx.showToast({
            title: '请求失败',
            icon: 'none'
          })
          console.error(`[云函数] [${name}] 调用失败`, err)
          reject(err)
        }
      })
    })
  },
  
  /**
   * 云数据库操作
   */
  db: {
    /**
     * 获取数据库实例
     */
    getDB: () => {
      return wx.cloud.database()
    },
    
    /**
     * 添加数据
     * @param {String} collection 集合名称
     * @param {Object} data 数据
     */
    add: (collection, data = {}) => {
      return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        db.collection(collection).add({
          data,
          success: res => {
            resolve(res)
          },
          fail: err => {
            console.error(`[数据库] [${collection}] [add] 操作失败`, err)
            reject(err)
          }
        })
      })
    },
    
    /**
     * 查询数据列表
     * @param {String} collection 集合名称
     * @param {Object} where 查询条件
     * @param {Number} limit 限制条数
     * @param {Number} skip 跳过条数
     * @param {Object} orderBy 排序条件 {field: 'desc'/'asc'}
     */
    getList: (collection, { where = {}, limit = 20, skip = 0, orderBy = {} } = {}) => {
      return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        let query = db.collection(collection).where(where)
        
        // 处理排序
        if (orderBy && Object.keys(orderBy).length > 0) {
          const field = Object.keys(orderBy)[0]
          const order = orderBy[field]
          query = query.orderBy(field, order)
        }
        
        // 处理分页
        query = query.skip(skip).limit(limit)
        
        query.get({
          success: res => {
            resolve(res)
          },
          fail: err => {
            console.error(`[数据库] [${collection}] [getList] 查询失败`, err)
            reject(err)
          }
        })
      })
    },
    
    /**
     * 查询单条数据
     * @param {String} collection 集合名称
     * @param {String|Object} condition id或条件
     */
    getOne: (collection, condition) => {
      return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        
        // 如果是字符串，则按id查询
        if (typeof condition === 'string') {
          db.collection(collection).doc(condition).get({
            success: res => {
              resolve(res)
            },
            fail: err => {
              console.error(`[数据库] [${collection}] [getOne] 查询失败`, err)
              reject(err)
            }
          })
        } else {
          // 否则按条件查询
          db.collection(collection).where(condition).get({
            success: res => {
              resolve({
                data: res.data.length > 0 ? res.data[0] : null
              })
            },
            fail: err => {
              console.error(`[数据库] [${collection}] [getOne] 查询失败`, err)
              reject(err)
            }
          })
        }
      })
    },
    
    /**
     * 更新数据
     * @param {String} collection 集合名称
     * @param {String} id 文档ID
     * @param {Object} data 更新数据
     */
    update: (collection, id, data) => {
      return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        db.collection(collection).doc(id).update({
          data,
          success: res => {
            resolve(res)
          },
          fail: err => {
            console.error(`[数据库] [${collection}] [update] 更新失败`, err)
            reject(err)
          }
        })
      })
    },
    
    /**
     * 删除数据
     * @param {String} collection 集合名称
     * @param {String} id 文档ID
     */
    remove: (collection, id) => {
      return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        db.collection(collection).doc(id).remove({
          success: res => {
            resolve(res)
          },
          fail: err => {
            console.error(`[数据库] [${collection}] [remove] 删除失败`, err)
            reject(err)
          }
        })
      })
    },
    
    /**
     * 统计数量
     * @param {String} collection 集合名称
     * @param {Object} where 查询条件
     */
    count: (collection, where = {}) => {
      return new Promise((resolve, reject) => {
        const db = wx.cloud.database()
        db.collection(collection).where(where).count({
          success: res => {
            resolve(res)
          },
          fail: err => {
            console.error(`[数据库] [${collection}] [count] 统计失败`, err)
            reject(err)
          }
        })
      })
    }
  }
}

module.exports = request 