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
    const allResults = await db.collection('xushici').limit(1000).get();
    
    if (!allResults.data || allResults.data.length === 0) {
      return { success: false, error: '数据库集合为空' };
    }
    
    // 在内存中过滤匹配的数据 - 允许多种字段名和模糊匹配
    let filteredData = allResults.data.filter(item => {
      const itemCollection = item['合集'] || item.collection || '';
      return itemCollection === category || 
            itemCollection.includes(category) || 
            category.includes(itemCollection);
      });
    
    console.log(`分类【${category}】过滤后的数据条数:`, filteredData.length);
    
    return { success: true, data: filteredData, total: filteredData.length };
  } catch (err) {
    console.error('获取分类数据出错:', err);
    return { success: false, error: err.message };
  }
}

// 辅助函数：从数组中随机获取一个元素
function getRandomItem(array) {
  if (!array || array.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
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
    } else if (type === 'getRandomWord') {
      // 获取随机词条
      if (!queryCategory) {
        return { success: false, error: '缺少分类参数' };
      }
      
      console.log('获取随机词条，分类:', queryCategory);
      
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
        
        // 随机选择一个词条
        const randomWord = getRandomItem(filteredData);
        console.log('随机选择的词条:', randomWord);
        
        // 处理词义和例句
        let explanation = '';
        let example = '';
        let exampleSource = '';
        let exampleTranslation = '';
        
        // 尝试从不同的数据结构中获取词义
        if (randomWord.pronunciations && randomWord.pronunciations.length > 0) {
          // 新数据结构
          const firstPronunciation = randomWord.pronunciations[0];
          if (firstPronunciation.usages && firstPronunciation.usages.length > 0) {
            const firstUsage = firstPronunciation.usages[0];
            explanation = firstUsage.meaning || '';
            
            if (firstUsage.examples && firstUsage.examples.length > 0) {
              const firstExample = firstUsage.examples[0];
              example = firstExample.example_sentence || '';
              exampleSource = firstExample.source || '';
              exampleTranslation = firstExample.explanation || '';
            }
          }
        } else {
          // 旧数据结构
          explanation = randomWord.explanation || randomWord.词义 || randomWord.meaning || '';
          example = randomWord.example || randomWord.例句 || '';
          exampleSource = randomWord.source || randomWord.出处 || '';
          exampleTranslation = randomWord.translation || randomWord.译文 || randomWord.例句译文 || '';
        }
        
        // 标准化词条字段，确保返回格式一致
        const normalizedWord = {
          _id: randomWord._id,
          word: randomWord.word || randomWord.例词 || '',
          pinyin: randomWord.pinyin || randomWord.拼音 || '',
          explanation: explanation,
          example: example,
          exampleSource: exampleSource,
          exampleTranslation: exampleTranslation,
          collection: randomWord.collection || randomWord.合集 || queryCategory
        };
        
        console.log('处理后的词条数据:', {
          word: normalizedWord.word,
          pinyin: normalizedWord.pinyin,
          explanation: normalizedWord.explanation,
          exampleLength: normalizedWord.example ? normalizedWord.example.length : 0,
          hasSource: !!normalizedWord.exampleSource,
          hasTranslation: !!normalizedWord.exampleTranslation
        });
        
        return {
          success: true,
          data: normalizedWord
        };
      } catch (err) {
        console.error('获取随机词条出错:', err);
        return {
          success: false,
          error: '获取随机词条出错: ' + err.message
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
        .where({ word_id: wordId })
        .get()
      return { success: true, data: result.data, total: result.data.length }
    } else if (type === 'byFuzzyId') {
      // 模糊匹配ID
      if (!wordId) {
        return { success: false, error: '缺少词条ID参数' }
      }
      
      try {
        console.log(`开始模糊匹配ID: ${wordId}`);
        
        // 获取所有数据
        const allResults = await db.collection('xushici').limit(1000).get()
        
        if (!allResults.data || allResults.data.length === 0) {
          console.log('数据库无数据');
          return { success: true, data: [] }
        }
        
        console.log(`获取到数据库记录: ${allResults.data.length}条`);
        
        // 检查第一条记录的字段
        const firstItem = allResults.data[0];
        console.log('数据库记录字段示例:', Object.keys(firstItem).join(', '));
        
        // 在内存中进行模糊匹配
        const filteredResults = allResults.data.filter(item => {
          // 检查多个可能的ID字段
          const idFields = ['word_id', '例词id', '_id', 'id', 'code', '编码', '例词'];
          
          // 检查是否有任何字段匹配
          const fieldMatch = idFields.some(field => {
            if (item[field] && typeof item[field] === 'string' && item[field].includes(wordId)) {
              console.log(`在字段 ${field} 中找到匹配: ${item[field]}`);
              return true;
            }
            return false;
          });
          
          // 如果没有字段匹配，检查所有字符串字段
          if (!fieldMatch) {
            return Object.entries(item).some(([key, value]) => {
              if (typeof value === 'string' && value.includes(wordId)) {
                console.log(`在字段 ${key} 中找到匹配: ${value}`);
                return true;
              }
              return false;
            });
          }
          
          return fieldMatch;
        });
        
        console.log(`模糊匹配ID "${wordId}" 找到 ${filteredResults.length} 条结果`);
        
        // 如果找到多个结果，优先返回ID完全匹配的
        if (filteredResults.length > 1) {
          // 检查是否有完全匹配的
          const exactMatch = filteredResults.find(item => {
            return Object.values(item).some(value => 
              typeof value === 'string' && 
              value === wordId
            );
          });
          
          if (exactMatch) {
            console.log('找到完全匹配的结果:', exactMatch);
            return { success: true, data: [exactMatch] };
          }
          
          // 如果没有完全匹配，但有多个结果，检查是否有例词字段匹配的
          const wordMatch = filteredResults.find(item => {
            const word = item.word || item['例词'] || '';
            return word === wordId;
          });
          
          if (wordMatch) {
            console.log('找到例词完全匹配的结果:', wordMatch);
            return { success: true, data: [wordMatch] };
          }
        }
        
        // 如果找到结果，记录第一条结果的详细信息
        if (filteredResults.length > 0) {
          const firstResult = filteredResults[0];
          console.log('第一条匹配结果详情:');
          console.log('- ID:', firstResult._id);
          console.log('- 例词:', firstResult.word || firstResult['例词'] || '无');
          console.log('- 词义:', firstResult.meaning || firstResult['词义'] || '无');
        }
        
        return { success: true, data: filteredResults };
      } catch (err) {
        console.error('模糊匹配ID出错:', err);
        return { success: false, error: err.message };
      }
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
          console.error('xushici集合不存在');
          return {
            success: true,
            data: categories.map(cat => ({ ...cat, count: 0 })),
            error: '数据库集合不存在'
          }
        }
        
        // 获取所有数据，确保能检索到足够的数据
        const allData = await db.collection('xushici')
          .limit(1000) // 增大获取数量上限
          .get()
        
        console.log('获取到总词条数量:', allData.data ? allData.data.length : 0);
        
        if (!allData.data || allData.data.length === 0) {
          console.error('xushici集合为空');
          return {
            success: true,
            data: categories.map(cat => ({ ...cat, count: 0 })),
            error: '数据库集合为空'
          }
        }
        
        // 检查每个项目的所有字段
        const sampleItem = allData.data[0];
        console.log('第一个项目的字段:', Object.keys(sampleItem).join(', '));
        
        // 检查每个项目中可能的"合集"字段
        console.log('检查可能的合集字段值:');
        for (const field of ['合集', 'collection', '集合', 'category']) {
          const values = allData.data
            .map(item => item[field])
            .filter(Boolean); // 过滤掉undefined和null
          if (values.length > 0) {
            console.log(`字段 '${field}' 的值示例:`, [...new Set(values.slice(0, 5))]);
          }
        }
        
        // 检查前5个项目的所有字段值
        console.log('前5个项目的详细信息:');
        for (let i = 0; i < Math.min(5, allData.data.length); i++) {
          const item = allData.data[i];
          console.log(`项目${i+1}:`, {
            id: item._id,
            word: item.例词 || item.word || '未知词',
            collection: item.合集 || item.collection || '未知合集'
          });
        }
        
        // 检查词条是否有合集字段
        const firstItem = allData.data[0];
        const hasCollection = firstItem && ('合集' in firstItem);
        if (!hasCollection) {
          console.error('词条数据缺少"合集"字段');
          console.log('词条字段:', Object.keys(firstItem));
        }
        
        // 记录所有可用的合集值
        const uniqueCollections = [...new Set(allData.data
          .map(item => item['合集'] || item.collection || '')
          .filter(Boolean))];
          
        console.log('可用的合集值:', uniqueCollections);
        
        // 在内存中计算每个分类的数量，支持合集/collection两种字段名
        const results = categories.map(category => {
          // 匹配合集字段、collection字段，允许部分匹配
          const matchedItems = allData.data.filter(item => {
            const itemCollection = item['合集'] || item.collection || '';
            return itemCollection === category.type || 
                  itemCollection.includes(category.type) || 
                  category.type.includes(itemCollection);
          });
          
          const count = matchedItems.length;
          
          // 输出前几个匹配到的项目，方便调试
          if (count > 0) {
            console.log(`匹配到${category.name}的项目示例:`, 
              matchedItems.slice(0, 3).map(item => ({
                id: item._id, 
                word: item.例词 || item.word || '未知词',
                collection: item['合集'] || item.collection || '未知合集'
              }))
            );
          }
          
          console.log(`分类"${category.name}"的词条数量: ${count}`);
          
          return { 
            name: category.name, 
            type: category.type, 
            count: count 
          }
        });
        
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
      // 支持合集和collection两个字段名
      console.log('获取分类词条:', queryCategory);
      
      try {
        // 获取所有数据
        const allResults = await db.collection('xushici').limit(1000).get();
      if (!allResults.data || allResults.data.length === 0) {
          console.log('数据库无数据');
        return { success: true, data: [] };
      }
        
        console.log('数据库总词条数:', allResults.data.length);
        
        // 根据合集或collection字段过滤
        const filteredResults = allResults.data.filter(item => {
          const itemCollection = item['合集'] || item.collection || '';
          return itemCollection === queryCategory || 
                itemCollection.includes(queryCategory) || 
                queryCategory.includes(itemCollection);
        });
        
        console.log('符合条件的词条数:', filteredResults.length);
        return { success: true, data: filteredResults };
      } catch (err) {
        console.error('获取分类词条出错:', err);
        return { success: false, error: err.message };
      }
    } else {
      return { success: false, error: '未知的查询类型' }
    }
  } catch (err) {
    console.error('查询xushici集合出错:', err)
    return { success: false, error: err.message }
  }
}