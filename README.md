# 我的單字本

一個用 AI 幫你學英文的個人字典 App，輸入單字就能得到易懂的解釋和例句，還有字卡幫助記憶！

> 在做 AI 應用的過程中, 一步步學會 AI.

## 功能

- 查單字：輸入英文單字，AI 會生成簡單易懂的中文解釋、例句和相關單字
- 個人字典：儲存查過的單字，建立自己的單字庫
- 字卡：翻轉卡片複習單字，標記熟悉度

## 快速開始

### 1. 設定 AI 供應商

本 App 支援多個 AI 供應商，選一個設定即可：

| 供應商 | 設定值 | 需要 |
|--------|--------|------|
| Anthropic (Claude) | `anthropic` | API Key |
| Google (Gemini) | `google` | API Key |
| OpenAI (GPT) | `openai` | API Key |
| Ollama | `ollama` | 本機執行 Ollama |
| LM Studio | `lmstudio` | 本機執行 LM Studio |

雲端供應商 API Key 申請：

- Anthropic: <https://console.anthropic.com/>
- Google: <https://aistudio.google.com/>
- OpenAI: <https://platform.openai.com/>

### 2. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`，選擇供應商並填入對應的 API Key：

```
DEFAULT_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

`.env` 設定的是「開啟頁面時預設用哪個供應商」, 也可以在網頁的查詢頁直接用下拉選單切換供應商 / 模型, 不需要重啟 server。

### 3. 安裝並啟動

```bash
npm install
npm start
```

打開瀏覽器，前往 <http://localhost:3000>

### 4. 網頁上切換供應商 / 模型 (可選)

查詢頁上方有供應商與模型的下拉選單, 可以隨時切換, 不用改 `.env` 或重啟 server。

若切換到的供應商沒有在 `.env` 設定 API Key, 查詢時會彈出輸入視窗, 讓你直接在瀏覽器輸入 Key 測試:

- 不勾選「記住這個 Key」: Key 只存在瀏覽器記憶體, 重新整理頁面就會消失
- 勾選「記住這個 Key」: Key 會寫入瀏覽器的 local storage, 下次開啟不用再輸入, 但同一台電腦的其他使用者也可能讀取到, 公用電腦請不要勾選
- 已記住的 Key 可以用查詢頁上的「清除已儲存的 API Key」按鈕移除

## 技術架構

- 前端：HTML + CSS + JavaScript + Tailwind CSS
- 後端：Node.js + Express
- 資料庫：SQLite
- AI 整合：`providers.js` 抽象層，統一介面支援多供應商

```
Browser (SPA) ←→ Express (server.js) ←→ SQLite (database.js)
                          ↕
                   providers.js（AI 抽象層）
               /    |    |      \       \
        Anthropic OpenAI Google Ollama LMStudio
```

## 費用說明

依供應商和模型而異, 每個模型的實際費率（每百萬 token, USD）都不同, 下拉選單切換模型時預估費用也會跟著變：

| 供應商 | 模型 | Input / Output（每百萬 token） |
|--------|------|-------------------------------|
| Anthropic | claude-opus-5 | $5.00 / $25.00 |
| Anthropic | claude-sonnet-5 | $3.00 / $15.00 |
| Anthropic | claude-haiku-4-5（預設） | $1.00 / $5.00 |
| OpenAI | gpt-5.6-sol | $5.00 / $30.00 |
| OpenAI | gpt-5.6-terra | $2.00 / $12.00 |
| OpenAI | gpt-5.6-luna（預設） | $0.20 / $1.20 |
| Google | gemini-2.5-pro | $1.25 / $10.00 |
| Google | gemini-3.6-flash | $1.50 / $7.50 |
| Google | gemini-3.5-flash-lite（預設） | $0.30 / $2.50 |
| Ollama / LM Studio | 本機模型 | 免費 |

以預設模型計算, 單次查單字（幾百個 token）的費用大約在 $0.0001 ~ $0.001 USD 之間, 實際金額請以查詢結果畫面顯示的「預估費用」為準。

## 關於 AI 整合模式

本 App 採用 API 模式（直接呼叫各供應商 SDK），而非 Claude Code CLI 的 `-p` 模式。

兩者的差異：

- API 模式：AI 能力封裝在 App 內，使用者只需開瀏覽器，無需安裝任何 AI 工具
- CLI `-p` 模式：需要本機安裝並登入 Claude Code CLI，適合開發者腳本和自動化工作流，不適合部署給一般使用者

|          | API 模式（現在的做法）        | CLI 模式（-p 模式）              |
|----------|-------------------------------|----------------------------------|
| 適合場景 | Web server、多人同時請求      | 腳本、批次處理、開發工具         |
| 效能     | 持續連線, 毫秒回應            | 每次請求啟動新 process, 慢       |
| 並發     | 原生支援                      | 有問題                           |
| 驗證     | API Key                       | 本機 claude login                |
| 計費     | 依 token 計費                 | 看帳號類型（Pro 訂閱或 API Key） |
| 部署     | 任何環境                      | 需先安裝 Claude Code CLI<br>呼叫 `claude.exe --print` |
| 業內溝通 | 「呼叫 AI API」, 清楚標準     | 「用 CLI 做 AI 查詢」, 較少見    |

## 授權

MIT License
