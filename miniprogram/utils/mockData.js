// 模拟数据文件，用于产品开发阶段

// 课文列表模拟数据
const articleList = {
  // 初中部分
  junior: [
    {
      grade: '七年级上册',
      list: [
        { id: '7101', title: '《论语》十二章', author: '孔子及其弟子', dynasty: '春秋', difficulty: 3 },
        { id: '7102', title: '《孟子》两章', author: '孟子及其弟子', dynasty: '战国', difficulty: 3 },
        { id: '7103', title: '世说新语两则', author: '刘义庆', dynasty: '南北朝', difficulty: 2 },
        { id: '7104', title: '陋室铭', author: '刘禹锡', dynasty: '唐代', difficulty: 2 },
        { id: '7105', title: '爱莲说', author: '周敦颐', dynasty: '宋代', difficulty: 3 }
      ]
    },
    {
      grade: '七年级下册',
      list: [
        { id: '7201', title: '《论语》四章', author: '孔子及其弟子', dynasty: '春秋', difficulty: 3 },
        { id: '7202', title: '《孟子》四章', author: '孟子及其弟子', dynasty: '战国', difficulty: 3 },
        { id: '7203', title: '送东阳马生序', author: '宋濂', dynasty: '明代', difficulty: 4 },
        { id: '7204', title: '马说', author: '韩愈', dynasty: '唐代', difficulty: 3 },
        { id: '7205', title: '核舟记', author: '魏学洢', dynasty: '明代', difficulty: 4 }
      ]
    },
    {
      grade: '八年级上册',
      list: [
        { id: '8101', title: '廉颇蔺相如列传（节选）', author: '司马迁', dynasty: '西汉', difficulty: 4 },
        { id: '8102', title: '烛之武退秦师', author: '左丘明', dynasty: '春秋', difficulty: 4 },
        { id: '8103', title: '曹刿论战', author: '左丘明', dynasty: '春秋', difficulty: 3 },
        { id: '8104', title: '桃花源记', author: '陶渊明', dynasty: '东晋', difficulty: 3 },
        { id: '8105', title: '短文两篇', author: '佚名', dynasty: '先秦', difficulty: 3 }
      ]
    },
    {
      grade: '八年级下册',
      list: [
        { id: '8201', title: '三峡', author: '郦道元', dynasty: '南北朝', difficulty: 3 },
        { id: '8202', title: '答谢中书书', author: '陶弘景', dynasty: '南朝', difficulty: 4 },
        { id: '8203', title: '与朱元思书', author: '吴均', dynasty: '南朝', difficulty: 4 },
        { id: '8204', title: '记承天寺夜游', author: '苏轼', dynasty: '宋代', difficulty: 3 },
        { id: '8205', title: '项脊轩志', author: '归有光', dynasty: '明代', difficulty: 4 }
      ]
    },
    {
      grade: '九年级上册',
      list: [
        { id: '9101', title: '陈涉世家', author: '司马迁', dynasty: '西汉', difficulty: 5 },
        { id: '9102', title: '唐雎不辱使命', author: '司马迁', dynasty: '西汉', difficulty: 4 },
        { id: '9103', title: '隆中对', author: '陈寿', dynasty: '西晋', difficulty: 4 },
        { id: '9104', title: '出师表', author: '诸葛亮', dynasty: '三国', difficulty: 4 },
        { id: '9105', title: '鱼我所欲也', author: '孟子及其弟子', dynasty: '战国', difficulty: 3 }
      ]
    },
    {
      grade: '九年级下册',
      list: [
        { id: '9201', title: '岳阳楼记', author: '范仲淹', dynasty: '宋代', difficulty: 4 },
        { id: '9202', title: '醉翁亭记', author: '欧阳修', dynasty: '宋代', difficulty: 4 },
        { id: '9203', title: '五代史伶官传序', author: '欧阳修', dynasty: '宋代', difficulty: 5 },
        { id: '9204', title: '小石潭记', author: '柳宗元', dynasty: '唐代', difficulty: 3 },
        { id: '9205', title: '湖心亭看雪', author: '张岱', dynasty: '明末清初', difficulty: 3 }
      ]
    }
  ],
  
  // 高中部分
  senior: [
    {
      grade: '高一上册',
      list: [
        { id: 'g101', title: '赤壁赋', author: '苏轼', dynasty: '宋代', difficulty: 5 },
        { id: 'g102', title: '登高', author: '杜甫', dynasty: '唐代', difficulty: 4 },
        { id: 'g103', title: '滕王阁序', author: '王勃', dynasty: '唐代', difficulty: 5 },
        { id: 'g104', title: '兰亭集序', author: '王羲之', dynasty: '东晋', difficulty: 5 },
        { id: 'g105', title: '荆轲刺秦王', author: '司马迁', dynasty: '西汉', difficulty: 4 }
      ]
    },
    {
      grade: '高一下册',
      list: [
        { id: 'g201', title: '屈原列传', author: '司马迁', dynasty: '西汉', difficulty: 5 },
        { id: 'g202', title: '孔雀东南飞', author: '佚名', dynasty: '汉代', difficulty: 4 },
        { id: 'g203', title: '归去来兮辞', author: '陶渊明', dynasty: '东晋', difficulty: 5 },
        { id: 'g204', title: '蜀道难', author: '李白', dynasty: '唐代', difficulty: 4 },
        { id: 'g205', title: '六国论', author: '苏洵', dynasty: '宋代', difficulty: 4 }
      ]
    },
    {
      grade: '高二上册',
      list: [
        { id: 'g301', title: '阿房宫赋', author: '杜牧', dynasty: '唐代', difficulty: 5 },
        { id: 'g302', title: '过秦论', author: '贾谊', dynasty: '西汉', difficulty: 5 },
        { id: 'g303', title: '师说', author: '韩愈', dynasty: '唐代', difficulty: 4 },
        { id: 'g304', title: '游褒禅山记', author: '王安石', dynasty: '宋代', difficulty: 4 },
        { id: 'g305', title: '毛泽东词二首', author: '毛泽东', dynasty: '现代', difficulty: 3 }
      ]
    },
    {
      grade: '高二下册',
      list: [
        { id: 'g401', title: '劝学', author: '荀子', dynasty: '战国', difficulty: 4 },
        { id: 'g402', title: '逍遥游', author: '庄子', dynasty: '战国', difficulty: 5 },
        { id: 'g403', title: '蜀相', author: '杜甫', dynasty: '唐代', difficulty: 3 },
        { id: 'g404', title: '促织', author: '蒲松龄', dynasty: '清代', difficulty: 4 },
        { id: 'g405', title: '谏太宗十思疏', author: '魏征', dynasty: '唐代', difficulty: 5 }
      ]
    },
    {
      grade: '高三',
      list: [
        { id: 'g501', title: '离骚', author: '屈原', dynasty: '战国', difficulty: 5 },
        { id: 'g502', title: '齐桓晋文之事', author: '左丘明', dynasty: '春秋', difficulty: 4 },
        { id: 'g503', title: '季氏将伐颛臾', author: '孔子及其弟子', dynasty: '春秋', difficulty: 4 },
        { id: 'g504', title: '赤壁之战', author: '陈寿', dynasty: '西晋', difficulty: 4 },
        { id: 'g505', title: '鸿门宴', author: '司马迁', dynasty: '西汉', difficulty: 4 }
      ]
    }
  ]
};

