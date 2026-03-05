# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Environment

This is a **WeChat Mini Program** (微信小程序). There is no build system or package manager — development is done entirely in **微信开发者工具 (WeChat DevTools)**.

- Open WeChat DevTools → Import project → Select this directory
- The AppID is already configured in `project.config.json`
- Before using the OCR feature, add `api.anthropic.com` to the domain whitelist in WeChat公众平台

There are no npm scripts, no lint commands, and no automated tests. All testing is done in the WeChat DevTools simulator or on a real device.

## Architecture

### Data Flow

All persistent state lives in `app.js` via `wx.getStorageSync/setStorageSync` under the key `baccaratData`. The global data shape is:

```js
{
  history: [{result: 'B'|'P'|'T', shoe: Number, timestamp: Number}],
  currentShoe: Number,
  apiKey: String   // Claude API key, stored locally only
}
```

Pages call `app.getCurrentShoeHistory()` to get the filtered results array for the current shoe, then pass it to utility functions.

### Key Rendering Pattern (大路 Big Road Grid)

`utils/analysis.js:buildBigRoad(history)` converts a flat `['B','P','T',...]` array into a sparse cell list `[{col, row, result, ties}]`. The index page then builds a flat array (`flatGrid`) from this and renders it with absolute positioning in WXML using `left: col*54rpx; top: row*54rpx`. The grid always has 6 rows; when a streak overflows row 5, it extends horizontally (snake-tail rule implemented in `buildBigRoad`).

### Pages

- **`pages/index/`** — Main page: big road grid, B/P/T input buttons, strategy analysis, photo OCR modal, API key modal
- **`pages/history/`** — Historical view: all shoes grouped, each with its own mini big road grid and stats

### Utilities

- **`utils/analysis.js`** — Pure functions: `buildBigRoad`, `buildBigEyeRoad`, `analyzeHistory`. No side effects. `analyzeHistory` returns up to 9 strategy recommendations (顺势/断龙/剁/双打走势/冷门回归/大势/均值回归/热庄热闲/观望) with confidence levels. Multiple strategies render as tabs in the UI.
- **`utils/imageOcr.js`** — Calls `https://api.anthropic.com/v1/messages` with `claude-opus-4-5` model via `wx.request`, sending the image as base64. Returns `{results, count, confidence, notes}`.

### Result Codes

Throughout the codebase: `'B'` = Banker (庄), `'P'` = Player (闲), `'T'` = Tie (和).

### Styling Conventions

- Dark casino theme: background `#0a1628`, gold accent `#c9a84c`
- Banker = red `#e53e3e`, Player = blue `#3182ce`, Tie = green `#38a169`
- Layout uses `rpx` units throughout for cross-device scaling
- Global styles in `app.wxss`; page-specific styles in `pages/*/` `.wxss` files
