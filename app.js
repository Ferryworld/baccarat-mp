// app.js
App({
  globalData: {
    history: [],        // 完整历史：[{result:'B'|'P'|'T', shoe:1, timestamp}]
    currentShoe: 1,     // 当前靴号
    apiKey: '',         // Claude API Key（用户自行配置）
  },

  onLaunch() {
    // 读取本地存储
    const saved = wx.getStorageSync('baccaratData');
    if (saved) {
      this.globalData.history = saved.history || [];
      this.globalData.currentShoe = saved.currentShoe || 1;
      this.globalData.apiKey = saved.apiKey || '';
    }
  },

  saveData() {
    wx.setStorageSync('baccaratData', {
      history: this.globalData.history,
      currentShoe: this.globalData.currentShoe,
      apiKey: this.globalData.apiKey,
    });
  },

  addResult(result) {
    const entry = {
      result,
      shoe: this.globalData.currentShoe,
      timestamp: Date.now(),
    };
    this.globalData.history.push(entry);
    this.saveData();
    return entry;
  },

  undoLast() {
    if (this.globalData.history.length > 0) {
      this.globalData.history.pop();
      this.saveData();
    }
  },

  newShoe() {
    this.globalData.currentShoe++;
    this.saveData();
  },

  clearCurrentShoe() {
    const shoe = this.globalData.currentShoe;
    this.globalData.history = this.globalData.history.filter(h => h.shoe !== shoe);
    this.saveData();
  },

  getCurrentShoeHistory() {
    const shoe = this.globalData.currentShoe;
    return this.globalData.history
      .filter(h => h.shoe === shoe)
      .map(h => h.result);
  },
});
