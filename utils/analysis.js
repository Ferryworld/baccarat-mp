// utils/analysis.js

const BANKER = 'B';
const PLAYER = 'P';
const TIE = 'T';

const LABELS = { B: '庄', P: '闲', T: '和' };
const COLORS = { B: '#e53e3e', P: '#3182ce', T: '#38a169' };

/**
 * 构建大路（Big Road）数据，支持蛇尾横向溢出
 * 竖向最多 6 行，超出后横向右移（大路标准规则）
 * 返回 [{col, row, result, ties}]，col/row 为物理格子坐标
 */
function buildBigRoad(history) {
  const ROWS = 6;
  const cells = [];
  const occupied = new Set(); // "col,row"

  let curCol = 0, curRow = 0;
  let lastNonTie = null;
  let streakStartCol = 0;
  let isFirst = true;

  for (let i = 0; i < history.length; i++) {
    const r = history[i];

    if (r === TIE) {
      if (cells.length > 0) {
        cells[cells.length - 1].ties = (cells[cells.length - 1].ties || 0) + 1;
      }
      continue;
    }

    if (isFirst) {
      curCol = 0; curRow = 0;
      streakStartCol = 0;
      isFirst = false;
    } else if (r === lastNonTie) {
      // 同一连续：尝试向下，到底或被占则横向右移
      const nextRow = curRow + 1;
      if (nextRow < ROWS && !occupied.has(`${curCol},${nextRow}`)) {
        curRow = nextRow;
      } else {
        // 蛇尾：在当前行向右找空格
        let nextCol = curCol + 1;
        let snapRow = curRow;
        while (occupied.has(`${nextCol},${snapRow}`)) {
          nextCol++;
        }
        curCol = nextCol;
        curRow = snapRow;
      }
    } else {
      // 新一串：从上一串起始列的下一列开始，跳过被蛇尾占据的列
      let nextCol = streakStartCol + 1;
      while (occupied.has(`${nextCol},0`)) {
        nextCol++;
      }
      curCol = nextCol;
      curRow = 0;
      streakStartCol = nextCol;
    }

    occupied.add(`${curCol},${curRow}`);
    cells.push({ col: curCol, row: curRow, result: r, ties: 0 });
    lastNonTie = r;
  }
  return cells;
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
 * 策略优先级：高置信度优先展示；多策略并列时用 Tab 切换
 *
 * 赌场实际损耗（House Edge）参考：
 *   庄（含5%佣金）1.06% | 闲 1.24% | 和 14.36%（切勿押和）
 */
function analyzeHistory(history) {
  const nonTie = history.filter(x => x !== TIE);
  const bankerCount = history.filter(x => x === BANKER).length;
  const playerCount = history.filter(x => x === PLAYER).length;
  const tieCount = history.filter(x => x === TIE).length;
  const total = history.length;

  // ── 当前连续 streak ──────────────────────────────────────
  let streak = 0, streakType = null;
  for (let i = nonTie.length - 1; i >= 0; i--) {
    if (!streakType) { streakType = nonTie[i]; streak = 1; }
    else if (nonTie[i] === streakType) streak++;
    else break;
  }

  // ── 最近 10 把 ────────────────────────────────────────────
  const last10 = nonTie.slice(-10);
  const recentB = last10.filter(x => x === BANKER).length;
  const recentP = last10.filter(x => x === PLAYER).length;

  // ── 交替检测（最近 6 把全部交替 = 剁）────────────────────
  const last6 = nonTie.slice(-6);
  let isChop = last6.length >= 4;
  for (let i = 1; i < last6.length; i++) {
    if (last6[i] === last6[i - 1]) { isChop = false; break; }
  }

  // ── 双打走势：当前串之前 4 把形如 AABB（A≠B）────────────
  const prevNonTie = nonTie.slice(0, nonTie.length - streak); // 去掉当前连续串
  const last4prev = prevNonTie.slice(-4);
  const pairPatternBase = (
    last4prev.length === 4 &&
    last4prev[0] === last4prev[1] &&
    last4prev[2] === last4prev[3] &&
    last4prev[0] !== last4prev[2]
  );

  // ── 冷门检测：最近 8 把中一方出现 ≤ 1 次 ────────────────
  const last8 = nonTie.slice(-8);
  const bIn8 = last8.filter(x => x === BANKER).length;
  const pIn8 = last8.filter(x => x === PLAYER).length;
  const coldSide = last8.length >= 6
    ? (bIn8 <= 1 && pIn8 >= 5 ? BANKER : (pIn8 <= 1 && bIn8 >= 5 ? PLAYER : null))
    : null;

  // ── 全局庄闲比 ───────────────────────────────────────────
  const bpTotal = bankerCount + playerCount;
  const bRatioNum = bpTotal > 0 ? bankerCount / bpTotal : 0.5;

  // ═══════════════════════════════════════════════════════════
  // 策略列表（按触发条件依次压入，多策略时 Tab 展示）
  // ═══════════════════════════════════════════════════════════
  const strategies = [];

  // ① 顺势策略 ── 连续 3 把以上跟走
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

  // ② 断龙策略 ── 超长龙（≥6）后逆势等待转折（与顺势并列，供对比）
  if (streak >= 6) {
    const oppType = streakType === BANKER ? PLAYER : BANKER;
    strategies.push({
      name: '断龙策略',
      rec: oppType,
      confidence: 'low',
      confidenceLabel: '低',
      reason: `${LABELS[streakType]}已连 ${streak} 把超长龙，龙尾逆押${LABELS[oppType]}等待转折${oppType === PLAYER ? '，同省庄家佣金' : ''}`,
      icon: '🔪',
    });
  }

  // ③ 剁策略 ── 近 6 把完全交替
  if (isChop) {
    const oppType = nonTie[nonTie.length - 1] === BANKER ? PLAYER : BANKER;
    strategies.push({
      name: '剁策略',
      rec: oppType,
      confidence: 'mid',
      confidenceLabel: '中',
      reason: `近 ${last6.length} 把庄闲交替，押与上把相反的${LABELS[oppType]}${oppType === PLAYER ? '（押闲无佣金）' : ''}`,
      icon: '⚡',
    });
  }

  // ④ 双打走势 ── 前 4 把 AABB，当前开始新对
  if (pairPatternBase && streak <= 2) {
    if (streak === 1) {
      // 刚开始新对，预测再来一把完成该对
      strategies.push({
        name: '双打走势',
        rec: streakType,
        confidence: 'mid',
        confidenceLabel: '中',
        reason: `走势呈${LABELS[last4prev[0]]}${LABELS[last4prev[0]]}${LABELS[last4prev[2]]}${LABELS[last4prev[2]]}成对规律，续押${LABELS[streakType]}完成本对`,
        icon: '✌️',
      });
    } else {
      // 当前对已完成（streak=2），预测切换到对立方
      const oppType = streakType === BANKER ? PLAYER : BANKER;
      strategies.push({
        name: '双打走势',
        rec: oppType,
        confidence: 'low',
        confidenceLabel: '低',
        reason: `成对规律：当前${LABELS[streakType]}对已完成，切换押${LABELS[oppType]}${oppType === PLAYER ? '（无佣金）' : ''}`,
        icon: '✌️',
      });
    }
  }

  // ⑤ 冷门回归 ── 近 8 把某方极少出现，均值回归押冷门方
  if (coldSide) {
    const coldCount = coldSide === BANKER ? bIn8 : pIn8;
    strategies.push({
      name: '冷门回归',
      rec: coldSide,
      confidence: 'low',
      confidenceLabel: '低',
      reason: `近 ${last8.length} 把${LABELS[coldSide]}仅 ${coldCount} 次，极度冷门，均值回归押${LABELS[coldSide]}${coldSide === PLAYER ? '（押闲省佣）' : ''}`,
      icon: '❄️',
    });
  }

  // ⑥ 大势策略 ── 15 把后，庄/闲比例 >62% 跟趋势
  if (nonTie.length >= 15) {
    if (bRatioNum > 0.62 && bRatioNum < 0.68) {
      strategies.push({
        name: '大势策略',
        rec: BANKER,
        confidence: 'low',
        confidenceLabel: '低',
        reason: `本靴庄胜 ${(bRatioNum * 100).toFixed(0)}%，趋势偏庄，顺大势押庄`,
        icon: '📊',
      });
    } else if (bRatioNum < 0.38 && bRatioNum > 0.32) {
      strategies.push({
        name: '大势策略',
        rec: PLAYER,
        confidence: 'low',
        confidenceLabel: '低',
        reason: `本靴闲胜 ${((1 - bRatioNum) * 100).toFixed(0)}%，趋势偏闲，押闲同省庄家5%佣金`,
        icon: '📊',
      });
    }
  }

  // ⑦ 均值强势回归 ── 20 把后，偏差 >68% 时逆势押弱势方
  if (nonTie.length >= 20) {
    if (bRatioNum >= 0.68) {
      strategies.push({
        name: '均值回归',
        rec: PLAYER,
        confidence: 'low',
        confidenceLabel: '低',
        reason: `庄胜率高达 ${(bRatioNum * 100).toFixed(0)}%，偏差过大，反押闲等待均值回归，同省庄家5%佣金`,
        icon: '⚖️',
      });
    } else if (bRatioNum <= 0.32) {
      strategies.push({
        name: '均值回归',
        rec: BANKER,
        confidence: 'low',
        confidenceLabel: '低',
        reason: `闲胜率高达 ${((1 - bRatioNum) * 100).toFixed(0)}%，偏差过大，押庄回归（庄理论胜率占优）`,
        icon: '⚖️',
      });
    }
  }

  // ⑧ 热庄/热闲 ── 近 10 把偏差 ≥ 3 把
  if (last10.length >= 6 && recentB > recentP + 2) {
    strategies.push({
      name: '热庄策略',
      rec: BANKER,
      confidence: 'mid',
      confidenceLabel: '中',
      reason: `近10把庄 ${recentB} 闲 ${recentP}，热庄持续，顺势押庄`,
      icon: '🔥',
    });
  } else if (last10.length >= 6 && recentP > recentB + 2) {
    strategies.push({
      name: '热闲策略',
      rec: PLAYER,
      confidence: 'mid',
      confidenceLabel: '中',
      reason: `近10把庄 ${recentB} 闲 ${recentP}，热闲持续，押闲且无需支付5%庄家佣金`,
      icon: '🔥',
    });
  }

  // ⑨ 观望策略（默认）── 无明显信号时建议保守
  if (strategies.length === 0) {
    strategies.push({
      name: '观望策略',
      rec: BANKER,
      confidence: 'low',
      confidenceLabel: '低',
      reason: '走势信号不明，建议观望或减小注额。押和赌场优势高达14.36%，务必避免',
      icon: '👁️',
    });
  }

  const bRatio = bpTotal > 0
    ? (bRatioNum * 100).toFixed(1)
    : '—';

  return {
    bankerCount, playerCount, tieCount, total,
    streak, streakType, isChop, strategies, bRatio,
    recentB, recentP,
  };
}

module.exports = { buildBigRoad, buildBigEyeRoad, analyzeHistory, LABELS, COLORS };
