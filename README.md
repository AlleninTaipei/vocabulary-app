# 我的單字本

一個用 AI 幫你學英文的個人字典 App，輸入單字就能得到易懂的解釋和例句，還有字卡幫助記憶！

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
- Anthropic: https://console.anthropic.com/
- Google: https://aistudio.google.com/
- OpenAI: https://platform.openai.com/

### 2. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`，選擇供應商並填入對應的 API Key：

```
DEFAULT_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

切換供應商只需修改 `DEFAULT_PROVIDER` 的值，重啟 server 即生效。

### 3. 安裝並啟動

```bash
npm install
npm start
```

打開瀏覽器，前往 http://localhost:3000

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

依供應商和模型而異（每次查詢約為以下費用）：

| 供應商 | 預設模型 | 約略費用/次 |
|--------|----------|-------------|
| Anthropic | claude-haiku-4-5 | ~$0.0003 |
| OpenAI | gpt-4o-mini | ~$0.0001 |
| Google | gemini-2.5-flash | ~$0.00005 |
| Ollama / LM Studio | 本機模型 | 免費 |

## 關於 AI 整合模式

本 App 採用 API 模式（直接呼叫各供應商 SDK），而非 Claude Code CLI 的 `-p` 模式。

兩者的差異：

- API 模式：AI 能力封裝在 App 內，使用者只需開瀏覽器，無需安裝任何 AI 工具
- CLI `-p` 模式：需要本機安裝並登入 Claude Code CLI，適合開發者腳本和自動化工作流，不適合部署給一般使用者

## 授權

MIT License
