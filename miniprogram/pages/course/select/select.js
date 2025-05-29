// 课文选择页面
Page({
  data: {
    // 所有年级数据
    gradeList: [],
    // 当前选中的年级索引
    currentGradeIndex: 0,
    // 当前年级下的课文列表
    currentArticles: [],
    // 当前选中的课文
    selectedArticle: null,
    // 当前选中的课文所属的年级
    selectedGrade: null,
    // 搜索相关
    searchKeyword: '',
    searchResult: [],
    showSearchResult: false,
    isSearching: false,
    // 是否是从首页跳转来的
    fromHome: false,
    // 加载状态
    loading: true,
    // 错误信息
    errorMsg: '',
    // 滚动到指定位置的元素ID
    scrollIntoView: '',
    // 年级列表滚动到指定位置的元素ID
    gradeScrollIntoView: '',
    // 选中文章的索引
    selectedArticleIndex: -1,
    // 用户学习记录
    userArticleRecords: {}
  },

  onLoad: function(options) {
    // 设置加载状态
    this.setData({
      loading: true,
      // 检查是否是从首页跳转来的
      fromHome: options.fromHome === 'true' || options.fromHome === true
    });
    
    console.log('课文选择页面加载，从首页跳转：', this.data.fromHome);
    
    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      this.showError('请升级微信版本');
      return;
    }
    
    // 获取之前选择的课文
    const selectedCourse = wx.getStorageSync('selectedCourse');
    let selectedGradeInfo = null;
    
    if (selectedCourse && selectedCourse.article && (this.data.fromHome || options.autoLocate)) {
      console.log('找到已选择的课文:', selectedCourse);
      
      // 提取年级和学期信息
      const article = selectedCourse.article;
      if (article.grade && article.semester) {
        selectedGradeInfo = {
          grade: article.grade,
          semester: article.semester
        };
        console.log('提取到年级学期信息:', selectedGradeInfo);
      }
    }
    
    // 获取用户学习记录
    this.getUserArticleRecords();
    
    // 从云数据库获取年级和学期列表
    this.fetchGradeAndSemesterList(selectedGradeInfo);
  },
  
  // 获取用户学习记录
  getUserArticleRecords: function() {
    wx.cloud.callFunction({
      name: 'getUserArticleRecords',
      data: {},
      success: res => {
        console.log('获取学习历史记录成功:', res.result);
        
        if (res.result.success && res.result.data && res.result.data.length > 0) {
          // 将学习记录转换为以文章ID为键的对象，方便查询
          const recordsMap = {};
          res.result.data.forEach(record => {
            // 同时保存使用 _id 和 article_id 作为键的记录，确保能匹配到文章
            recordsMap[record.article_id] = record;
            
            // 如果记录中有关联的文章信息
            if (record.article && record.article._id) {
              // 使用文章的 _id 也作为键存储记录
              recordsMap[record.article._id] = record;
            }
          });
          
          this.setData({ userArticleRecords: recordsMap });
          
          // 如果当前已有文章列表，更新学习状态
          if (this.data.currentArticles.length > 0) {
            this.updateArticlesWithLearningStatus();
          }
          
          // 如果当前有搜索结果，也更新搜索结果的学习状态
          if (this.data.searchResult.length > 0) {
            this.updateSearchResultWithLearningStatus();
          }
        }
      },
      fail: err => {
        console.error('获取学习历史记录失败:', err);
      }
    });
  },
  
  // 更新文章列表中的学习状态
  updateArticlesWithLearningStatus: function() {
    const { currentArticles, userArticleRecords } = this.data;
    
    const updatedArticles = currentArticles.map(article => {
      // 首先尝试使用文章的 _id 查找记录
      let record = userArticleRecords[article._id];
      
      // 如果没找到，尝试使用文章的 article_id 字段查找
      if (!record && article.article_id) {
        record = userArticleRecords[article.article_id];
      }
      
      if (record) {
        // 添加学习状态信息
        return {
          ...article,
          learn_status: record.learn_status || 0,
          learn_duration: record.learn_duration || 0,
          statusText: this.getStatusText(record.learn_status)
        };
      }
      return article;
    });
    
    this.setData({ currentArticles: updatedArticles });
  },
  
  // 更新搜索结果中的学习状态
  updateSearchResultWithLearningStatus: function() {
    const { searchResult, userArticleRecords } = this.data;
    
    const updatedSearchResult = searchResult.map(article => {
      // 首先尝试使用文章的 _id 查找记录
      let record = userArticleRecords[article._id];
      
      // 如果没找到，尝试使用文章的 article_id 字段查找
      if (!record && article.article_id) {
        record = userArticleRecords[article.article_id];
      }
      
      if (record) {
        // 添加学习状态信息
        return {
          ...article,
          learn_status: record.learn_status || 0,
          learn_duration: record.learn_duration || 0,
          statusText: this.getStatusText(record.learn_status)
        };
      }
      return article;
    });
    
    this.setData({ searchResult: updatedSearchResult });
  },
  
  // 获取学习状态文本
  getStatusText: function(status) {
    switch (status) {
      case 1:
        return '学习中';
      case 2:
        return '已学完';
      default:
        return '未学习';
    }
  },
  
  // 页面渲染完成后执行
  onReady: function() {
    // 延迟执行滚动，确保组件已完全渲染
    setTimeout(() => {
      if (this.data.gradeScrollIntoView && this.data.fromHome) {
        console.log('页面渲染完成，确保左侧年级列表滚动到:', this.data.gradeScrollIntoView);
        this.setData({
          gradeScrollIntoView: this.data.gradeScrollIntoView
        });
      }
      
      if (this.data.scrollIntoView && this.data.fromHome) {
        console.log('页面渲染完成，确保右侧课文列表滚动到:', this.data.scrollIntoView);
        this.setData({
          scrollIntoView: this.data.scrollIntoView
        });
      }
    }, 300); // 延迟300毫秒执行
  },
  
  // 显示错误信息
  showError: function(msg) {
    this.setData({
      loading: false,
      errorMsg: msg
    });
    
    wx.showToast({
      title: msg,
      icon: 'none',
      duration: 2000
    });
  },
  
  // 从云数据库获取年级和学期列表
  fetchGradeAndSemesterList: function(selectedGradeInfo) {
    console.log('开始获取年级和学期列表');
    this.setData({ 
      loading: true,
      errorMsg: '' 
    });
    
    // 检查云环境是否初始化
    if (!wx.cloud) {
      this.showError('云环境未初始化');
      return;
    }
    
    try {
      const db = wx.cloud.database();
      
      // 从articles表中获取所有不同的grade(年级)和semester(学期)组合
      db.collection('articles')
        .field({
          grade: true,
          semester: true,
          grade_id: true
        })
        .get()
        .then(res => {
          console.log('获取到年级和学期数据:', res.data);
          
          // 预设完整的年级学期列表
          const predefinedGradeList = [
            { grade: '一年级', semester: '上学期', displayName: '一年级上学期' },
            { grade: '一年级', semester: '下学期', displayName: '一年级下学期' },
            { grade: '二年级', semester: '上学期', displayName: '二年级上学期' },
            { grade: '二年级', semester: '下学期', displayName: '二年级下学期' },
            { grade: '三年级', semester: '上学期', displayName: '三年级上学期' },
            { grade: '三年级', semester: '下学期', displayName: '三年级下学期' },
            { grade: '四年级', semester: '上学期', displayName: '四年级上学期' },
            { grade: '四年级', semester: '下学期', displayName: '四年级下学期' },
            { grade: '五年级', semester: '上学期', displayName: '五年级上学期' },
            { grade: '五年级', semester: '下学期', displayName: '五年级下学期' },
            { grade: '六年级', semester: '上学期', displayName: '六年级上学期' },
            { grade: '六年级', semester: '下学期', displayName: '六年级下学期' },
            { grade: '七年级', semester: '上学期', displayName: '七年级上学期' },
            { grade: '七年级', semester: '下学期', displayName: '七年级下学期' },
            { grade: '八年级', semester: '上学期', displayName: '八年级上学期' },
            { grade: '八年级', semester: '下学期', displayName: '八年级下学期' },
            { grade: '九年级', semester: '上学期', displayName: '九年级上学期' },
            { grade: '九年级', semester: '下学期', displayName: '九年级下学期' },
            { grade: '高中必修', semester: '上册', displayName: '高中必修上册' },
            { grade: '高中必修', semester: '下册', displayName: '高中必修下册' },
            { grade: '高中选修', semester: '上册', displayName: '高中选修上册' },
            { grade: '高中选修', semester: '中册', displayName: '高中选修中册' },
            { grade: '高中选修', semester: '下册', displayName: '高中选修下册' }
          ];
          
          if (!res.data || res.data.length === 0) {
            console.log('数据库中没有课文数据，使用预设的年级学期列表');
            
            // 处理已选择的年级学期
            this.handleGradeList(predefinedGradeList, selectedGradeInfo);
            return;
          }
          
          // 使用Map去重获取所有唯一的年级-学期组合
          const gradeSemesterMap = new Map();
          let invalidDataCount = 0;
          
          res.data.forEach(item => {
            // 获取年级和学期信息
            const grade = item.grade || '';
            const semester = item.semester || '';
            
            // 确保年级和学期字段有值
            if (grade && semester) {
              // 使用grade和semester组合为key
              const key = `${grade}_${semester}`;
              
              // 如果该组合不存在，则添加
              if (!gradeSemesterMap.has(key)) {
                gradeSemesterMap.set(key, {
                  grade: grade,                           // 年级字段
                  semester: semester,                     // 学期字段
                  grade_id: item.grade_id || 0,           // 年级ID用于排序
                  displayName: `${grade}${semester}`      // 显示名称：一年级上学期
                });
              }
            } else {
              // 记录无效数据的数量
              invalidDataCount++;
            }
          });
          
          if (invalidDataCount > 0) {
            console.warn(`有${invalidDataCount}条数据缺少年级或学期字段`);
          }
          
          // 如果从数据库获取的年级学期组合太少，合并预设的列表
          let gradeList = Array.from(gradeSemesterMap.values());
          
          if (gradeList.length < predefinedGradeList.length) {
            console.log('从数据库获取的年级学期不完整，合并预设列表');
            
            // 将数据库中的年级学期与预设列表合并
            predefinedGradeList.forEach(predefinedItem => {
              const key = `${predefinedItem.grade}_${predefinedItem.semester}`;
              if (!gradeSemesterMap.has(key)) {
                gradeList.push(predefinedItem);
              }
            });
          }
          
          console.log('合并后的年级学期组合数:', gradeList.length);
          
          // 排序：按年级名称和学期排序
          gradeList.sort((a, b) => {
            // 定义年级顺序
            const gradeOrder = {
              '一年级': 1, 
              '二年级': 2, 
              '三年级': 3, 
              '四年级': 4, 
              '五年级': 5, 
              '六年级': 6, 
              '七年级': 7, 
              '八年级': 8, 
              '九年级': 9,
              '高中必修': 10,
              '高中选修': 11
            };
            
            // 定义学期顺序
            const semesterOrder = {
              '上学期': 1,
              '下学期': 2,
              '上册': 1,
              '下册': 2,
              '中册': 1.5
            };
            
            // 先按年级排序
            if (gradeOrder[a.grade] !== gradeOrder[b.grade]) {
              return gradeOrder[a.grade] - gradeOrder[b.grade];
            }
            
            // 年级相同则按学期排序
            return semesterOrder[a.semester] - semesterOrder[b.semester];
          });
          
          console.log('处理后的年级学期列表:', gradeList);
          
          // 处理已选择的年级学期
          this.handleGradeList(gradeList, selectedGradeInfo);
        })
        .catch(err => {
          console.error('获取年级和学期列表失败:', err);
          
          // 如果从数据库获取失败，使用预设的年级学期列表
          console.log('使用预设的年级学期列表');
          const predefinedGradeList = [
            { grade: '一年级', semester: '上学期', displayName: '一年级上学期' },
            { grade: '一年级', semester: '下学期', displayName: '一年级下学期' },
            { grade: '二年级', semester: '上学期', displayName: '二年级上学期' },
            { grade: '二年级', semester: '下学期', displayName: '二年级下学期' },
            { grade: '三年级', semester: '上学期', displayName: '三年级上学期' },
            { grade: '三年级', semester: '下学期', displayName: '三年级下学期' },
            { grade: '四年级', semester: '上学期', displayName: '四年级上学期' },
            { grade: '四年级', semester: '下学期', displayName: '四年级下学期' },
            { grade: '五年级', semester: '上学期', displayName: '五年级上学期' },
            { grade: '五年级', semester: '下学期', displayName: '五年级下学期' },
            { grade: '六年级', semester: '上学期', displayName: '六年级上学期' },
            { grade: '六年级', semester: '下学期', displayName: '六年级下学期' },
            { grade: '七年级', semester: '上学期', displayName: '七年级上学期' },
            { grade: '七年级', semester: '下学期', displayName: '七年级下学期' },
            { grade: '八年级', semester: '上学期', displayName: '八年级上学期' },
            { grade: '八年级', semester: '下学期', displayName: '八年级下学期' },
            { grade: '九年级', semester: '上学期', displayName: '九年级上学期' },
            { grade: '九年级', semester: '下学期', displayName: '九年级下学期' },
            { grade: '高中必修', semester: '上册', displayName: '高中必修上册' },
            { grade: '高中必修', semester: '下册', displayName: '高中必修下册' },
            { grade: '高中选修', semester: '上册', displayName: '高中选修上册' },
            { grade: '高中选修', semester: '中册', displayName: '高中选修中册' },
            { grade: '高中选修', semester: '下册', displayName: '高中选修下册' }
          ];
          
          // 处理已选择的年级学期
          this.handleGradeList(predefinedGradeList, selectedGradeInfo);
        });
    } catch (err) {
      console.error('执行查询时出错:', err);
      this.showError('系统错误，请重试');
    }
  },

  // 处理年级列表和选中的年级
  handleGradeList: function(gradeList, selectedGradeInfo) {
    // 确定要选中的年级索引
    let selectedIndex = 0;
    
    if (selectedGradeInfo) {
      // 尝试查找匹配的年级和学期
      const findIndex = gradeList.findIndex(item => 
        item.grade === selectedGradeInfo.grade && 
        item.semester === selectedGradeInfo.semester
      );
      
      if (findIndex !== -1) {
        selectedIndex = findIndex;
        console.log('找到之前选择的年级学期:', gradeList[selectedIndex].displayName);
      }
    }
    
    this.setData({
      gradeList: gradeList,
      currentGradeIndex: selectedIndex,
      loading: false,
      // 设置滚动到选中的年级项
      gradeScrollIntoView: `grade-${selectedIndex}`
    });
    
    console.log('设置左侧年级列表滚动到:', `grade-${selectedIndex}`);
    
    // 加载选中年级的课文
    if (gradeList.length > 0) {
      const selectedGrade = gradeList[selectedIndex];
      console.log('加载课文:', selectedGrade.displayName);
      // 加载选中年级的课文
      this.fetchArticlesByGradeAndSemester(selectedGrade.grade, selectedGrade.semester);
    } else {
      this.showError('暂无课文数据');
    }
  },
  
  // 根据年级和学期获取课文列表
  fetchArticlesByGradeAndSemester: function(grade, semester) {
    console.log('获取课文列表, 年级:', grade, '学期:', semester);
    
    // 仅设置右侧列表区域的加载状态，而不是整个页面
    this.setData({ 
      errorMsg: '' 
    });
    
    if (!grade || !semester) {
      console.error('年级或学期参数缺失');
      this.showError('参数错误');
      return;
    }
    
    // 获取之前选择的课文
    const selectedCourse = wx.getStorageSync('selectedCourse');
    let selectedArticleId = null;
    
    // 检查是否存在之前选择的课文
    if (selectedCourse && selectedCourse.article && selectedCourse.article._id) {
      selectedArticleId = selectedCourse.article._id;
      console.log('之前选择的课文ID:', selectedArticleId);
    }
    
    try {
      const db = wx.cloud.database();
      
      // 构建查询条件
      const queryConditions = {
        grade: grade,       // 年级字段
        semester: semester  // 学期字段
      };
      
      console.log('使用查询条件:', JSON.stringify(queryConditions));
      
      // 使用grade和semester两个字段作为筛选条件
      db.collection('articles')
        .where(queryConditions)
        .orderBy('lesson_number', 'asc') // 首先按课文序号排序
        .get()
        .then(res => {
          console.log(`获取到"${grade}${semester}"的课文列表:`, res.data.length, '条数据');
          
          // 如果获取到的数据为空，显示提示
          if (!res.data || res.data.length === 0) {
            this.setData({
              currentArticles: [],
              loading: false
            });
            wx.showToast({
              title: '该年级暂无课文',
              icon: 'none',
              duration: 2000
            });
            return;
          }
          
          // 处理课文数据，确保必要字段存在
          const processedArticles = res.data.map(item => {
            return {
              ...item,
              lesson_number: item.lesson_number || '无序号',
              title: item.title || '无标题',
              author: item.author || '佚名',
              dynasty: item.dynasty || '未知朝代'
            };
          });
          
          // 确保按照lesson_number排序（考虑到可能是字符串或数字类型）
          processedArticles.sort((a, b) => {
            // 处理lesson_number可能为字符串的情况
            const numA = parseInt(a.lesson_number) || 9999; // 无法解析为数字的排在最后
            const numB = parseInt(b.lesson_number) || 9999;
            return numA - numB;
          });
          
          console.log('排序后的课文列表:', processedArticles.map(item => `${item.lesson_number}: ${item.title}`));
          
          // 查找之前选择的课文在当前列表中的位置
          let selectedArticleIndex = -1;
          if (selectedArticleId) {
            selectedArticleIndex = processedArticles.findIndex(item => item._id === selectedArticleId);
            if (selectedArticleIndex !== -1) {
              console.log('找到之前选择的课文:', processedArticles[selectedArticleIndex].title);
            }
          }
          
          this.setData({
            currentArticles: processedArticles,
            selectedArticleIndex: selectedArticleIndex,
            loading: false
          });
          
          // 更新文章的学习状态
          if (Object.keys(this.data.userArticleRecords).length > 0) {
            this.updateArticlesWithLearningStatus();
          }
          
          // 如果找到了之前选择的课文，滚动到对应位置
          if (selectedArticleIndex !== -1) {
            // 微信小程序中ScrollView组件有滚动到指定元素的功能
            this.setData({
              scrollIntoView: `article-${selectedArticleId}`
            });
            console.log('设置滚动到:', `article-${selectedArticleId}`);
          }
        })
        .catch(err => {
          console.error('获取课文列表失败:', err);
          this.showError('加载课文列表失败');
        });
    } catch (err) {
      console.error('获取课文列表时出错:', err);
      this.showError('系统错误，请重试');
    }
  },

  // 选择年级
  selectGrade: function(e) {
    const index = e.currentTarget.dataset.index;
    // 如果点击的是当前已选中的年级，则不做任何操作
    if (index === this.data.currentGradeIndex) {
      return;
    }
    
    const selectedGrade = this.data.gradeList[index];
    
    console.log('选择年级:', selectedGrade.displayName, '原始数据:', {
      grade: selectedGrade.grade,
      semester: selectedGrade.semester
    });
    
    this.setData({
      currentGradeIndex: index,
      // 清空搜索状态
      searchKeyword: '',
      showSearchResult: false,
      isSearching: false,
      // 设置右侧列表临时加载状态
      currentArticles: []
    });
    
    // 传入分开的grade和semester字段进行查询
    this.fetchArticlesByGradeAndSemester(selectedGrade.grade, selectedGrade.semester);
  },

  // 选择课文
  selectArticle: function(e) {
    const articleId = e.currentTarget.dataset.id;
    const articleIndex = this.data.currentArticles.findIndex(item => item._id === articleId);
    
    if (articleIndex !== -1) {
      const article = this.data.currentArticles[articleIndex];
      const gradeInfo = this.data.gradeList[this.data.currentGradeIndex];
      
      console.log('选中课文:', article);
      
      // 确保文章对象包含 article_id 字段
      if (!article.article_id) {
        article.article_id = article._id;
      }
      
      // 保存选中的课文到本地存储
      wx.setStorageSync('selectedCourse', {
        article: article,
        grade: `${gradeInfo.grade}${gradeInfo.semester}`
      });
      
      // 无论是否从首页跳转来的，都返回上一页
      wx.navigateBack();
    }
  },

  // 输入搜索关键词
  onSearchInput: function(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword,
      isSearching: keyword.length > 0
    });

    if (keyword.length > 0) {
      this.search(keyword);
    } else {
      this.setData({
        showSearchResult: false
      });
    }
  },

  // 清空搜索框
  clearSearch: function() {
    this.setData({
      searchKeyword: '',
      showSearchResult: false,
      isSearching: false
    });
  },

  // 搜索文章
  search: function(keyword) {
    if (keyword.trim() === '') {
      this.setData({
        showSearchResult: false,
        loading: false
      });
      return;
    }
    
    this.setData({ 
      loading: true,
      errorMsg: ''
    });
    
    console.log('搜索关键词:', keyword);
    
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 在云数据库中搜索
      db.collection('articles')
        .where(_.or([
          { title: db.RegExp({ regexp: keyword, options: 'i' }) },
          { author: db.RegExp({ regexp: keyword, options: 'i' }) },
          { dynasty: db.RegExp({ regexp: keyword, options: 'i' }) }
        ]))
        .orderBy('lesson_number', 'asc') // 首先按课文序号排序
        .get()
        .then(res => {
          console.log('搜索结果:', res.data.length, '条数据');
          
          // 如果搜索结果为空，显示提示
          if (!res.data || res.data.length === 0) {
            this.setData({
              searchResult: [],
              showSearchResult: true,
              loading: false
            });
            wx.showToast({
              title: '未找到相关课文',
              icon: 'none',
              duration: 2000
            });
            return;
          }
          
          // 处理搜索结果，确保每个结果都有完整的年级和学期显示
          const processedResults = res.data.map(item => {
            // 基础数据处理，确保所有必要字段都存在
            const processedItem = {
              ...item,
              title: item.title || '无标题',
              author: item.author || '佚名',
              dynasty: item.dynasty || '未知朝代',
              lesson_number: item.lesson_number || '无序号'
            };
            
            // 确保年级和学期字段存在
            if (!item.grade || !item.semester) {
              return {
                ...processedItem,
                grade: item.grade || '未知',
                semester: item.semester || '',
                gradeDisplay: item.grade_level || '未知年级'
              };
            }
            
            // 添加完整显示的年级学期信息
            return {
              ...processedItem,
              gradeDisplay: `${item.grade}${item.semester}`
            };
          });
          
          // 确保按照lesson_number排序（考虑到可能是字符串或数字类型）
          processedResults.sort((a, b) => {
            // 先按年级排序
            if (a.grade !== b.grade) {
              return a.grade.localeCompare(b.grade);
            }
            
            // 再按学期排序
            if (a.semester !== b.semester) {
              return a.semester.localeCompare(b.semester);
            }
            
            // 最后按课文序号排序
            const numA = parseInt(a.lesson_number) || 9999; // 无法解析为数字的排在最后
            const numB = parseInt(b.lesson_number) || 9999;
            return numA - numB;
          });
          
          console.log('排序后的搜索结果:', processedResults.map(item => `${item.grade}${item.semester} - ${item.lesson_number}: ${item.title}`));
          
          this.setData({
            searchResult: processedResults,
            showSearchResult: true,
            loading: false
          });
          
          // 更新搜索结果的学习状态
          if (Object.keys(this.data.userArticleRecords).length > 0) {
            this.updateSearchResultWithLearningStatus();
          }
        })
        .catch(err => {
          console.error('搜索失败:', err);
          this.showError('搜索失败，请重试');
        });
    } catch (err) {
      console.error('执行搜索时出错:', err);
      this.showError('系统错误，请重试');
    }
  },

  // 选择搜索结果中的课文
  selectSearchArticle: function(e) {
    const articleId = e.currentTarget.dataset.id;
    const articleIndex = this.data.searchResult.findIndex(item => item._id === articleId);
    
    if (articleIndex !== -1) {
      const article = this.data.searchResult[articleIndex];
      
      console.log('选中搜索结果中的课文:', article);
      
      // 确保文章对象包含 article_id 字段
      if (!article.article_id) {
        article.article_id = article._id;
      }
      
      // 保存选中的课文到本地存储
      wx.setStorageSync('selectedCourse', {
        article: article,
        grade: article.grade ? `${article.grade}${article.semester || ''}` : '未知年级'
      });
      
      // 无论是否从首页跳转来的，都返回上一页
      wx.navigateBack();
    }
  }
}); 