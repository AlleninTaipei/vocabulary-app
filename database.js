const Database = require('better-sqlite3');
const path = require('path');

// 建立資料庫連線
const db = new Database(path.join(__dirname, 'vocabulary.db'));

// 初始化資料表
db.exec(`
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    pos TEXT,
    explanation TEXT,
    examples TEXT,
    related TEXT,
    mastered INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

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
  const { word, pos, explanation, examples, related } = wordData;
  const stmt = db.prepare(`
    INSERT INTO words (word, pos, explanation, examples, related)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(word, pos, explanation, examples, related);
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
  close
};
