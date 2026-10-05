/**
 * 自定义底部导航
 * 原生 tabBar 无法动态隐藏某一项，这里用 custom-tab-bar 实现：
 * 家庭未开启辅食推荐时隐藏「辅食」入口。
 */
const ALL_TABS = [
  { pagePath: '/pages/home/home', text: '点菜', icon: '🍽️' },
  { pagePath: '/pages/menu/menu', text: '菜单', icon: '🍳' },
  { pagePath: '/pages/baby-food/baby-food', text: '辅食', icon: '🥣', needBaby: true },
  { pagePath: '/pages/members/members', text: '成员', icon: '👨‍👩‍👧' }
];

Component({
  data: {
    selected: 0,
    visibleList: []
  },

  lifetimes: {
    attached() {
      this.refresh();
    }
  },

  methods: {
    /** 根据家庭设置重新计算可见导航项 */
    refresh() {
      const app = getApp();
      const showBaby = !!(app && app.globalData && app.globalData.babyFoodEnabled);
      const visibleList = ALL_TABS.filter((item) => !item.needBaby || showBaby);
      this.setData({ visibleList });
      return visibleList;
    },

    /** 各页面 onShow 调用，设置当前高亮项 */
    setActive(pagePath) {
      const visibleList = this.refresh();
      const index = visibleList.findIndex((item) => item.pagePath === pagePath);
      this.setData({ selected: index < 0 ? 0 : index });
    },

    onTap(e) {
      const { path, index } = e.currentTarget.dataset;
      if (index === this.data.selected) return;
      wx.switchTab({ url: path });
      this.setData({ selected: index });
    }
  }
});
