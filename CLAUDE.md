# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

「我的單字本」是一個全棧 Node.js 英文單字學習 Web 應用，整合 Claude AI 生成單字解釋，搭配 SQLite 儲存，並提供閃示卡複習功能。

## 開發指令

```bash
# 安裝依賴
npm install

# 開發模式（Node.js --watch 自動重啟）
npm run dev

# 生產環境啟動
npm start
```

兩個指令都會自動清除佔用 Port 3000 的進程（透過 `prestart`/`predev` 鉤子）。應用程式執行於 `http://localhost:3000`。

**注意**：目前無測試框架、無 ESLint/Prettier 設定。

## 環境設定

需在根目錄建立 `.env` 檔案（參考 `.env.example`）：

```
ANTHROPIC_API_KEY=sk-ant-api03-...
PORT=3000   # 可選，預設 3000
```

## 架構

```
Browser (SPA) ←→ Express Server (server.js) ←→ SQLite (database.js)
                            ↕
                    Claude API (Haiku model)
```

### 後端 (`server.js` + `database.js`)

- **`server.js`**：Express 伺服器，定義所有 REST API 路由，整合 Claude API（`claude-3-haiku-20240307`，最大 1024 tokens）
- **`database.js`**：SQLite 操作封裝層（使用 `better-sqlite3` 同步 API），提供 CRUD 函數

### API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/api/lookup` | 查詢單字（先查 DB，若無則呼叫 Claude AI）|
| `GET` | `/api/words` | 取得所有已儲存單字 |
| `GET` | `/api/words/review` | 取得未掌握單字（`mastered=0`，隨機順序）|
| `POST` | `/api/words` | 儲存新單字 |
| `PATCH` | `/api/words/:id` | 更新熟悉度 |
| `DELETE` | `/api/words/:id` | 刪除單字 |

### 資料庫結構

`words` 資料表的 `examples` 和 `related` 欄位儲存 JSON 字串（SQLite 不支援陣列）：

```sql
examples TEXT  -- JSON: [{"en":"...", "zh":"..."}]
related  TEXT  -- JSON: ["word1", "word2"]
mastered INTEGER DEFAULT 0  -- 0=未掌握, 1=已掌握
```

### 前端 (`public/`)

- **`index.html`**：三分頁 SPA（查單字 / 我的字典 / 閃示卡），使用 Tailwind CSS CDN
- **`app.js`**：全部前端邏輯，以原生 JS + Fetch API 實作，無框架
- **`style.css`**：閃示卡 3D 翻轉動畫（CSS `perspective` + `rotateY`）的自定義樣式

前端狀態以模組層級變數管理：`currentWord`、`flashcardWords`、`currentFlashcardIndex`。

## 關鍵設計決策

- **查詢快取**：`/api/lookup` 先查資料庫，已存在的單字直接回傳，不重複呼叫 AI API
- **Claude AI 回應格式**：Prompt 要求 AI 回傳 JSON，server.js 解析後儲存
- **成本追蹤**：每次 AI 查詢回傳 token 用量和費用估算（輸入 $0.25/M、輸出 $1.25/M tokens）
- **優雅關閉**：監聽 `SIGINT`/`SIGTERM`，5 秒超時後強制終止，確保資料庫正常關閉
