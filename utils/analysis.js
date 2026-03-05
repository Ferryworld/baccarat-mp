// utils/analysis.js

const BANKER = 'B';
const PLAYER = 'P';
const TIE = 'T';

const LABELS = { B: '庄', P: '闲', T: '和' };
const COLORS = { B: '#e53e3e', P: '#3182ce', T: '#38a169' };

/**
 * 构建大路（Big Road）数据
 * 返回 [{col, row, result, ties}]
 */
function buildBigRoad(history) {
  const grid = [];
  let col = 0, row = 0;
  let lastNonTie = null;

  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (r === TIE) {
      if (grid.length > 0) {
        grid[grid.length - 1].ties = (grid[grid.length - 1].ties || 0) + 1;
      }
      continue;
    }
    if (lastNonTie === null) {
      col = 0; row = 0;
    } else if (r === lastNonTie) {
      row++;
    } else {
      col++; row = 0;
    }
    grid.push({ col, row, result: r, ties: 0 });
    lastNonTie = r;
  }
  return grid;
}

/**
 * 构建大眼仔（Big Eye Road）
 */
function buildBigEyeRoad(bigRoad) {
  const result = [];
  if (bigRoad.length < 2) return result;

  for (let i = 1; i < bigRoad.length; i++) {
    const cur = bigRoad[i];
    let ref;
    if (cur.row === 0) {
      // 换列：比较(col-1, row)和(col-2, row)
      const refA = bigRoad.find(c => c.col === cur.col - 1 && c.row === cur.row);
      const refB = bigRoad.find(c => c.col === cur.col - 2 && c.row === cur.row);
      ref = refA && refB ? (refA.result === refB.result ? 'R' : 'B') : null;
    } else {
      // 同列：比较(col, row-1)和(col-1, row-1)
      const refA = bigRoad.find(c => c.col === cur.col && c.row === cur.row - 1);
      const refB = bigRoad.find(c => c.col === cur.col - 1 && c.row === cur.row - 1);
      ref = refA && refB ? (refA.result === refB.result ? 'R' : 'B') : null;
    }
    if (ref) result.push({ col: cur.col, row: cur.row, result: ref });
  }
  return result;
}

/**
 * 综合策略分析
 */
function analyzeHistory(history) {
  const nonTie = history.filter(x => x !== TIE);
  const bankerCount = history.filter(x => x === BANKER).length;
  const playerCount = history.filter(x => x === PLAYER).length;
  const tieCount = history.filter(x => x === TIE).length;
  const total = history.length;

  // 当前连续
  let streak = 0, streakType = null;
  for (let i = nonTie.length - 1; i >= 0; i--) {
    if (!streakType) { streakType = nonTie[i]; streak = 1; }
    else if (nonTie[i] === streakType) streak++;
    else break;
  }

  // 最近10把
  const last10 = nonTie.slice(-10);
  const recentB = last10.filter(x => x === BANKER).length;
  const recentP = last10.filter(x => x === PLAYER).length;

  // 交替检测（最近6把）
  const last6 = nonTie.slice(-6);
  let isChop = last6.length >= 4;
  for (let i = 1; i < last6.length; i++) {
    if (last6[i] === last6[i - 1]) { isChop = false; break; }
  }

  // 构建策略列表
  const strategies = [];

  if (streak >= 3) {
    strategies.push({
      name: '顺势策略',
      rec: streakType,
      confidence: streak >= 5 ? 'high' : streak >= 4 ? 'mid' : 'low',
      confidenceLabel: streak >= 5 ? '高' : streak >= 4 ? '中' : '低',
      reason: `${LABELS[streakType]}已连续 ${streak} 把，顺势押${LABELS[streakType]}`,
      icon: '🐉',
    });
  }

  if (isChop) {
    const oppType = nonTie[nonTie.length - 1] === BANKER ? PLAYER : BANKER;
    strategies.push({
      name: '剁策略',
      rec: oppType,
      confidence: 'mid',
      confidenceLabel: '中',
      reason: `近${last6.length}把庄闲交替，押与上把相反的${LABELS[oppType]}`,
      icon: '⚡',
    });
  }

  if (nonTie.length >= 15) {
    const bRatio = bankerCount / (bankerCount + playerCount);
    if (bRatio > 0.6) {
      strategies.push({
        name: '大势策略',
        rec: BANKER,
        confidence: 'low',
        confidenceLabel: '低',
        reason: `本靴庄胜率 ${(bRatio * 100).toFixed(0)}%，整体偏庄`,
        icon: '📊',
      });
    } else if (bRatio < 0.4) {
      strategies.push({
        name: '大势策略',
        rec: PLAYER,
        confidence: 'low',
        confidenceLabel: '低',
        reason: `本靴闲胜率 ${((1-bRatio)*100).toFixed(0)}%，整体偏闲`,
        icon: '📊',
      });
    }
  }

  if (last10.length >= 6 && recentB > recentP + 2) {
    strategies.push({
      name: '热庄策略',
      rec: BANKER,
      confidence: 'mid',
      confidenceLabel: '中',
      reason: `近10把庄${recentB}闲${recentP}，近期热庄`,
      icon: '🔥',
    });
  } else if (last10.length >= 6 && recentP > recentB + 2) {
    strategies.push({
      name: '热闲策略',
      rec: PLAYER,
      confidence: 'mid',
      confidenceLabel: '中',
      reason: `近10把庄${recentB}闲${recentP}，近期热闲`,
      icon: '🔥',
    });
  }

  if (strategies.length === 0) {
    strategies.push({
      name: '默认策略',
      rec: BANKER,
      confidence: 'low',
      confidenceLabel: '低',
      reason: '暂无明显走势，理论押庄胜率最优（House Edge 1.06%）',
      icon: '💡',
    });
  }

  const bRatio = (bankerCount + playerCount) > 0
    ? (bankerCount / (bankerCount + playerCount) * 100).toFixed(1)
    : '—';

  return {
    bankerCount, playerCount, tieCount, total,
    streak, streakType, isChop, strategies, bRatio,
    recentB, recentP,
  };
}

module.exports = { buildBigRoad, buildBigEyeRoad, analyzeHistory, LABELS, COLORS };
