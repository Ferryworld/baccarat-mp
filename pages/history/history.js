// pages/history/history.js
const app = getApp();
const { buildBigRoad, analyzeHistory, LABELS } = require('../../utils/analysis');

Page({
  data: {
    groupedHistory: [],
    totalStats: {},
  },

  onShow() {
    this.loadHistory();
  },

  loadHistory() {
    const history = app.globalData.history;
    const currentShoe = app.globalData.currentShoe;

    // 按靴分组
    const shoesMap = {};
    history.forEach(entry => {
      if (!shoesMap[entry.shoe]) shoesMap[entry.shoe] = [];
      shoesMap[entry.shoe].push(entry.result);
    });

    const groupedHistory = Object.keys(shoesMap)
      .sort((a, b) => b - a)
      .map(shoe => {
        const results = shoesMap[shoe];
        const analysis = analyzeHistory(results);
        const bigRoad = buildBigRoad(results);
        const maxCol = bigRoad.reduce((m, c) => Math.max(m, c.col), 0);
        const gridCols = Math.max(maxCol + 1, 8);
        const flatGrid = [];
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < gridCols; c++) {
            const cell = bigRoad.find(b => b.row === r && b.col === c);
            flatGrid.push(cell || { empty: true, col: c, row: r });
          }
        }
        return {
          shoe: Number(shoe),
          isCurrent: Number(shoe) === currentShoe,
          results,
          analysis,
          gridCols,
          flatGrid,
          label: `第 ${shoe} 靴`,
          totalLabel: `共 ${results.length} 把`,
        };
      });

    // 全局统计
    const allResults = history.map(h => h.result);
    const totalB = allResults.filter(r => r === 'B').length;
    const totalP = allResults.filter(r => r === 'P').length;
    const totalT = allResults.filter(r => r === 'T').length;
    const totalNT = totalB + totalP;
    const totalStats = {
      total: allResults.length,
      banker: totalB,
      player: totalP,
      tie: totalT,
      bRatio: totalNT > 0 ? (totalB / totalNT * 100).toFixed(1) : '—',
      shoes: Object.keys(shoesMap).length,
    };

    this.setData({ groupedHistory, totalStats });
  },

  clearAll() {
    wx.showModal({
      title: '清空所有数据',
      content: '将删除所有靴的历史记录，不可恢复！',
      confirmText: '确认清空',
      confirmColor: '#e53e3e',
      success: (res) => {
        if (res.confirm) {
          app.globalData.history = [];
          app.globalData.currentShoe = 1;
          app.saveData();
          this.loadHistory();
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      },
    });
  },
});
