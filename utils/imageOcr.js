// utils/imageOcr.js
// 调用 Claude Vision API 识别百家乐走势图片

/**
 * 将图片文件路径转为 base64
 */
function fileToBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: res => resolve(res.data),
      fail: err => reject(err),
    });
  });
}

/**
 * 识别图片中的百家乐走势
 * @param {string} imagePath - 本地图片路径
 * @param {string} apiKey - Claude API Key
 * @returns {Promise<{results: string[], rawText: string}>}
 */
async function recognizeBaccaratImage(imagePath, apiKey) {
  if (!apiKey) {
    throw new Error('请先在设置中配置 Claude API Key');
  }

  const base64Data = await fileToBase64(imagePath);

  const prompt = `你是一个百家乐走势识别专家。请仔细分析这张图片，识别其中的百家乐结果记录。

图片可能包含：
1. 珠盘路（一排横向的圆球，红色=庄赢，蓝色=闲赢，绿色=和局）
2. 大路走势图（表格形式，红色=庄，蓝色=闲，绿色=和）
3. 手写或打印的记录（庄/B/Banker、闲/P/Player、和/T/Tie）
4. 任何形式的百家乐历史结果

请按照时间顺序（从左到右，从上到下），输出每一把的结果。

输出格式：只输出一行JSON，格式如下：
{"results":["B","P","B","T","P"],"count":5,"confidence":"high","notes":"识别说明"}

其中：
- B = 庄赢 (Banker)
- P = 闲赢 (Player)  
- T = 和局 (Tie)
- confidence = "high"/"medium"/"low"（识别置信度）
- notes = 简短说明你识别到了什么

如果图片不包含百家乐走势，返回：
{"results":[],"count":0,"confidence":"low","notes":"未识别到百家乐走势"}

只返回JSON，不要有任何其他文字。`;

  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      data: {
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      },
      success: (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`API错误: ${res.statusCode} ${JSON.stringify(res.data)}`));
          return;
        }
        try {
          const text = res.data.content[0].text.trim();
          const parsed = JSON.parse(text);
          resolve(parsed);
        } catch (e) {
          reject(new Error('解析识别结果失败，请重试'));
        }
      },
      fail: (err) => {
        reject(new Error(`网络请求失败: ${err.errMsg}`));
      },
    });
  });
}

module.exports = { recognizeBaccaratImage };
