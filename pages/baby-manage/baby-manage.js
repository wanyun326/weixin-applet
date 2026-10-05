// 宝宝管理：添加 / 编辑 / 删除宝宝（添加后自动开启辅食推荐）
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');
const util = require('../../utils/util');

const GENDERS = ['男', '女'];

Page({
  data: {
    familyId: '',
    babies: [],
    loading: true,
    showForm: false,
    editingId: '',
    genders: GENDERS,
    form: { nickname: '', gender: '男', birthday: '' },
    submitting: false
  },

  onShow() {
    const family = store.getCurrentFamily();
    if (!family || !family._id) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    this.setData({ familyId: family._id });
    this.loadBabies();
  },

  async loadBabies() {
    this.setData({ loading: true });
    try {
      const list = await db.getAll('babies', {
        where: { familyId: this.data.familyId },
        orderBy: 'createdAt',
        order: 'asc'
      });
      const babies = list.map((b) => ({
        ...b,
        ageMonths: util.monthAge(b.birthday),
        birthdayText: util.ymd(b.birthday)
      }));
      this.setData({ babies, loading: false });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  openAdd() {
    this.setData({
      showForm: true,
      editingId: '',
      form: { nickname: '', gender: '男', birthday: '' }
    });
  },

  openEdit(e) {
    const baby = this.data.babies[e.currentTarget.dataset.index];
    this.setData({
      showForm: true,
      editingId: baby._id,
      form: {
        nickname: baby.nickname,
        gender: baby.gender,
        birthday: baby.birthdayText
      }
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  onNicknameInput(e) {
    this.setData({ 'form.nickname': e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ 'form.gender': GENDERS[e.detail.value] });
  },

  onBirthdayChange(e) {
    this.setData({ 'form.birthday': e.detail.value });
  },

  async onSubmit() {
    const { nickname, gender, birthday } = this.data.form;
    if (!nickname.trim()) {
      wx.showToast({ title: '请填写宝宝昵称', icon: 'none' });
      return;
    }
    if (!birthday) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    const collection = db.db().collection('babies');
    try {
      if (this.data.editingId) {
        await collection.doc(this.data.editingId).update({
          data: { nickname: nickname.trim(), gender, birthday: new Date(birthday) }
        });
      } else {
        await collection.add({
          data: {
            familyId: this.data.familyId,
            nickname: nickname.trim(),
            gender,
            birthday: new Date(birthday),
            createdAt: db.db().serverDate()
          }
        });
        // 添加宝宝后自动开启辅食推荐
        await this.enableBabyFood();
      }
      this.setData({ showForm: false, submitting: false });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.loadBabies();
    } catch (err) {
      this.setData({ submitting: false });
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },

  async enableBabyFood() {
    const family = store.getCurrentFamily();
    if (family && family.babyFoodEnabled) return;
    try {
      await db.callFunction('toggleBabyFood', {
        familyId: this.data.familyId,
        enabled: true
      });
      this.applyBabyFoodEnabled(true);
    } catch (err) {
      console.error('自动开启辅食失败', err);
    }
  },

  applyBabyFoodEnabled(enabled) {
    const family = store.getCurrentFamily() || {};
    family.babyFoodEnabled = enabled;
    store.setCurrentFamily(family);
    app.globalData.babyFoodEnabled = enabled;
  },

  onDelete(e) {
    const baby = this.data.babies[e.currentTarget.dataset.index];
    wx.showModal({
      title: '删除宝宝',
      content: `确定删除「${baby.nickname}」的档案吗？`,
      confirmText: '删除',
      confirmColor: '#E4572E',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await db.db().collection('babies').doc(baby._id).remove();
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadBabies();
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' });
        }
      }
    });
  },

  goBabyFood() {
    wx.switchTab({ url: '/pages/baby-food/baby-food' });
  },

  /** 阻止弹层内容点击冒泡到遮罩 */
  noop() {}
});
