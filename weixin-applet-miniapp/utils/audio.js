/**
 * 音频工具类
 * 封装录音和播放功能
 */

/** 录音管理器 */
const recorderManager = wx.getRecorderManager();

/** 音频播放上下文 */
let innerAudioContext = null;

/**
 * 初始化录音管理器事件
 * @param {Object} callbacks - 回调函数集合
 * @param {Function} callbacks.onStart - 录音开始回调
 * @param {Function} callbacks.onStop - 录音结束回调，参数为 { tempFilePath }
 * @param {Function} callbacks.onError - 录音错误回调
 * @param {Function} callbacks.onFrameRecorded - 帧录制回调（可用于实时波形）
 */
function initRecorder(callbacks = {}) {
  recorderManager.onStart(() => {
    console.log('录音开始');
    callbacks.onStart && callbacks.onStart();
  });

  recorderManager.onStop((res) => {
    console.log('录音结束:', res);
    callbacks.onStop && callbacks.onStop(res);
  });

  recorderManager.onError((err) => {
    console.error('录音错误:', err);
    callbacks.onError && callbacks.onError(err);
  });

  recorderManager.onFrameRecorded((res) => {
    callbacks.onFrameRecorded && callbacks.onFrameRecorded(res);
  });
}

/**
 * 开始录音
 */
function startRecording() {
  recorderManager.start({
    duration: 60000,        // 最长录音时长 60 秒
    sampleRate: 16000,      // 采样率
    numberOfChannels: 1,    // 单声道
    encodeBitRate: 96000,   // 编码码率
    format: 'mp3',          // 录音格式
    frameSize: 50           // 帧大小（KB），用于 onFrameRecorded
  });
}

/**
 * 停止录音
 */
function stopRecording() {
  recorderManager.stop();
}

/**
 * 播放音频
 * @param {string} src - 音频文件路径
 * @param {Object} callbacks - 回调函数
 * @param {Function} callbacks.onEnded - 播放结束回调
 * @param {Function} callbacks.onError - 播放错误回调
 * @returns {Object} - 音频上下文
 */
function playAudio(src, callbacks = {}) {
  // 先停止之前的播放
  stopAudio();

  innerAudioContext = wx.createInnerAudioContext();
  innerAudioContext.src = src;
  innerAudioContext.autoplay = true;

  innerAudioContext.onEnded(() => {
    console.log('播放结束');
    callbacks.onEnded && callbacks.onEnded();
  });

  innerAudioContext.onError((err) => {
    console.error('播放错误:', err);
    callbacks.onError && callbacks.onError(err);
  });

  return innerAudioContext;
}

/**
 * 停止播放
 */
function stopAudio() {
  if (innerAudioContext) {
    innerAudioContext.stop();
    innerAudioContext.destroy();
    innerAudioContext = null;
  }
}

/**
 * 检查录音权限
 * @returns {Promise<boolean>}
 */
function checkRecordPermission() {
  return new Promise((resolve) => {
    wx.authorize({
      scope: 'scope.record',
      success() {
        resolve(true);
      },
      fail() {
        wx.showModal({
          title: '提示',
          content: '需要录音权限才能使用变声器，请在设置中开启',
          confirmText: '去设置',
          success(res) {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
        resolve(false);
      }
    });
  });
}

module.exports = {
  initRecorder,
  startRecording,
  stopRecording,
  playAudio,
  stopAudio,
  checkRecordPermission,
  recorderManager
};
