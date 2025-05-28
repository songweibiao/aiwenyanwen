# 文言悦读小程序

这是一款专为中小学生设计的文言文学习微信小程序，通过AI技术，帮助学生更轻松地理解文言文，提高古文阅读能力和考试成绩。

## 项目结构

```
wenyanwen/
├── miniprogram/              # 小程序源代码目录
│   ├── app.js                # 小程序全局逻辑
│   ├── app.json              # 小程序全局配置
│   ├── app.wxss              # 小程序全局样式
│   ├── sitemap.json          # 小程序SEO配置
│   ├── cloudfunctions/       # 云函数目录
│   │   ├── login/            # 用户登录云函数
│   │   └── aiService/        # AI服务云函数
│   ├── components/           # 自定义组件目录
│   ├── images/               # 图片资源目录
│   ├── pages/                # 页面目录
│   │   ├── index/            # 首页
│   │   │   ├── index.js      # 首页逻辑
│   │   │   ├── index.wxml    # 首页结构
│   │   │   └── index.wxss    # 首页样式
│   │   ├── article/          # 课文相关页面
│   │   │   └── detail/       # 课文详情页
│   │   ├── course/           # 课程相关页面
│   │   │   └── select/       # 课文选择页面
│   │   │       ├── select.js   # 课文选择页面逻辑
│   │   │       ├── select.wxml # 课文选择页面结构
│   │   │       └── select.wxss # 课文选择页面样式
│   │   ├── exercise/         # 练习相关页面
│   │   │   ├── specialized/  # 专项练习
│   │   │   ├── daily/        # 每日练习
│   │   │   └── index/        # 练习首页
│   │   ├── ai/               # AI助手页面
│   │   │   └── index/        # AI助手首页
│   │   ├── my/               # 我的页面
│   │   │   └── index/        # 个人中心首页
│   │   └── logs/             # 日志页面
│   ├── styles/               # 样式目录
│   └── utils/                # 工具函数目录
│       ├── ai.js             # AI功能工具函数
│       ├── request.js        # 网络请求工具函数
│       └── util.js           # 通用工具函数
├── project.config.json       # 项目配置文件
├── project.private.config.json # 项目私有配置文件
└── xuqiu.md                  # 需求文档
```

## 页面结构详解

### 1. 课文选择页面 (miniprogram/pages/course/select/)

课文选择页面允许用户按年级和学期浏览和选择课文。

**核心功能：**
- 按年级和学期分类展示课文列表
- 支持课文搜索功能
- 自动定位到上次学习的课文
- 课文选择后跳转到详情页

**主要实现文件：**
- `select.js` - 页面逻辑：包含年级列表获取、课文列表获取、课文搜索和选择等功能
- `select.wxml` - 页面结构：包含左侧年级列表和右侧课文列表的布局
- `select.wxss` - 页面样式：中国风UI样式定义

**数据交互：**
- 从云数据库 `articles` 集合获取课文数据
- 将选中的课文保存到本地存储

### 2. 首页 (miniprogram/pages/index/)

首页是用户进入小程序的第一个页面，提供各种功能入口。

**主要实现文件：**
- `index.js` - 首页逻辑
- `index.wxml` - 首页结构
- `index.wxss` - 首页样式

## 功能模块

### 1. 首页

- 欢迎区域：根据时间段显示不同欢迎语
- 继续学习区域：显示用户最近学习的内容
- 课文精讲区域：学习课文的主要入口
- 虚词实词背诵区域：分类整理常见文言实词、虚词
- 名句赏析区域：精选文言文经典名句
- 推广领取区域：提供学习资料领取

### 2. 课文学习

- 课文选择：按年级分类选择课文
- 课文学习：包含原文、翻译、逐句解析、背景知识等
- 练习巩固：基于课文生成的练习题
- 提问拓展：用户可针对课文提出任何问题获取解答

### 3. 练习模块

