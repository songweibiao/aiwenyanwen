// 查询云数据库articles表的工具脚本
const cloud = require('wx-server-sdk');

// 初始化云环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 获取数据库引用
const db = cloud.database();

// 查询数据
exports.main = async (event, context) => {
  try {
    // 获取articles表中的所有数据，只返回必要字段
    const articlesData = await db.collection('articles')
      .field({
        _id: true,
        title: true,
        author: true,
        dynasty: true,
        grade: true,
        semester: true,
        grade_id: true,
        lesson_number: true
      })
      .limit(100) // 限制返回100条记录
      .get();
    
    // 打印数据统计信息
    console.log(`查询到${articlesData.data.length}条数据`);
    
    // 分析年级和学期的组合情况
    const gradeSemesterMap = new Map();
    articlesData.data.forEach(item => {
      if (item.grade && item.semester) {
        const key = `${item.grade}_${item.semester}`;
        if (!gradeSemesterMap.has(key)) {
          gradeSemesterMap.set(key, {
            grade: item.grade,
            semester: item.semester,
            count: 1
          });
        } else {
          const record = gradeSemesterMap.get(key);
          record.count++;
          gradeSemesterMap.set(key, record);
        }
      }
    });
    
    // 输出年级和学期的组合统计
    console.log('年级和学期组合统计:');
    gradeSemesterMap.forEach(item => {
      console.log(`${item.grade} ${item.semester}: ${item.count}条`);
    });
    
    // 返回数据
    return {
      success: true,
      data: articlesData.data,
      gradeSemesterStats: Array.from(gradeSemesterMap.values())
    };
  } catch (error) {
    console.error('查询失败:', error);
    return {
      success: false,
      error
    };
  }
}; 