// 课文详情模拟数据示例
const articleDetail = {
  '7101': {
    id: '7101',
    title: '《论语》十二章',
    author: '孔子及其弟子',
    dynasty: '春秋',
    background: '《论语》是儒家学派的经典著作之一，由孔子的弟子及再传弟子编撰而成，记录了孔子及其弟子的言行，集中体现了孔子的思想。',
    content: [
      {
        original: '子曰："学而时习之，不亦说乎？有朋自远方来，不亦乐乎？人不知而不愠，不亦君子乎？"',
        translation: '孔子说："学习知识，并且按时复习，不也是快乐的事吗？有志同道合的朋友从远方来，不也是令人高兴的事吗？别人不了解我，我却不怨恨，不也是有修养的人吗？"',
        annotation: [
          { word: '说', note: '通"悦"，愉快、高兴' },
          { word: '愠', note: '怨恨、生气' }
        ],
        analysis: '这一章表达了孔子关于学习的态度和为人处世的原则。强调学习的快乐，朋友交往的乐趣，以及宽容待人的品格。'
      },
      {
        original: '曾子曰："吾日三省吾身：为人谋而不忠乎？与朋友交而不信乎？传不习乎？"',
        translation: '曾子说："我每天多次反省自己：替别人做事是否尽心尽力？与朋友交往是否诚实守信？老师传授的知识是否复习过？"',
        annotation: [
          { word: '省', note: '检查、反省' },
          { word: '传', note: '传授的知识' }
        ],
        analysis: '这一章强调了自我反省的重要性，表明儒家注重修身养性、道德自律的思想。'
      }
    ]
  }
};

// 导出模拟数据
module.exports = {
  articleList,
  articleDetail
}; 