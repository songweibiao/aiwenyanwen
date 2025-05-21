// 云函数：上传测试文章到云数据库
const cloud = require('wx-server-sdk')

// 初始化云
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 测试文章数据
const testArticles = [
  {
    article_id: "1A101",
    title: "咏鹅",
    author: "骆宾王",
    dynasty: "初唐",
    grade: "一年级",
    grade_id: "1A",
    lesson_number: 1,
    semester: "上学期",
    education_stage: "小学",
    full_content: "鹅，鹅，鹅，曲项向天歌。白毛浮绿水，红掌拨清波。",
    translation: "鹅啊，鹅啊，鹅啊，弯着脖子朝天歌唱。白色的羽毛漂浮在绿水上，红色的脚掌拨动着清澈的波浪。",
    sentences: [
      {
        original: "鹅，鹅，鹅，曲项向天歌。",
        translation: "鹅啊，鹅啊，鹅啊，弯着脖子朝天歌唱。"
      },
      {
        original: "白毛浮绿水，红掌拨清波。",
        translation: "白色的羽毛漂浮在绿水上，红色的脚掌拨动着清澈的波浪。"
      }
    ],
    author_intro: "骆宾王（约640年—约684年），唐代诗人，婺州义乌（今浙江义乌）人。其诗歌创作风格沉郁顿挫，笔力雄健。",
    background: "《咏鹅》是初唐诗人骆宾王七岁时所作的一首描写鹅的五言诗，此诗生动形象地描绘了鹅的外形特点和动态，语言清新明快，是一首脍炙人口的佳作。",
    words_explanation: [
      { word: "曲项", explanation: "弯着的脖子" },
      { word: "掌", explanation: "这里指鹅的脚掌" }
    ]
  },
  {
    article_id: "7101",
    title: "《论语》十二章",
    author: "孔子及其弟子",
    dynasty: "春秋",
    grade: "七年级上册",
    grade_id: "7A",
    lesson_number: 1,
    semester: "上学期",
    education_stage: "初中",
    full_content: "子曰：\"学而时习之，不亦说乎？有朋自远方来，不亦乐乎？人不知而不愠，不亦君子乎？\"",
    translation: "孔子说：\"学习知识，并且按时复习，不也是快乐的事吗？有志同道合的朋友从远方来，不也是令人高兴的事吗？别人不了解我，我却不怨恨，不也是有修养的人吗？\"",
    sentences: [
      {
        original: "子曰：\"学而时习之，不亦说乎？\"",
        translation: "孔子说：\"学习知识，并且按时复习，不也是快乐的事吗？\"",
        explanation: "这句话强调了学习和复习的重要性，以及从中获得的乐趣。"
      },
      {
        original: "有朋自远方来，不亦乐乎？",
        translation: "有志同道合的朋友从远方来，不也是令人高兴的事吗？",
        explanation: "这句话表达了孔子对朋友交往的看法，强调了友谊的珍贵。"
      },
      {
        original: "人不知而不愠，不亦君子乎？",
        translation: "别人不了解我，我却不怨恨，不也是有修养的人吗？",
        explanation: "这句话体现了孔子宽容待人的品格，以及不计较个人得失的高尚情操。"
      }
    ],
    author_intro: "孔子（前551年—前479年），名丘，字仲尼，春秋时期鲁国人，中国古代思想家、教育家、儒家学派创始人。",
    background: "《论语》是儒家学派的经典著作之一，由孔子的弟子及再传弟子编撰而成，记录了孔子及其弟子的言行，集中体现了孔子的思想。",
    words_explanation: [
      { word: "子", explanation: "老师的尊称，这里指孔子" },
      { word: "说", explanation: "通\"悦\"，愉快、高兴" },
      { word: "愠", explanation: "怨恨、生气" },
      { word: "君子", explanation: "品德高尚的人" }
    ]
  }
]

/**
 * 上传测试文章到云数据库
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  // 检查是否有命令要执行
  if (event.command === 'listCollections') {
    try {
      // 获取所有集合
      const collections = await db.collections()
      
      // 为每个集合获取文档计数
      const collectionData = []
      for (const collection of collections) {
        const name = collection.name
        const count = await db.collection(name).count()
        collectionData.push({
          name: name,
          count: count.total
        })
      }
      
      return {
        success: true,
        collections: collectionData,
        env: cloud.DYNAMIC_CURRENT_ENV
      }
    } catch (error) {
      return {
        success: false,
        error: error,
        message: '获取集合列表失败',
        env: cloud.DYNAMIC_CURRENT_ENV
      }
    }
  }
  
  // 检查是否已有文章数据
  const countResult = await db.collection('articles').count()
  
  if (countResult.total > 0) {
    // 已有文章数据，跳过上传
    return {
      success: false,
      message: '云数据库中已有文章数据，不再重复上传',
      count: countResult.total
    }
  }
  
  // 上传所有测试文章
  const uploadPromises = testArticles.map(article => {
    return db.collection('articles').add({
      data: article
    })
  })
  
  try {
    // 等待所有文章上传完成
    const results = await Promise.all(uploadPromises)
    
    return {
      success: true,
      message: '测试文章上传成功',
      results: results,
      count: results.length
    }
  } catch (error) {
    return {
      success: false,
      message: '测试文章上传失败',
      error: error
    }
  }
} 