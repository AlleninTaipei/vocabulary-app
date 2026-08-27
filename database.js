const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 建立資料庫連線
const db = new DatabaseSync(path.join(__dirname, 'vocabulary.db'));

// 音檔快取實體檔案存放目錄（與 vocabulary.db 同層）
const AUDIO_CACHE_DIR = path.join(__dirname, 'audio-cache');
fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });

// 初始化資料表
db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    pos TEXT,
    explanation TEXT,
    cobuild TEXT,
    examples TEXT,
    related TEXT,
    mastered INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 舊資料庫可能沒有 cobuild 欄位, 檢查後補上
const existingColumns = db.prepare(`PRAGMA table_info(words)`).all();
if (!existingColumns.some(c => c.name === 'cobuild')) {
  db.exec(`ALTER TABLE words ADD COLUMN cobuild TEXT`);
}

// 語音朗讀音檔快取（同一段文字 + 語音，只合成一次）
db.exec(`
  CREATE TABLE IF NOT EXISTS audio_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text_hash TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(text_hash, voice_id)
  )
`);

function hashText(text) {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

// 查詢語音快取，找到就回傳資料列（含 file_path），否則回傳 undefined
function getAudioCache(text, voiceId) {
  const hash = hashText(text);
  return db.prepare('SELECT * FROM audio_cache WHERE text_hash = ? AND voice_id = ?').get(hash, voiceId);
}

// 儲存合成好的音檔（寫入實體檔案 + 建立索引），回傳檔案路徑
function saveAudioCache(text, voiceId, wavBuffer) {
  const hash = hashText(text);
  const fileName = `${hash}_${voiceId}.wav`;
  const filePath = path.join(AUDIO_CACHE_DIR, fileName);
  fs.writeFileSync(filePath, wavBuffer);
  db.prepare(`
    INSERT OR IGNORE INTO audio_cache (text_hash, voice_id, file_path)
    VALUES (?, ?, ?)
  `).run(hash, voiceId, filePath);
  return filePath;
}

// 取得所有單字
function getAllWords() {
  return db.prepare('SELECT * FROM words ORDER BY created_at DESC').all();
}

// 根據 ID 取得單字
function getWordById(id) {
  return db.prepare('SELECT * FROM words WHERE id = ?').get(id);
}

// 根據單字查詢
function getWordByWord(word) {
  return db.prepare('SELECT * FROM words WHERE word = ?').get(word);
}

// 新增單字
function addWord(wordData) {
  const { word, pos, explanation, cobuild, examples, related } = wordData;
  const stmt = db.prepare(`
    INSERT INTO words (word, pos, explanation, cobuild, examples, related)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(word, pos, explanation, cobuild || null, examples, related);
  return getWordById(result.lastInsertRowid);
}

// 更新單字（用於更新熟悉度）
function updateWord(id, updates) {
  const { mastered } = updates;
  if (mastered !== undefined) {
    db.prepare('UPDATE words SET mastered = ? WHERE id = ?').run(mastered, id);
  }
  return getWordById(id);
}

// 刪除單字
function deleteWord(id) {
  return db.prepare('DELETE FROM words WHERE id = ?').run(id);
}

// 取得需要複習的單字
function getWordsToReview() {
  return db.prepare('SELECT * FROM words WHERE mastered = 0 ORDER BY RANDOM()').all();
}

// 關閉資料庫連線
function close() {
  db.close();
}

module.exports = {
  getAllWords,
  getWordById,
  getWordByWord,
  addWord,
  updateWord,
  deleteWord,
  getWordsToReview,
  getAudioCache,
  saveAudioCache,
  close
};
