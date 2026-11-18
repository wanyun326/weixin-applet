// 餐后记录：为当前当餐添加文字和照片，然后结束当餐
const app = getApp();
const db = require('../../utils/db');
const store = require('../../utils/store');

const MAX_PHOTOS = 9;

Page({
  data: {
    familyId: '',
    mealId: '',
    mealLabel: '',
    orders: [],
    postNote: '',
    photos: [],
    maxPhotos: MAX_PHOTOS,
    loading: true,
    submitting: false
  },

  onLoad(query) {
    const family =
      (app.globalData.currentFamilyId && {
        _id: app.globalData.currentFamilyId
      }) ||
      store.getCurrentFamily();
    if (!family || !family._id || !query.mealId) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

    let mealLabel = '';
    try {
      mealLabel = query.mealLabel ? decodeURIComponent(query.mealLabel) : '';
    } catch (err) {
      mealLabel = query.mealLabel || '';
    }
    this.setData({
      familyId: family._id,
      mealId: query.mealId,
      mealLabel
    });
    this.loadOrders();
  },

  async loadOrders() {
    try {
      const data = await db.callFunction('addOrder', {
        action: 'list',
        familyId: this.data.familyId,
        mealId: this.data.mealId
      });
      this.setData({
        orders: ((data && data.orders) || []).sort(
          (left, right) =>
            new Date(left.createdAt || 0) - new Date(right.createdAt || 0)
        ),
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '当餐菜品加载失败', icon: 'none' });
    }
  },

  onNoteInput(e) {
    this.setData({ postNote: e.detail.value });
  },

  async onChoosePhotos() {
    const remaining = MAX_PHOTOS - this.data.photos.length;
    if (remaining <= 0) {
      wx.showToast({ title: `最多上传 ${MAX_PHOTOS} 张照片`, icon: 'none' });
      return;
    }
    try {
      let paths = [];
      if (wx.chooseMedia) {
        const res = await new Promise((resolve, reject) => {
          wx.chooseMedia({
            count: remaining,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            sizeType: ['compressed'],
            success: resolve,
            fail: reject
          });
        });
        paths = (res.tempFiles || []).map((file) => file.tempFilePath);
      } else {
        const res = await new Promise((resolve, reject) => {
          wx.chooseImage({
            count: remaining,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject
          });
        });
        paths = res.tempFilePaths || [];
      }
      if (paths.length) {
        this.setData({
          photos: this.data.photos.concat(paths).slice(0, MAX_PHOTOS)
        });
      }
    } catch (err) {
      if (!/cancel/i.test((err && err.errMsg) || '')) {
        wx.showToast({ title: '选择照片失败', icon: 'none' });
      }
    }
  },

  removePhoto(e) {
    const index = Number(e.currentTarget.dataset.index);
    const photos = this.data.photos.slice();
    photos.splice(index, 1);
    this.setData({ photos });
  },

  previewPhoto(e) {
    const current = e.currentTarget.dataset.url;
    wx.previewImage({ current, urls: this.data.photos });
  },

  uploadPhoto(tempFilePath, index) {
    const extMatch = tempFilePath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const ext = extMatch ? extMatch[1] : 'jpg';
    const cloudPath = `meal-records/${this.data.familyId}/${
      this.data.mealId
    }/${Date.now()}_${index}_${Math.random()
      .toString(36)
      .slice(2, 7)}.${ext}`;
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
        success: (res) => resolve(res.fileID),
        fail: (err) => reject(new Error(err.errMsg || '照片上传失败'))
      });
    });
  },

  async uploadAllPhotos() {
    const fileIDs = [];
    try {
      for (let index = 0; index < this.data.photos.length; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        const fileID = await this.uploadPhoto(this.data.photos[index], index);
        fileIDs.push(fileID);
      }
      return fileIDs;
    } catch (err) {
      if (fileIDs.length) {
        try {
          await this.deleteCloudFiles(fileIDs);
        } catch (cleanupErr) {
          console.warn('清理未使用照片失败', cleanupErr);
        }
      }
      throw err;
    }
  },

  async cleanupFiles(fileIDs) {
    if (!fileIDs.length) return;
    try {
      await this.deleteCloudFiles(fileIDs);
    } catch (err) {
      console.warn('清理未保存照片失败', err);
    }
  },

  deleteCloudFiles(fileList) {
    return new Promise((resolve, reject) => {
      wx.cloud.deleteFile({
        fileList,
        success: resolve,
        fail: reject
      });
    });
  },

  async submitClose(photoFileIDs) {
    await db.callFunction('closeMeal', {
      familyId: this.data.familyId,
      mealId: this.data.mealId,
      postNote: (this.data.postNote || '').trim(),
      photoFileIDs
    });
    wx.showModal({
      title: '这一餐已结束',
      content: '餐后记录已保存，可以在历史当餐中再次查看。',
      showCancel: false,
      success: () => {
        wx.redirectTo({ url: '/pages/meal-history/meal-history' });
      }
    });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (!(this.data.postNote || '').trim() && !this.data.photos.length) {
      wx.showToast({ title: '写点记录或选择照片吧', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    let uploadedFileIDs = [];
    try {
      uploadedFileIDs = await this.uploadAllPhotos();
      await this.submitClose(uploadedFileIDs);
    } catch (err) {
      await this.cleanupFiles(uploadedFileIDs);
      this.setData({ submitting: false });
      wx.showToast({ title: err.message || '餐后记录保存失败', icon: 'none' });
    }
  },

  onDirectClose() {
    if (this.data.submitting) return;
    wx.showModal({
      title: '直接结束当餐',
      content: '不保存餐后文字和照片，确定直接结束吗？',
      confirmText: '直接结束',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ submitting: true });
        try {
          await this.submitClose([]);
        } catch (err) {
          this.setData({ submitting: false });
          wx.showToast({ title: err.message || '结束当餐失败', icon: 'none' });
        }
      }
    });
  }
});
