const Anthropic = require('@anthropic-ai/sdk');
const { OpenAI } = require('openai');
const { GoogleGenAI } = require('@google/genai');

const DEFAULT_PROVIDER = (process.env.DEFAULT_PROVIDER || 'google').toLowerCase().trim();

// 供應商設定：可選模型清單、預設模型、API Key 對應的環境變數
const PROVIDERS = {
  google: {
    label: 'Google (Gemini)',
    envKey: 'GOOGLE_API_KEY',
    requiresApiKey: true,
    models: ['gemini-2.5-pro', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
    defaultModel: process.env.GOOGLE_MODEL || 'gemini-3.5-flash-lite'
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    envKey: 'ANTHROPIC_API_KEY',
    requiresApiKey: true,
    models: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
    defaultModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
  },
  openai: {
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    requiresApiKey: true,
    models: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'],
    defaultModel: process.env.OPENAI_MODEL || 'gpt-5.6-luna'
  },
  ollama: {
    label: 'Ollama（本機）',
    envKey: null,
    requiresApiKey: false,
    models: ['gemma3:1b', 'llama3.1', 'qwen2.5'],
    defaultModel: process.env.OLLAMA_MODEL || 'gemma3:1b'
  },
  lmstudio: {
    label: 'LM Studio（本機）',
    envKey: null,
    requiresApiKey: false,
    models: ['meta-llama-3-8b-instruct'],
    defaultModel: process.env.LMSTUDIO_MODEL || 'meta-llama-3-8b-instruct'
  }
};

// 各供應商的估算費率（當模型不在 MODEL_PRICING 時的備用值, 例如自訂 env 模型）
const PRICING = {
  anthropic: { inputCostPerM: 1.00, outputCostPerM: 5.00 },
  openai: { inputCostPerM: 0.20, outputCostPerM: 1.20 },
  google: { inputCostPerM: 0.30, outputCostPerM: 2.50 },
  ollama: { inputCostPerM: 0, outputCostPerM: 0 },
  lmstudio: { inputCostPerM: 0, outputCostPerM: 0 }
};

// 各模型的實際費率（每百萬 token, USD）, 依模型精確計價
const MODEL_PRICING = {
  'claude-opus-5': { inputCostPerM: 5.00, outputCostPerM: 25.00 },
  'claude-sonnet-5': { inputCostPerM: 3.00, outputCostPerM: 15.00 },
  'claude-haiku-4-5': { inputCostPerM: 1.00, outputCostPerM: 5.00 },

  'gpt-5.6-sol': { inputCostPerM: 5.00, outputCostPerM: 30.00 },
  'gpt-5.6-terra': { inputCostPerM: 2.00, outputCostPerM: 12.00 },
  'gpt-5.6-luna': { inputCostPerM: 0.20, outputCostPerM: 1.20 },

  'gemini-2.5-pro': { inputCostPerM: 1.25, outputCostPerM: 10.00 },
  'gemini-3.6-flash': { inputCostPerM: 1.50, outputCostPerM: 7.50 },
  'gemini-3.5-flash-lite': { inputCostPerM: 0.30, outputCostPerM: 2.50 }
};

// 取得供應商清單，附帶「環境變數是否已設定 API Key」的狀態，給前端顯示用
function getProviderInfo() {
  return Object.entries(PROVIDERS).map(([id, info]) => ({
    id,
    label: info.label,
    models: info.models,
    defaultModel: info.defaultModel,
    requiresApiKey: info.requiresApiKey,
    hasEnvApiKey: info.requiresApiKey ? Boolean(process.env[info.envKey]) : true
  }));
}

// 判斷該次查詢是否已有可用的 API Key（環境變數或前端傳入的覆寫值）
function hasApiKey(provider, overrideKey) {
  const info = PROVIDERS[provider];
  if (!info) return false;
  if (!info.requiresApiKey) return true;
  return Boolean(overrideKey) || Boolean(process.env[info.envKey]);
}

function resolveApiKey(provider, overrideKey) {
  const info = PROVIDERS[provider];
  if (overrideKey) return overrideKey;
  return info.envKey ? process.env[info.envKey] : undefined;
}

async function callAI(prompt, options = {}) {
  const provider = (options.provider || DEFAULT_PROVIDER).toLowerCase().trim();
  const info = PROVIDERS[provider];

  if (!info) {
    throw new Error(
      `Unknown provider: "${provider}". Valid values: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  const model = options.model || info.defaultModel;
  const apiKey = resolveApiKey(provider, options.apiKey);
  const pricing = MODEL_PRICING[model] || PRICING[provider] || { inputCostPerM: 0, outputCostPerM: 0 };

  if (info.requiresApiKey && !apiKey) {
    const err = new Error(`缺少 ${info.label} 的 API Key`);
    err.code = 'MISSING_API_KEY';
    err.provider = provider;
    throw err;
  }

  switch (provider) {
    case 'anthropic': {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      return {
        text: message.content[0].text,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        model,
        provider: 'anthropic',
        ...pricing
      };
    }

    case 'openai': {
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model,
        max_completion_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      return {
        text: response.choices[0].message.content || '',
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        model,
        provider: 'openai',
        ...pricing
      };
    }

    case 'google': {
      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model,
        contents: prompt
      });
      return {
        text: response.text,
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        model,
        provider: 'google',
        ...pricing
      };
    }

    case 'ollama': {
      const client = new OpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'local' });
      const response = await client.chat.completions.create({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      return {
        text: response.choices[0].message.content || '',
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        model,
        provider: 'ollama',
        ...pricing
      };
    }

    case 'lmstudio': {
      const client = new OpenAI({ baseURL: 'http://localhost:1234/v1', apiKey: 'local' });
      const response = await client.chat.completions.create({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      return {
        text: response.choices[0].message.content || '',
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        model,
        provider: 'lmstudio',
        ...pricing
      };
    }

    default:
      throw new Error(
        `Unknown provider: "${provider}". Valid values: ${Object.keys(PROVIDERS).join(', ')}`
      );
  }
}

module.exports = { callAI, getProviderInfo, hasApiKey, PROVIDER: DEFAULT_PROVIDER };
