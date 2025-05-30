// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 名句数据
    const famousQuotes = [
      {
        content: '欲穷千里目，更上一层楼。',
        source: '登鹳雀楼',
        author: '王之涣',
        dynasty: '唐',
        translation: '如果想要看到更远的地方，那就要登上更高的楼层。'
      },
      {
        content: '会当凌绝顶，一览众山小。',
        source: '望岳',
        author: '杜甫',
        dynasty: '唐',
        translation: '我一定要登上泰山的顶峰，俯瞰群山的渺小。'
      },
      {
        content: '人生自古谁无死，留取丹心照汗青。',
        source: '过零丁洋',
        author: '文天祥',
        dynasty: '宋',
        translation: '自古以来谁能够免于一死，只愿留下赤诚的忠心照耀青史。'
      },
      {
        content: '海内存知己，天涯若比邻。',
        source: '送杜少府之任蜀州',
        author: '王勃',
        dynasty: '唐',
        translation: '在世界上有知己的人，即使相隔天涯海角也如近在咫尺。'
      },
      {
        content: '落霞与孤鹜齐飞，秋水共长天一色。',
        source: '滕王阁序',
        author: '王勃',
        dynasty: '唐',
        translation: '晚霞和孤独的野鸭一起飞翔，秋天的江水与蓝天连成一片颜色。'
      },
      {
        content: '采菊东篱下，悠然见南山。',
        source: '饮酒',
        author: '陶渊明',
        dynasty: '晋',
        translation: '在东篱下采摘菊花，悠闲地望见远处的南山。'
      },
      {
        content: '春风又绿江南岸，明月何时照我还。',
        source: '泊船瓜洲',
        author: '王安石',
        dynasty: '宋',
        translation: '春风吹绿了江南的岸边，不知何时明月才能照着我回家。'
      },
      {
        content: '千里之行，始于足下。',
        source: '道德经',
        author: '老子',
        dynasty: '春秋',
        translation: '千里的旅程，是从脚下第一步开始的。'
      },
      {
        content: '路漫漫其修远兮，吾将上下而求索。',
        source: '离骚',
        author: '屈原',
        dynasty: '战国',
        translation: '道路漫长而遥远，我将上下求索。'
      },
      {
        content: '少壮不努力，老大徒伤悲。',
        source: '长歌行',
        author: '汉乐府',
        dynasty: '汉',
        translation: '年轻时不努力，到老了只能徒增悲伤。'
      },
      {
        content: '天生我材必有用，千金散尽还复来。',
        source: '将进酒',
        author: '李白',
        dynasty: '唐',
        translation: '上天赋予我才能必定有用处，千金散尽也会再次回来。'
      },
      {
        content: '桃花潭水深千尺，不及汪伦送我情。',
        source: '赠汪伦',
        author: '李白',
        dynasty: '唐',
        translation: '桃花潭水深达千尺，也比不上汪伦送别我的情谊。'
      },
      {
        content: '问渠那得清如许，为有源头活水来。',
        source: '观书有感',
        author: '朱熹',
        dynasty: '宋',
        translation: '询问这池水为何如此清澈，是因为有源头活水不断流入。'
      },
      {
        content: '不识庐山真面目，只缘身在此山中。',
        source: '题西林壁',
        author: '苏轼',
        dynasty: '宋',
        translation: '无法认识庐山的真实面目，只因为自己身处庐山之中。'
      },
      {
        content: '无边落木萧萧下，不尽长江滚滚来。',
        source: '登高',
        author: '杜甫',
        dynasty: '唐',
        translation: '无边无际的落叶萧萧而下，滚滚不尽的长江水滔滔而来。'
      },
      {
        content: '山重水复疑无路，柳暗花明又一村。',
        source: '游山西村',
        author: '陆游',
        dynasty: '宋',
        translation: '山峦重叠溪水弯曲疑似没有道路，柳树浓密鲜花盛开眼前又是一个村庄。'
      },
      {
        content: '莫愁前路无知己，天下谁人不识君。',
        source: '别董大',
        author: '高适',
        dynasty: '唐',
        translation: '不要担心前方没有知己，天下谁人不认识你呢？'
      },
      {
        content: '读书破万卷，下笔如有神。',
        source: '奉赠韦左丞丈二十二韵',
        author: '杜甫',
        dynasty: '唐',
        translation: '读书破万卷，下笔如有神助。'
      },
      {
        content: '学而不思则罔，思而不学则殆。',
        source: '论语',
        author: '孔子',
        dynasty: '春秋',
        translation: '只学习不思考就会迷惑，只思考不学习就会疑惑。'
      },
      {
        content: '己所不欲，勿施于人。',
        source: '论语',
        author: '孔子',
        dynasty: '春秋',
        translation: '自己不想要的，不要强加给别人。'
      },
      {
        content: '人不知而不愠，不亦君子乎？',
        source: '论语',
        author: '孔子',
        dynasty: '春秋',
        translation: '别人不了解自己却不恼怒，不也是君子吗？'
      },
      {
        content: '三人行，必有我师焉。',
        source: '论语',
        author: '孔子',
        dynasty: '春秋',
        translation: '三个人一起走，其中必有可以做我老师的人。'
      },
      {
        content: '知之为知之，不知为不知，是知也。',
        source: '论语',
        author: '孔子',
        dynasty: '春秋',
        translation: '知道就是知道，不知道就是不知道，这才是真正的知识。'
      },
      {
        content: '老骥伏枥，志在千里；烈士暮年，壮心不已。',
        source: '龟虽寿',
        author: '曹操',
        dynasty: '汉',
        translation: '老马伏在马槽旁，志向仍在千里之外；壮士到了晚年，雄心壮志仍未停止。'
      },
      {
        content: '宁为玉碎，不为瓦全。',
        source: '北齐书',
        author: '李百药',
        dynasty: '唐',
        translation: '宁愿像玉一样碎掉，也不要像瓦一样完好无损。'
      },
      {
        content: '不以物喜，不以己悲。',
        source: '岳阳楼记',
        author: '范仲淹',
        dynasty: '宋',
        translation: '不因外物而喜悦，不因自己而悲伤。'
      },
      {
        content: '先天下之忧而忧，后天下之乐而乐。',
        source: '岳阳楼记',
        author: '范仲淹',
        dynasty: '宋',
        translation: '在天下人忧虑之前忧虑，在天下人欢乐之后欢乐。'
      },
      {
        content: '粉身碎骨浑不怕，要留清白在人间。',
        source: '满江红',
        author: '岳飞',
        dynasty: '宋',
        translation: '粉身碎骨也不怕，只求在人间留下清白的名声。'
      },
      {
        content: '但愿人长久，千里共婵娟。',
        source: '水调歌头',
        author: '苏轼',
        dynasty: '宋',
        translation: '只希望人长久，即使相隔千里也能共赏这美丽的月亮。'
      },
      {
        content: '明月几时有，把酒问青天。',
        source: '水调歌头',
        author: '苏轼',
        dynasty: '宋',
        translation: '明月何时出现的，我拿着酒杯问苍天。'
      },
      {
        content: '人有悲欢离合，月有阴晴圆缺，此事古难全。',
        source: '水调歌头',
        author: '苏轼',
        dynasty: '宋',
        translation: '人有悲欢离合，月有阴晴圆缺，这种事自古以来就难以圆满。'
      },
      {
        content: '大江东去，浪淘尽，千古风流人物。',
        source: '念奴娇·赤壁怀古',
        author: '苏轼',
        dynasty: '宋',
        translation: '长江向东流去，浪花淘尽了千古以来的风流人物。'
      },
      {
        content: '长风破浪会有时，直挂云帆济沧海。',
        source: '行路难',
        author: '李白',
        dynasty: '唐',
        translation: '乘长风破万里浪的时候终会到来，我将高高挂起云帆，横渡沧海。'
      },
      {
        content: '仰天大笑出门去，我辈岂是蓬蒿人。',
        source: '南山诗',
        author: '李白',
        dynasty: '唐',
        translation: '仰天大笑着走出门去，我们这些人怎会是平凡之辈。'
      },
      {
        content: '生当作人杰，死亦为鬼雄。',
        source: '夏日绝句',
        author: '李清照',
        dynasty: '宋',
        translation: '活着要做人中豪杰，死了也要做鬼中英雄。'
      },
      {
        content: '衣带渐宽终不悔，为伊消得人憔悴。',
        source: '蝶恋花',
        author: '柳永',
        dynasty: '宋',
        translation: '衣带渐渐宽松也不后悔，为了她消瘦憔悴也甘愿。'
      },
      {
        content: '醉卧沙场君莫笑，古来征战几人回？',
        source: '凉州词',
        author: '王翰',
        dynasty: '唐',
        translation: '醉卧在沙场上请不要笑话我，自古以来征战有多少人能够回来？'
      },
      {
        content: '十年磨一剑，霜刃未曾试。',
        source: '贺兰进明',
        author: '贾岛',
        dynasty: '唐',
        translation: '十年时间磨一把剑，这锋利的剑刃还未曾试过。'
      },
      {
        content: '青山遮不住，毕竟东流去。',
        source: '观书有感',
        author: '朱熹',
        dynasty: '宋',
        translation: '青山遮不住流水，它毕竟要向东流去。'
      },
      {
        content: '一寸光阴一寸金，寸金难买寸光阴。',
        source: '格言联璧',
        author: '佚名',
        dynasty: '明',
        translation: '一寸时光价值连城，黄金难以买回逝去的时光。'
      },
      {
        content: '天下兴亡，匹夫有责。',
        source: '日知录',
        author: '顾炎武',
        dynasty: '清',
        translation: '国家的兴盛与衰亡，普通人也有责任。'
      },
      {
        content: '问君能有几多愁，恰似一江春水向东流。',
        source: '虞美人',
        author: '李煜',
        dynasty: '五代',
        translation: '问你能有多少愁苦，就像一江春水向东流去。'
      },
      {
        content: '剑外忽传收蓟北，初闻涕泪满衣裳。',
        source: '闻官军收河南河北',
        author: '杜甫',
        dynasty: '唐',
        translation: '剑门关外忽然传来收复蓟北的消息，初次听到这个消息时泪水沾满了衣裳。'
      },
      {
        content: '莫道桑榆晚，为霞尚满天。',
        source: '自嘲',
        author: '龚自珍',
        dynasty: '清',
        translation: '不要说日薄西山时光已晚，晚霞仍然满天。'
      },
      {
        content: '天生我材必有用，千金散尽还复来。',
        source: '将进酒',
        author: '李白',
        dynasty: '唐',
        translation: '上天赋予我才能必定有用处，千金散尽也会再次回来。'
      },
      {
        content: '落红不是无情物，化作春泥更护花。',
        source: '己亥杂诗',
        author: '龚自珍',
        dynasty: '清',
        translation: '落下的花朵不是无情之物，化作春泥更能滋养新花。'
      },
      {
        content: '人生得意须尽欢，莫使金樽空对月。',
        source: '将进酒',
        author: '李白',
        dynasty: '唐',
        translation: '人生得意之时应当尽情欢乐，不要让金杯空对明月。'
      },
      {
        content: '安得广厦千万间，大庇天下寒士俱欢颜。',
        source: '茅屋为秋风所破歌',
        author: '杜甫',
        dynasty: '唐',
        translation: '怎样才能建造千万间宽敞房屋，让天下贫寒之人都能露出笑脸。'
      },
      {
        content: '采菊东篱下，悠然见南山。',
        source: '饮酒',
        author: '陶渊明',
        dynasty: '晋',
        translation: '在东篱下采摘菊花，悠闲地望见远处的南山。'
      }
    ];

    // 检查是否已存在名句集合
    const checkCollection = await db.collection('famous_quotes').count();
    
    if (checkCollection.total > 0) {
      // 如果集合已存在且有数据，则先清空
      const oldQuotes = await db.collection('famous_quotes').limit(100).get();
      const deletePromises = oldQuotes.data.map(quote => {
        return db.collection('famous_quotes').doc(quote._id).remove();
      });
      await Promise.all(deletePromises);
    }

    // 批量添加名句数据
    const batchTimes = Math.ceil(famousQuotes.length / 100);
    const tasks = [];
    
    for (let i = 0; i < batchTimes; i++) {
      const start = i * 100;
      const end = Math.min((i + 1) * 100, famousQuotes.length);
      const batch = famousQuotes.slice(start, end);
      
      const task = db.collection('famous_quotes').add({
        data: batch.map(quote => ({
          ...quote,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }))
      });
      
      tasks.push(task);
    }
    
    await Promise.all(tasks);
    
    return {
      success: true,
      message: `成功生成${famousQuotes.length}条名句数据`,
      count: famousQuotes.length
    };
  } catch (error) {
    console.error('生成名句数据失败:', error);
    return {
      success: false,
      message: '生成名句数据失败',
      error: error
    };
  }
} 