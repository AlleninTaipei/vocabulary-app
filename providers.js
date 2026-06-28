const Anthropic = require('@anthropic-ai/sdk');
const { OpenAI } = require('openai');
const { GoogleGenAI } = require('@google/genai');

const PROVIDER = (process.env.DEFAULT_PROVIDER || 'anthropic').toLowerCase().trim();

const MODELS = {
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  openai:    process.env.OPENAI_MODEL    || 'gpt-4o-mini',
  google:    process.env.GOOGLE_MODEL    || 'gemini-2.5-flash',
  ollama:    process.env.OLLAMA_MODEL    || 'gemma3:1b',
  lmstudio:  process.env.LMSTUDIO_MODEL  || 'meta-llama-3-8b-instruct'
};

const PRICING = {
  anthropic: { inputCostPerM: 0.80, outputCostPerM: 4.00 },
  openai:    { inputCostPerM: 0.15, outputCostPerM: 0.60 },
  google:    { inputCostPerM: 0.10, outputCostPerM: 0.40 },
  ollama:    { inputCostPerM: 0,    outputCostPerM: 0 },
  lmstudio:  { inputCostPerM: 0,    outputCostPerM: 0 }
};

async function callAI(prompt) {
  const pricing = PRICING[PROVIDER] || { inputCostPerM: 0, outputCostPerM: 0 };

  switch (PROVIDER) {
    case 'anthropic': {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const model = MODELS.anthropic;
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
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = MODELS.openai;
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
        provider: 'openai',
        ...pricing
      };
    }

    case 'google': {
      const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
      const model = MODELS.google;
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
      const model = MODELS.ollama;
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
      const model = MODELS.lmstudio;
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
        `Unknown provider: "${PROVIDER}". Valid values: anthropic, openai, google, ollama, lmstudio`
      );
  }
}

module.exports = { callAI, PROVIDER };