- 每日答题：提供每日文言文练习题
- 专项突破：针对文言文不同知识点的专项训练

### 4. AI助手

- 拟人化AI助手（李白），回答用户提出的文言文相关问题
- 支持文言文翻译、古诗创作、文学典故讲解等功能

### 5. 个人中心

- VIP会员：会员权益与购买管理
- 学习统计：展示用户学习数据
- 我的错题集：收集整理用户做错的题目
- 我的收藏：管理收藏的内容

## 技术实现

- 前端：微信小程序原生框架
- 后端：微信云开发平台
  - 云数据库：存储用户数据和课文内容
  - 云函数：处理AI请求与鉴权
- AI功能：调用大语言模型API提供文言文翻译、解析、出题等功能

## 开发环境

1. 微信开发者工具
2. 开通云开发环境
3. AppID 配置

## 开发进度

- [x] 环境搭建与基础架构
- [x] 云函数初始化
- [x] AI服务接口配置
- [x] 首页界面完善
- [x] 课文选择页开发
- [x] 课文学习页面开发
- [x] UI风格优化（中国古典风格）
- [ ] 练习模块开发
- [ ] AI助手开发
- [ ] 用户中心开发
- [ ] 数据库设计与实现

## 启动项目

1. 克隆本仓库
2. 使用微信开发者工具打开项目
3. 在开发者工具中点击"云开发"，创建云开发环境
4. 部署云函数
5. 创建云数据库集合
6. 在微信开发者工具中点击"编译"按钮运行项目

## 下一步开发计划

1. UI体验优化
   - 完善各页面的中国风设计元素
   - 优化组件交互动效
   - 适配深色模式
   - 制作更多中国风SVG素材

2. 练习模块开发
   - 搭建练习题展示和答题界面
   - 实现不同类型练习题（选择题、填空题、解析题）
   - 开发答题评分和错题记录功能
   - 添加练习题统计和回顾功能

3. AI助手功能实现
   - 开发对话式界面
   - 制作拟人化AI角色（李白形象）
   - 实现文言文翻译、古诗创作等核心功能
   - 开发智能问答和错题指导功能

4. 用户中心开发
   - 实现个人学习数据展示
   - 开发学习统计图表功能
   - 设计会员权益与收藏管理
   - 添加学习计划和目标设置功能

注意：在整个开发过程中，优先使用模拟数据进行功能和逻辑开发，待产品定稿后再进行数据库设计和实现。

## 数据库设计

采用小程序云开发数据库

### 数据集合：

#### articles (文章数据表)
- education_stage：教育阶段
- grade：年级
- semester：学期
- article_id：课文ID
- grade_id：年级编号
- lesson_number：课文序号
- chapter：章节
- title：文章标题
- author：文章作者
- dynasty：朝代
- full_content：课文内容
- isshige：诗歌还是文言文
- audio：音频

#### article_ai_content 集合
{
  "bsonType": "object",
  "required": ["article_id", "type", "content", "created_at", "updated_at"],
  "properties": {
    "article_id": {
      "bsonType": "string",
      "description": "课文ID，关联 articles 表的 article_id"
    },
    "type": {
      "bsonType": "string",
      "enum": [
        "translate",
        "sentence_analysis",
        "author_info",
        "background",
        "exercise",
        "qa",
        "suggested_questions"
      ],
      "description": "AI内容类型"
    },
    "content": {
      "description": "AI生成内容，类型根据type而定",
      "oneOf": [
        { "bsonType": "string" },
        { "bsonType": "array" },
        { "bsonType": "object" }
      ]
    },
    "extra": {
      "bsonType": "object",
      "description": "额外参数（如句子内容、用户问题、年级等上下文信息）",
      "required": [],
      "properties": {}
    },
    "created_at": {
      "bsonType": "date",
      "description": "创建时间"
    },
    "updated_at": {
      "bsonType": "date",
      "description": "更新时间"
    }
  },
  "additionalProperties": false
}