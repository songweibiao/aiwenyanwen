// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 辅助函数：尝试解码URL编码的字符串
function tryDecode(str) {
  if (!str) return str;
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

// 辅助函数：获取指定分类的所有数据
async function getCategoryData(category) {
  try {
    // 获取所有数据，然后在内存中过滤 - 这种方式更可靠
    const allResults = await db.collection('xushici').limit(100).get();
    
    if (!allResults.data || allResults.data.length === 0) {
      return { success: false, error: '数据库集合为空' };
    }
    
    // 在内存中过滤匹配的数据 - 精确匹配
    let filteredData = allResults.data.filter(item => {
      if (!item.合集) return false;
      return item.合集 === category;
    });
    
    // 如果精确匹配没有结果，尝试模糊匹配
    if (filteredData.length === 0) {
      console.log('精确匹配无结果，尝试模糊匹配');
      filteredData = allResults.data.filter(item => {
        if (!item.合集) return false;
        return item.合集.includes(category) || category.includes(item.合集);
      });
    }
    
    return { success: true, data: filteredData };
  } catch (err) {
    console.error('获取分类数据出错:', err);
    return { success: false, error: err.message };
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { type, category, examType, limit = 20, offset = 0, wordId, index } = event
  
  console.log('云函数收到参数:', event)

  try {
    // 解码分类参数
    let queryCategory = category || examType;
    queryCategory = tryDecode(queryCategory);
    
    if (type === 'getCategoryInfo') {
      // 获取分类信息和第一条数据
      if (!queryCategory) {
        return { success: false, error: '缺少分类参数' };
      }
      
      console.log('获取分类信息:', queryCategory);
      
      try {
        // 获取该分类的所有数据
        const result = await getCategoryData(queryCategory);
        
        if (!result.success) {
          return result;
        }
        
        const filteredData = result.data;
        console.log('过滤后的数据条数:', filteredData.length);
        
        if (filteredData.length === 0) {
          return {
            success: false,
            error: '未找到匹配的数据',
            total: 0
          };
        }
        
        // 返回总数量和第一条数据
        return {
          success: true,
          total: filteredData.length,
          firstItem: filteredData[0]
        };
      } catch (err) {
        console.error('获取分类信息出错:', err);
        return {
          success: false,
          error: '获取分类信息出错: ' + err.message
        };
      }
    } else if (type === 'byIndex') {
      // 按索引获取词条
      if (!queryCategory) {
        return { success: false, error: '缺少分类参数' };
      }
      
      if (index === undefined || index < 0) {
        return { success: false, error: '无效的索引值' };
      }
      
      console.log(`获取分类 ${queryCategory} 中索引为 ${index} 的词条`);
      
      try {
        // 获取该分类的所有数据
        const result = await getCategoryData(queryCategory);
        
        if (!result.success) {
          return result;
        }
        
        const filteredData = result.data;
        
        if (index >= filteredData.length) {
          return {
            success: false,
            error: '索引超出范围',
            total: filteredData.length
          };
        }
        
        // 返回指定索引的数据
        return {
          success: true,
          data: filteredData[index],
          total: filteredData.length
        };
      } catch (err) {
        console.error('按索引获取词条出错:', err);
        return {
          success: false,
          error: '按索引获取词条出错: ' + err.message
        };
      }
    } else if (type === 'byCategory') {
      // 按分类获取词条
      if (!queryCategory) {
        return { success: false, error: '缺少分类参数' }
      }
      
      // 打印查询条件
      console.log('查询条件:', { 合集: queryCategory })
      
      try {
        // 先检查集合是否存在
        const collections = await db.listCollections().get()
        const collectionNames = collections.data.map(col => col.name)
        
        if (!collectionNames.includes('xushici')) {
          return {
            success: false,
            error: '数据库集合不存在',
            debug: { 
              collections: collectionNames,
              queryCategory 
            }
          }
        }
        
        // 获取所有数据，然后在内存中过滤 - 这种方式更可靠
        const allResults = await db.collection('xushici').limit(100).get()
        
        if (!allResults.data || allResults.data.length === 0) {
          return {
            success: false,
            error: '数据库集合为空',
            debug: { queryCategory }
          }
        }
        
        console.log('获取到的总数据条数:', allResults.data.length)
        
        // 检查字段
        const sampleDoc = allResults.data[0]
        console.log('样本数据字段:', Object.keys(sampleDoc).join(', '))
        
        // 检查是否有合集字段
        if (!sampleDoc.hasOwnProperty('合集')) {
          console.error('数据库中缺少"合集"字段')
          return { 
            success: false, 
            error: '数据结构不匹配，缺少"合集"字段',
            sampleFields: Object.keys(sampleDoc)
          }
        }
        
        // 在内存中过滤匹配的数据 - 精确匹配
        let filteredData = allResults.data.filter(item => {
          if (!item.合集) return false
          return item.合集 === queryCategory
        })
        
        // 如果精确匹配没有结果，尝试模糊匹配
        if (filteredData.length === 0) {
          console.log('精确匹配无结果，尝试模糊匹配')
          filteredData = allResults.data.filter(item => {
            if (!item.合集) return false
            return item.合集.includes(queryCategory) || queryCategory.includes(item.合集)
          })
        }
        
        console.log('过滤后的数据条数:', filteredData.length)
        
        if (filteredData.length === 0) {
          // 记录所有不同的合集值，帮助调试
          const uniqueCollections = [...new Set(allResults.data.map(item => item.合集).filter(Boolean))]
          console.log('数据库中的合集值:', uniqueCollections)
          
          return {
            success: false,
            error: '未找到匹配的数据',
            debug: {
              queryCategory,
              availableCollections: uniqueCollections
            }
          }
        }
        
        // 分页处理
        const paginatedData = filteredData.slice(offset, offset + limit)
        
        return { 
          success: true, 
          data: paginatedData, 
          total: filteredData.length,
          debug: {
            queryCategory,
            resultLength: paginatedData.length,
            totalMatched: filteredData.length
          }
        }
      } catch (dbError) {
        console.error('数据库查询出错:', dbError)
        return {
          success: false,
          error: '数据库查询出错: ' + dbError.message,
          debug: { queryCategory }
        }
      }
    } else if (type === 'byWordId') {
      // 按词条ID获取
      const result = await db.collection('xushici')
        .where({ 例词id: wordId })
        .get()
      return { success: true, data: result.data, total: result.data.length }
    } else if (type === 'categories') {
      // 获取所有分类及数量
      const categories = [
        { name: '高考实词', type: '高考实词合集' },
        { name: '高考虚词', type: '高考虚词合集' },
        { name: '中考实词', type: '中考实词合集' },
        { name: '中考虚词', type: '中考虚词合集' }
      ]
      
      try {
        // 检查集合是否存在
        const collections = await db.listCollections().get()
        if (!collections.data.some(col => col.name === 'xushici')) {
          return {
            success: true,
            data: categories.map(cat => ({ ...cat, count: 0 })),
            error: '数据库集合不存在'
          }
        }
        
        // 获取所有数据
        const allData = await db.collection('xushici').get()
        if (!allData.data || allData.data.length === 0) {
          return {
            success: true,
            data: categories.map(cat => ({ ...cat, count: 0 })),
            error: '数据库集合为空'
          }
        }
        
        // 在内存中计算每个分类的数量
        const results = categories.map(category => {
          const count = allData.data.filter(item => 
            item.合集 === category.type
          ).length
          
          return { 
            name: category.name, 
            type: category.type, 
            count: count 
          }
        })
        
        return { success: true, data: results }
      } catch (err) {
        console.error('获取分类数据出错:', err)
        // 返回默认分类数据，避免首页崩溃
        return {
          success: true,
          data: categories.map(cat => ({ ...cat, count: 0 })),
          error: '获取分类数据出错: ' + err.message
        }
      }
    } else if (type === 'test') {
      // 测试查询，返回前10条数据
      const result = await db.collection('xushici')
        .limit(10)
        .get()
      return { success: true, data: result.data, total: result.data.length }
    } else if (type === 'groupByWordId') {
      if (!queryCategory) {
        return { success: false, error: '缺少分类参数' };
      }
      // 直接返回所有符合条件的词条（每个词条就是唯一 word_id）
      const allResults = await db.collection('xushici').where({ collection: queryCategory }).limit(500).get();
      if (!allResults.data || allResults.data.length === 0) {
        return { success: true, data: [] };
      }
      return { success: true, data: allResults.data };
    } else {
      return { success: false, error: '未知的查询类型' }
    }
  } catch (err) {
    console.error('查询xushici集合出错:', err)
    return { success: false, error: err.message }
  }
}