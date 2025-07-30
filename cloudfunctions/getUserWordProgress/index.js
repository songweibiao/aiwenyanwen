// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  const { userId, collection } = event;
  if (!userId) {
    return { success: false, error: '缺少 userId' };
  }

  let matchStage = { userId };
  if (collection) {
    matchStage.collection = collection;
  }

  try {
    const res = await db.collection('user_word_progress')
      .aggregate()
      .match(matchStage)
      .sort({
        updateTime: -1 // 按更新时间降序排序
      })
      .lookup({
        from: 'xushici',
        localField: 'wordId',
        foreignField: 'word_id',
        as: 'wordInfo'
      })
      .end();

    const data = res.list.map(item => {
      if (item.wordInfo && item.wordInfo.length > 0) {
        item.word = item.wordInfo[0].word;
        item.pinyin = item.wordInfo[0].pronunciation;
        delete item.wordInfo; // 清理冗余数据
      } else {
        item.word = '未知词语';
        item.pinyin = '';
      }
      return item;
    });

    return { success: true, data: data };
  } catch (e) {
    console.error(e);
    return { success: false, error: e.message };
  }
}