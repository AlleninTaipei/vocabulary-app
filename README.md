# 我的單字本

一個用 AI 幫你學英文的個人字典 App，輸入單字就能得到易懂的解釋和例句，還有字卡幫助記憶！

## 功能

- **查單字**：輸入英文單字，AI 會生成簡單易懂的中文解釋、例句和相關單字
- **個人字典**：儲存查過的單字，建立自己的單字庫
- **字卡**：翻轉卡片複習單字，標記熟悉度

## 快速開始

### 1. 取得 Claude API 金鑰

1. 前往 [Anthropic Console](https://console.anthropic.com/)
2. 註冊或登入帳號
3. 到 Settings > API Keys
4. 建立新的 API Key
5. 加值一些額度（建議先加 $5 美金）

### 2. 設定環境變數

```bash
# 複製範例檔案
cp .env.example .env

# 編輯 .env，填入你的 API 金鑰
```

### 3. 啟動應用程式

```bash
# 安裝套件（如果還沒裝的話）
npm install

# 啟動伺服器
npm start
```

### 4. 開始使用

打開瀏覽器，前往 http://localhost:3000

## 技術架構

- 前端：HTML + CSS + JavaScript + Tailwind CSS
- 後端：Node.js + Express
- 資料庫：SQLite
- AI：Claude API (claude-3-haiku)

## 費用說明

使用 Claude 3 Haiku 模型非常便宜：
- 每次查詢約 $0.0001 美金
- $5 美金可以查詢約 50,000 次

## 授權

MIT License
