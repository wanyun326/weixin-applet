/**
 * API 接口封装
 * 统一管理后端接口调用
 */

const app = getApp();

/**
 * 上传音频并获取变声结果
 * @param {string} filePath - 音频文件临时路径
 * @param {string} effect - 音效类型（LOLI/DEEP/ROBOT/ALIEN/REVERB/ECHO/CHIPMUNK/DEMON）
 * @returns {Promise<string>} - 变声后的音频文件临时路径
 */
function processVoice(filePath, effect) {
  return new Promise((resolve, reject) => {
    wx.showLoading({ title: '正在变声中...', mask: true });

    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/process`,
      filePath: filePath,
      name: 'file',
      formData: {
        effect: effect
      },
      success(res) {
        wx.hideLoading();

        if (res.statusCode === 200) {
          // 将返回的音频数据保存为临时文件
          const fs = wx.getFileSystemManager();
          const tempPath = `${wx.env.USER_DATA_PATH}/voice_${Date.now()}.mp3`;

          // uploadFile 返回的是 ArrayBuffer，需要写入文件
          fs.writeFile({
            filePath: tempPath,
            data: res.data,  // 注意：小程序 uploadFile 返回的是 string
            encoding: 'binary',
            success() {
              resolve(tempPath);
            },
            fail(err) {
              // 如果 writeFile 失败，尝试用 base64 方式
              console.error('写入文件失败:', err);
              reject(new Error('保存变声文件失败'));
            }
          });
        } else {
          let errorMsg = '变声处理失败';
          try {
            const data = JSON.parse(res.data);
            errorMsg = data.message || errorMsg;
          } catch (e) {
            // ignore
          }
          reject(new Error(errorMsg));
        }
      },
      fail(err) {
        wx.hideLoading();
        console.error('上传失败:', err);
        reject(new Error('网络请求失败，请检查网络连接'));
      }
    });
  });
}

/**
 * 获取音效列表
 * @returns {Promise<Array>} - 音效列表
 */
function getEffects() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}/effects`,
      method: 'GET',
      success(res) {
        if (res.statusCode === 200 && res.data.code === 200) {
          resolve(res.data.data);
        } else {
          reject(new Error('获取音效列表失败'));
        }
      },
      fail(err) {
        reject(new Error('网络请求失败'));
      }
    });
  });
}

/**
 * 健康检查
 * @returns {Promise<Object>}
 */
function healthCheck() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}/health`,
      method: 'GET',
      success(res) {
        resolve(res.data);
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  processVoice,
  getEffects,
  healthCheck
};
