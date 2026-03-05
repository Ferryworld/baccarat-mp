// pages/index/index.js
const app = getApp();
const { buildBigRoad, analyzeHistory, LABELS, COLORS } = require('../../utils/analysis');
const { recognizeBaccaratImage } = require('../../utils/imageOcr');

const CELL_SIZE = 52; // rpx per cell
const GRID_ROWS = 6;

Page({
  data: {
    history: [],          // 当前靴历史
    bigRoad: [],          // 大路数据
    gridCols: 12,
    gridRows: GRID_ROWS,
    roadGrid: [],         // 二维渲染数组
    analysis: null,
    currentStrategy: 0,
    shoeNumber: 1,

    // 识别相关
    scanning: false,
    scanResult: null,
    showScanPreview: false,
    scannedImage: '',
    showApiModal: false,
    apiKeyInput: '',
    hasApiKey: false,

    // 动画
    newBead: null,
  },

  onLoad() {
    this.refreshData();
  },

  onShow() {
    this.refreshData();
    const apiKey = app.globalData.apiKey;
    this.setData({ hasApiKey: !!apiKey, apiKeyInput: apiKey || '' });
  },

  refreshData() {
    const history = app.getCurrentShoeHistory();
    const bigRoad = buildBigRoad(history);
    const analysis = history.length > 0 ? analyzeHistory(history) : null;

    const maxCol = bigRoad.reduce((m, c) => Math.max(m, c.col), 0);
    const gridCols = Math.max(maxCol + 2, 14);

    // 构建二维数组
    const roadGrid = Array.from({ length: GRID_ROWS }, () => Array(gridCols).fill(null));
    bigRoad.forEach(c => {
      if (c.row < GRID_ROWS && c.col < gridCols) {
        roadGrid[c.row][c.col] = c;
      }
    });

    // 扁平化为 WXML 可用
    const flatGrid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let col = 0; col < gridCols; col++) {
        flatGrid.push(roadGrid[r][col] || { empty: true, row: r, col });
      }
    }

    this.setData({
      history,
      bigRoad,
      gridCols,
      analysis,
      flatGrid,
      shoeNumber: app.globalData.currentShoe,
      currentStrategy: 0,
    });
  },

  addResult(e) {
    const result = e.currentTarget.dataset.result;
    app.addResult(result);

    // 触发入珠动画
    this.setData({ newBead: result });
    setTimeout(() => this.setData({ newBead: null }), 600);

    this.refreshData();
    wx.vibrateShort({ type: 'medium' });
  },

  undo() {
    if (this.data.history.length === 0) return;
    app.undoLast();
    this.refreshData();
    wx.vibrateShort({ type: 'light' });
  },

  newShoe() {
    wx.showModal({
      title: '开新靴',
      content: '确定开始新的一靴？当前数据将保留在历史记录中。',
      confirmText: '开新靴',
      confirmColor: '#c9a84c',
      success: (res) => {
        if (res.confirm) {
          app.newShoe();
          this.refreshData();
          wx.showToast({ title: `第 ${app.globalData.currentShoe} 靴开始`, icon: 'none' });
        }
      },
    });
  },

  clearShoe() {
    wx.showModal({
      title: '清空本靴',
      content: '确定清空当前靴的所有记录？',
      confirmText: '清空',
      confirmColor: '#e53e3e',
      success: (res) => {
        if (res.confirm) {
          app.clearCurrentShoe();
          this.refreshData();
        }
      },
    });
  },

  switchStrategy(e) {
    this.setData({ currentStrategy: e.currentTarget.dataset.index });
  },

  // ========== 拍照识别 ==========
  scanImage() {
    const apiKey = app.globalData.apiKey;
    if (!apiKey) {
      this.setData({ showApiModal: true });
      return;
    }
    this.chooseAndScan();
  },

  chooseAndScan() {
    wx.showActionSheet({
      itemList: ['拍摄走势图', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType,
          camera: 'back',
          success: (mediaRes) => {
            const filePath = mediaRes.tempFiles[0].tempFilePath;
            this.setData({
              scannedImage: filePath,
              showScanPreview: true,
              scanResult: null,
            });
            this.doRecognize(filePath);
          },
        });
      },
    });
  },

  async doRecognize(filePath) {
    this.setData({ scanning: true, scanResult: null });

    try {
      const result = await recognizeBaccaratImage(filePath, app.globalData.apiKey);
      this.setData({
        scanning: false,
        scanResult: result,
      });
    } catch (err) {
      this.setData({ scanning: false });
      wx.showModal({
        title: '识别失败',
        content: err.message,
        showCancel: false,
        confirmText: '好的',
      });
    }
  },

  retakeScan() {
    this.chooseAndScan();
  },

  confirmScanImport() {
    const { scanResult } = this.data;
    if (!scanResult || !scanResult.results || scanResult.results.length === 0) {
      wx.showToast({ title: '没有可导入的数据', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认导入',
      content: `识别到 ${scanResult.results.length} 把记录，是否导入到当前靴？`,
      confirmText: '导入',
      confirmColor: '#c9a84c',
      success: (res) => {
        if (res.confirm) {
          scanResult.results.forEach(r => {
            if (['B', 'P', 'T'].includes(r)) {
              app.addResult(r);
            }
          });
          this.setData({ showScanPreview: false, scanResult: null, scannedImage: '' });
          this.refreshData();
          wx.showToast({
            title: `已导入 ${scanResult.results.length} 把`,
            icon: 'success',
          });
        }
      },
    });
  },

  closeScanPreview() {
    this.setData({ showScanPreview: false, scanResult: null, scannedImage: '' });
  },

  // ========== API Key 设置 ==========
  onApiKeyInput(e) {
    this.setData({ apiKeyInput: e.detail.value });
  },

  saveApiKey() {
    const key = this.data.apiKeyInput.trim();
    if (!key) {
      wx.showToast({ title: '请输入 API Key', icon: 'none' });
      return;
    }
    app.globalData.apiKey = key;
    app.saveData();
    this.setData({ showApiModal: false, hasApiKey: true });
    wx.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => this.chooseAndScan(), 500);
  },

  closeApiModal() {
    this.setData({ showApiModal: false });
  },
});
