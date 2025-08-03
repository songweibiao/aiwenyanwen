Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#1A1A1A",
    list: []
  },
  lifetimes: {
    attached() {
      const app = getApp();
      // 1. 立即使用当前数据设置一次，防止空白
      this.setTabBar();
      // 2. 创建一个绑定了当前组件实例上下文的函数
      this.updateHandler = this.setTabBar.bind(this);
      // 3. 注册这个绑定后的函数为观察者
      app.watch(this.updateHandler);
    },
    detached() {
      const app = getApp();
      // 4. 组件销毁时，移除之前注册的同一个函数
      app.unwatch(this.updateHandler);
    }
  },
  methods: {
    setTabBar() {
      const app = getApp()
      const showAITab = app.globalData.featureFlags.showAITab
      const fullList = [
        {
          "pagePath": "/pages/index/index",
          "text": "首页",
          "iconPath": "/images/tabbar/tab-home.png",
          "selectedIconPath": "/images/tabbar/tab-home-active.png"
        },
        {
          "pagePath": "/pages/word-learning/index/index",
          "text": "虚实词",
          "iconPath": "/images/tabbar/tab-exercise.png",
          "selectedIconPath": "/images/tabbar/tab-exercise-active.png"
        },
        {
          "pagePath": "/pages/ai/index/index",
          "text": "互动问答",
          "iconPath": "/images/tabbar/tab-ai.png",
          "selectedIconPath": "/images/tabbar/tab-ai-active.png"
        },
        {
          "pagePath": "/pages/my/index/index",
          "text": "我的",
          "iconPath": "/images/tabbar/tab-my.png",
          "selectedIconPath": "/images/tabbar/tab-my-active.png"
        }
      ]

      const filteredList = showAITab ? fullList : fullList.filter(item => item.pagePath !== '/pages/ai/index/index')

      this.setData({
        list: filteredList
      })
    },
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      wx.switchTab({url})
      this.setData({
        selected: data.index
      })
    }
  }
})