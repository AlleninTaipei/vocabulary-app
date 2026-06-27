# 個人字典 App 開發日誌

> 使用 Claude Code 從零開始建立的第一個 AI 應用程式

## 專案資訊

| 項目 | 內容 |
|------|------|
| 專案名稱 | 我的單字本 (Vocabulary App) |
| 開發日期 | 2026-02-09 |
| 開發工具 | Claude Code (claude-opus-4-5-20251101) |
| 開發者程度 | 有 HTML/CSS/JS 基礎的新手 |

---

## 開發時間軸

### Phase 1: 需求討論與規劃

**對話重點：**
1. 確認 App 類型 → 選擇 **Web App**（網頁版）
2. 確認 AI 服務 → 選擇 **Claude API**
3. 確認技術程度 → **有基礎**（會 HTML/CSS/JS）
4. 釐清 Claude Pro vs Claude API 的差異
   - Claude Pro：claude.ai 網頁版訂閱
   - Claude API：開發者用的介面，需另外申請金鑰

**規劃產出：**
- 技術選擇確定
- 功能規格定義
- 專案結構設計

### Phase 2: 專案建立

**執行步驟：**
```bash
mkdir -p vocabulary-app/public
cd vocabulary-app
npm init
npm install express better-sqlite3 @anthropic-ai/sdk dotenv cors
```

**建立的檔案：**
- `package.json` - 專案設定
- `database.js` - SQLite 資料庫操作
- `server.js` - Express 後端 API
- `public/index.html` - 主頁面
- `public/style.css` - 樣式（含字卡翻轉動畫）
- `public/app.js` - 前端邏輯
- `.env` - API 金鑰設定
- `.gitignore` - Git 忽略清單
- `README.md` - 使用說明

### Phase 3: 核心功能完成

**已實作功能：**
1. **查單字** - 輸入英文單字，AI 生成中文解釋、例句、相關單字
2. **個人字典** - 儲存、瀏覽、刪除單字
3. **字卡** - 翻轉複習、標記熟悉度

### Phase 4: 新增 API 使用量顯示

**需求：** 想了解 tokens、API、account 之間的關係

**實作內容：**
- 修改 `server.js` - 回傳 usage 資訊
- 修改 `index.html` - 新增狀態列 UI
- 修改 `app.js` - 顯示 token 消耗和費用

**學習到的概念：**
```
Account（帳戶）
    └── 儲值餘額
           ↓
       API 呼叫
           ↓
    Token 消耗
    ├── Input Tokens（你送出的文字）
    └── Output Tokens（AI 回覆的文字）
           ↓
    從餘額扣款
```

**費用計算（claude-3-haiku）：**
- Input: $0.25 / 1M tokens
- Output: $1.25 / 1M tokens
- 每次查詢約 $0.0003 美金

---

## 技術架構

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌─────────────────────────────────────────┐    │
│  │           public/index.html              │    │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐   │    │
│  │  │ 查單字  │ │ 我的字典│ │  字卡  │   │    │
│  │  └─────────┘ └─────────┘ └──────────┘   │    │
│  │           public/app.js                  │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
                      │ HTTP
                      ▼
┌─────────────────────────────────────────────────┐
│               server.js (Express)                │
│  ┌──────────────────────────────────────────┐   │
│  │ POST /api/lookup    → 查詢單字（呼叫 AI）│   │
│  │ GET  /api/words     → 取得所有單字       │   │
│  │ POST /api/words     → 儲存單字           │   │
│  │ DELETE /api/words/:id → 刪除單字         │   │
│  │ PATCH /api/words/:id  → 更新熟悉度       │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
          │                           │
          ▼                           ▼
┌──────────────────┐      ┌──────────────────────┐
│   database.js    │      │    Claude API        │
│   (SQLite)       │      │ claude-3-haiku       │
│  vocabulary.db   │      │                      │
└──────────────────┘      └──────────────────────┘
```

---

## 專案結構

```
vocabulary-app/
├── package.json          # 專案設定與依賴
├── package-lock.json     # 依賴版本鎖定
├── node_modules/         # 第三方套件
├── .env                  # API 金鑰（不上傳 git）
├── .gitignore           # Git 忽略清單
├── server.js            # Express 後端伺服器
├── database.js          # SQLite 資料庫操作
├── vocabulary.db        # SQLite 資料庫檔案
├── README.md            # 使用說明
├── DEV-LOG.md           # 開發日誌（本檔案）
└── public/
    ├── index.html       # 主頁面（含三個分頁）
    ├── style.css        # 樣式（含字卡動畫）
    └── app.js           # 前端互動邏輯
```

---

## 學習重點

### 1. Claude Code 使用技巧
- **Plan Mode**：複雜任務先規劃再執行
- **SHIFT+TAB**：切換權限模式
- **Task 工具**：建立任務追蹤進度
- **AskUserQuestion**：需要決策時詢問使用者

### 2. API 開發概念
- RESTful API 設計（GET, POST, PATCH, DELETE）
- Express 中介軟體（cors, json, static）
- 環境變數管理（dotenv）

### 3. AI 整合
- Claude API 呼叫方式
- Token 計費模式
- Prompt 設計（要求 JSON 格式回覆）

### 4. 前端技巧
- Tailwind CSS CDN 快速樣式
- CSS 3D 翻轉動畫（字卡）
- Fetch API 非同步請求

---

## 未來可擴充功能

- [ ] 單字發音（Text-to-Speech）
- [ ] 匯出單字列表（CSV/PDF）
- [ ] 單字分類標籤
- [ ] 學習統計圖表
- [ ] 每日複習提醒
- [ ] 多語言支援

---

## 啟動方式

```bash
cd /Users/allenintaipei/Desktop/Test/vocabulary-app
npm start
# 開啟瀏覽器 http://localhost:3000
```

---

*此日誌由 Claude Code 協助產生*
