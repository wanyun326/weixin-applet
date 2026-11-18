// 家庭自定义菜单：添加、编辑、删除菜品并上传图片
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');

const CATEGORIES = ['热销', '荤菜', '素菜', '主食', '汤类'];
const DEFAULT_IMAGE = '/images/dishes/hot.png';

function createEmptyForm() {
  return {
    name: '',
    desc: '',
    category: CATEGORIES[0],
    imageUrl: ''
  };
}

Page({
  data: {
    familyId: '',
    familyName: '',
    dishes: [],
    loading: true,
    showForm: false,
    submitting: false,
    deletingId: '',
    editingId: '',
    categories: CATEGORIES,
    categoryIndex: 0,
    form: createEmptyForm()
  },

  onShow() {
    this.loadContext();
  },

  resolveFamily() {
    const family =
      (app.globalData.currentFamilyId && {
        _id: app.globalData.currentFamilyId,
        name: app.globalData.currentFamilyName
      }) ||
      store.getCurrentFamily();
    return family && family._id ? family : null;
  },

  async loadContext() {
    const family = this.resolveFamily();
    if (!family) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    this.setData({
      familyId: family._id,
      familyName: family.name,
      loading: true
    });
    await this.loadDishes();
  },

  async loadDishes() {
    try {
      const data = await db.callFunction('manageDish', {
        familyId: this.data.familyId,
        action: 'list'
      });
      const dishes = ((data && data.dishes) || []).filter(
        (dish) => dish.isCustom
      );
      this.setData({ dishes, loading: false });
    } catch (err) {
      this.setData({ loading: false, dishes: [] });
      wx.showToast({ title: err.message || '自定义菜单加载失败', icon: 'none' });
    }
  },

  openAdd() {
    this.setData({
      showForm: true,
      editingId: '',
      categoryIndex: 0,
      form: createEmptyForm()
    });
  },

  openEdit(e) {
    const dish = this.data.dishes[e.currentTarget.dataset.index];
    const categoryIndex = Math.max(0, CATEGORIES.indexOf(dish.category));
    this.setData({
      showForm: true,
      editingId: dish._id,
      categoryIndex,
      form: {
        name: dish.name || '',
        desc: dish.desc || '',
        category: dish.category || CATEGORIES[0],
        imageUrl: dish.imageUrl || ''
      }
    });
  },

  closeForm() {
    if (this.data.submitting) return;
    this.setData({ showForm: false });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onCategoryChange(e) {
    const categoryIndex = Number(e.detail.value);
    this.setData({
      categoryIndex,
      'form.category': CATEGORIES[categoryIndex]
    });
  },

  async onChooseImage() {
    try {
      let tempFilePath = '';
      if (wx.chooseMedia) {
        const res = await new Promise((resolve, reject) => {
          wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            sizeType: ['compressed'],
            success: resolve,
            fail: reject
          });
        });
        tempFilePath = res.tempFiles && res.tempFiles[0]
          ? res.tempFiles[0].tempFilePath
          : '';
      } else {
        const res = await new Promise((resolve, reject) => {
          wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject
          });
        });
        tempFilePath = (res.tempFilePaths && res.tempFilePaths[0]) || '';
      }
      if (tempFilePath) {
        this.setData({ 'form.imageUrl': tempFilePath });
      }
    } catch (err) {
      if (!/cancel/i.test((err && err.errMsg) || '')) {
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    }
  },

  uploadDishImage(tempFilePath) {
    const extMatch = tempFilePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const ext = extMatch ? extMatch[1] : 'jpg';
    const cloudPath = `dishes/${this.data.familyId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: (err) => reject(new Error(err.errMsg || '菜品图片上传失败'))
      });
    });
  },

  async cleanupUploadedFile(fileID) {
    if (!fileID || !/^cloud:\/\//.test(fileID)) return;
    try {
      await new Promise((resolve, reject) => {
        wx.cloud.deleteFile({
          fileList: [fileID],
          success: resolve,
          fail: reject
        });
      });
    } catch (err) {
      console.warn('清理未使用的菜品图片失败', err);
    }
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const form = this.data.form;
    const name = (form.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写菜品名称', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    let uploadedFileID = '';
    try {
      let imageUrl = form.imageUrl || DEFAULT_IMAGE;
      if (
        imageUrl &&
        !/^cloud:\/\//.test(imageUrl) &&
        !/^\/images\/dishes\//.test(imageUrl)
      ) {
        uploadedFileID = await this.uploadDishImage(imageUrl);
        imageUrl = uploadedFileID;
      }

      await db.callFunction('manageDish', {
        familyId: this.data.familyId,
        action: this.data.editingId ? 'update' : 'add',
        dishId: this.data.editingId,
        dish: {
          name,
          desc: (form.desc || '').trim(),
          category: form.category,
          imageUrl
        }
      });
      this.setData({ showForm: false, submitting: false });
      wx.showToast({
        title: this.data.editingId ? '菜品已更新' : '菜品已添加',
        icon: 'success'
      });
      await this.loadDishes();
    } catch (err) {
      if (uploadedFileID) await this.cleanupUploadedFile(uploadedFileID);
      this.setData({ submitting: false });
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  onDelete(e) {
    const dish = this.data.dishes[e.currentTarget.dataset.index];
    wx.showModal({
      title: '删除菜品',
      content: `确定删除自定义菜品「${dish.name}」吗？历史订单中的菜名和图片会保留。`,
      confirmText: '删除',
      confirmColor: '#E4572E',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ deletingId: dish._id });
        try {
          await db.callFunction('manageDish', {
            familyId: this.data.familyId,
            action: 'delete',
            dishId: dish._id
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.loadDishes();
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        } finally {
          this.setData({ deletingId: '' });
        }
      }
    });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    const urls = this.data.dishes
      .map((dish) => dish.imageUrl)
      .filter(Boolean);
    wx.previewImage({ current, urls });
  },

  noop() {}
});
