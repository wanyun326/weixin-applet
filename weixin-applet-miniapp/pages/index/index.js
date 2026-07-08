// pages/index/index.js
const audio = require('../../utils/audio');
const api = require('../../utils/api');

// 音效配置（带图标的本地映射）
const EFFECTS = [
  { key: 'LOLI',     name: '萝莉音',  icon: '🧒', desc: '可爱萝莉音效' },
  { key: 'DEEP',     name: '大叔音',  icon: '👨',  desc: '低沉大叔音效' },
  { key: 'ROBOT',    name: '机器人',  icon: '🤖', desc: '机械机器人音效' },
  { key: 'ALIEN',    name: '外星人',  icon: '👽', desc: '神秘外星人音效' },
  { key: 'REVERB',   name: '混响',    icon: '🎵', desc: 'KTV混响效果' },
  { key: 'ECHO',     name: '回声',    icon: '🔊', desc: '山谷回声效果' },
  { key: 'CHIPMUNK', name: '花栗鼠',  icon: '🐿️', desc: '超级高音效果' },
  { key: 'DEMON',    name: '恶魔',    icon: '😈', desc: '低沉恶魔音效' }
];

Page({
  data: {
    effects: EFFECTS,                    // 音效列表
    selectedEffect: 'LOLI',              // 当前选中的音效
    selectedEffectName: '萝莉音',        // 当前音效名称
    isRecording: false,                  // 是否正在录音
    recordingDuration: 0,                // 录音时长（秒）
    recordedFilePath: '',                // 录音文件路径
    processedFilePath: '',               // 变声后的文件路径
    isPlaying: false,                    // 是否正在播放原声
    isPlayingProcessed: false,           // 是否正在播放变声
    isProcessing: false                  // 是否正在变声处理
  },

  /** 录音计时器 */
  _timer: null,

  onLoad() {
    // 初始化录音管理器
    audio.initRecorder({
      onStart: () => {
        this.setData({ isRecording: true, recordingDuration: 0 });
        this._startTimer();
      },
      onStop: (res) => {
        this._stopTimer();
        this.setData({
          isRecording: false,
          recordedFilePath: res.tempFilePath
        });
        wx.showToast({ title: '录音完成', icon: 'success' });
      },
      onError: (err) => {
        this._stopTimer();
        this.setData({ isRecording: false });
        wx.showToast({ title: '录音失败', icon: 'error' });
        console.error('录音错误:', err);
      }
    });
  },

  onUnload() {
    this._stopTimer();
    audio.stopAudio();
  },

  /**
   * 选择音效
   */
  onSelectEffect(e) {
    const key = e.currentTarget.dataset.key;
    const effect = EFFECTS.find(item => item.key === key);
    this.setData({
      selectedEffect: key,
      selectedEffectName: effect ? effect.name : '',
      // 切换音效后清除之前的变声结果
      processedFilePath: ''
    });
  },

  /**
   * 开始录音（长按）
   */
  async onRecordStart() {
    // 检查录音权限
    const hasPermission = await audio.checkRecordPermission();
    if (!hasPermission) return;

    // 清除之前的状态
    this.setData({
      recordedFilePath: '',
      processedFilePath: '',
      isPlaying: false,
      isPlayingProcessed: false
    });

    audio.startRecording();
  },

  /**
   * 停止录音（松开）
   */
  onRecordEnd() {
    if (this.data.isRecording) {
      audio.stopRecording();
    }
  },

  /**
   * 播放原声
   */
  onPlay() {
    if (!this.data.recordedFilePath) return;

    this.setData({ isPlaying: true });
    audio.playAudio(this.data.recordedFilePath, {
      onEnded: () => this.setData({ isPlaying: false }),
      onError: () => {
        this.setData({ isPlaying: false });
        wx.showToast({ title: '播放失败', icon: 'error' });
      }
    });
  },

  /**
   * 停止播放原声
   */
  onStopPlay() {
    audio.stopAudio();
    this.setData({ isPlaying: false });
  },

  /**
   * 开始变声
   */
  async onTransform() {
    if (this.data.isProcessing) return;
    if (!this.data.recordedFilePath) {
      wx.showToast({ title: '请先录音', icon: 'none' });
      return;
    }

    this.setData({ isProcessing: true });

    try {
      const processedPath = await api.processVoice(
        this.data.recordedFilePath,
        this.data.selectedEffect
      );

      this.setData({
        processedFilePath: processedPath,
        isProcessing: false
      });

      wx.showToast({ title: '变声成功！', icon: 'success' });

      // 自动播放变声结果
      this.onPlayProcessed();

    } catch (err) {
      this.setData({ isProcessing: false });
      wx.showToast({ title: err.message || '变声失败', icon: 'error' });
      console.error('变声错误:', err);
    }
  },

  /**
   * 播放变声结果
   */
  onPlayProcessed() {
    if (!this.data.processedFilePath) return;

    this.setData({ isPlayingProcessed: true });
    audio.playAudio(this.data.processedFilePath, {
      onEnded: () => this.setData({ isPlayingProcessed: false }),
      onError: () => {
        this.setData({ isPlayingProcessed: false });
        wx.showToast({ title: '播放失败', icon: 'error' });
      }
    });
  },

  /**
   * 停止播放变声结果
   */
  onStopPlayProcessed() {
    audio.stopAudio();
    this.setData({ isPlayingProcessed: false });
  },

  /**
   * 重置（重新录音）
   */
  onReset() {
    audio.stopAudio();
    this.setData({
      recordedFilePath: '',
      processedFilePath: '',
      isPlaying: false,
      isPlayingProcessed: false,
      recordingDuration: 0
    });
    wx.showToast({ title: '已重置', icon: 'success' });
  },

  /**
   * 开始录音计时
   */
  _startTimer() {
    this._timer = setInterval(() => {
      this.setData({
        recordingDuration: this.data.recordingDuration + 1
      });
    }, 1000);
  },

  /**
   * 停止录音计时
   */
  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
});
