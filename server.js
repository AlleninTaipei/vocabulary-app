require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// 中介軟體
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 初始化 Claude API
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// 查詢單字 - 呼叫 Claude AI
app.post('/api/lookup', async (req, res) => {
  try {
    const { word } = req.body;

    if (!word || word.trim() === '') {
      return res.status(400).json({ error: '請輸入單字' });
    }

    // 先檢查資料庫是否已有這個單字
    const existing = db.getWordByWord(word.toLowerCase().trim());
    if (existing) {
      return res.json({
        word: existing.word,
        pos: existing.pos,
        explanation: existing.explanation,
        examples: JSON.parse(existing.examples || '[]'),
        related: JSON.parse(existing.related || '[]'),
        saved: true,
        id: existing.id
      });
    }

    // 呼叫 Claude API
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `你是一位友善的英語老師。請用繁體中文解釋以下英文單字，讓初學者容易理解。

單字：${word}

請用以下 JSON 格式回覆（只回覆 JSON，不要其他文字）：
{
  "word": "單字",
  "pos": "詞性（如：名詞、動詞、形容詞等）",
  "explanation": "簡單易懂的中文解釋（2-3句話）",
  "examples": [
    {"en": "英文例句1", "zh": "中文翻譯1"},
    {"en": "英文例句2", "zh": "中文翻譯2"}
  ],
  "related": ["相關單字1", "相關單字2", "相關單字3"]
}`
        }
      ]
    });

    // 解析 Claude 的回應（去除可能包裹的 markdown code fence）
    const rawText = message.content[0].text;
    const responseText = rawText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const wordData = JSON.parse(responseText);

    // 計算 API 使用量和費用
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;

    // Claude Haiku 4.5 價格：Input $0.80/1M, Output $4/1M
    const inputCost = (inputTokens / 1000000) * 0.80;
    const outputCost = (outputTokens / 1000000) * 4;
    const totalCost = inputCost + outputCost;

    res.json({
      ...wordData,
      saved: false,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        estimated_cost_usd: totalCost.toFixed(6),
        model: 'claude-haiku-4-5-20251001'
      }
    });

  } catch (error) {
    console.error('查詢錯誤:', error);
    const detail = error?.message || String(error);
    res.status(500).json({
      error: `查詢失敗: ${detail}`
    });
  }
});

// 取得所有已儲存的單字
app.get('/api/words', (req, res) => {
  try {
    const words = db.getAllWords();
    // 解析 JSON 欄位
    const formattedWords = words.map(w => ({
      ...w,
      examples: JSON.parse(w.examples || '[]'),
      related: JSON.parse(w.related || '[]')
    }));
    res.json(formattedWords);
  } catch (error) {
    console.error('取得單字錯誤:', error);
    res.status(500).json({ error: '取得單字失敗' });
  }
});

// 取得需要複習的單字
app.get('/api/words/review', (req, res) => {
  try {
    const words = db.getWordsToReview();
    const formattedWords = words.map(w => ({
      ...w,
      examples: JSON.parse(w.examples || '[]'),
      related: JSON.parse(w.related || '[]')
    }));
    res.json(formattedWords);
  } catch (error) {
    console.error('取得複習單字錯誤:', error);
    res.status(500).json({ error: '取得複習單字失敗' });
  }
});

// 儲存單字
app.post('/api/words', (req, res) => {
  try {
    const { word, pos, explanation, examples, related } = req.body;

    // 檢查是否已存在
    const existing = db.getWordByWord(word.toLowerCase().trim());
    if (existing) {
      return res.status(400).json({ error: '這個單字已經存在' });
    }

    const newWord = db.addWord({
      word: word.toLowerCase().trim(),
      pos,
      explanation,
      examples: JSON.stringify(examples),
      related: JSON.stringify(related)
    });

    res.json({
      ...newWord,
      examples: JSON.parse(newWord.examples || '[]'),
      related: JSON.parse(newWord.related || '[]')
    });
  } catch (error) {
    console.error('儲存單字錯誤:', error);
    res.status(500).json({ error: '儲存失敗' });
  }
});

// 更新單字（熟悉度）
app.patch('/api/words/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { mastered } = req.body;

    const updated = db.updateWord(id, { mastered });
    if (!updated) {
      return res.status(404).json({ error: '找不到這個單字' });
    }

    res.json({
      ...updated,
      examples: JSON.parse(updated.examples || '[]'),
      related: JSON.parse(updated.related || '[]')
    });
  } catch (error) {
    console.error('更新單字錯誤:', error);
    res.status(500).json({ error: '更新失敗' });
  }
});

// 刪除單字
app.delete('/api/words/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.deleteWord(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '找不到這個單字' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('刪除單字錯誤:', error);
    res.status(500).json({ error: '刪除失敗' });
  }
});

// 啟動伺服器
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     個人字典 App 已啟動！              ║
║     http://localhost:${PORT}              ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown — 確保 port 被正確釋放
function gracefulShutdown(signal) {
  console.log(`\n收到 ${signal}，正在關閉伺服器...`);
  server.close(() => {
    console.log('伺服器已關閉');
    db.close();
    process.exit(0);
  });
  // 如果 5 秒內未能關閉，強制結束
  setTimeout(() => {
    console.error('無法正常關閉，強制結束');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
