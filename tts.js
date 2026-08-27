// 本機 Kokoro TTS sidecar 的 HTTP 客戶端（比照 providers.js 對 AI 供應商的封裝方式）

const TTS_PORT = process.env.TTS_PORT || 8090;
const TTS_BASE = `http://127.0.0.1:${TTS_PORT}`;

// 固定的英語語音清單，由 Node 端維護，避免每次都要向 sidecar 詢問
const VOICES = [
  { id: 'af_heart', label: '美式女聲 · Heart', accent: 'US', gender: 'F' },
  { id: 'af_bella', label: '美式女聲 · Bella', accent: 'US', gender: 'F' },
  { id: 'af_sarah', label: '美式女聲 · Sarah', accent: 'US', gender: 'F' },
  { id: 'am_adam', label: '美式男聲 · Adam', accent: 'US', gender: 'M' },
  { id: 'am_michael', label: '美式男聲 · Michael', accent: 'US', gender: 'M' },
  { id: 'bf_emma', label: '英式女聲 · Emma', accent: 'UK', gender: 'F' },
  { id: 'bm_george', label: '英式男聲 · George', accent: 'UK', gender: 'M' },
];

function listVoices() {
  return VOICES;
}

// 呼叫本機 Kokoro sidecar 合成語音，回傳 WAV 格式的 Buffer
async function synthesize(text, voiceId) {
  let response;
  try {
    response = await fetch(`${TTS_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: voiceId }),
    });
  } catch (error) {
    const err = new Error('語音服務尚未就緒');
    err.code = 'TTS_UNAVAILABLE';
    err.cause = error;
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`語音合成失敗 (HTTP ${response.status})`);
    err.code = 'TTS_SYNTH_FAILED';
    throw err;
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// 呼叫 synthesize，若剛好遇到 sidecar 正在啟動中（連線被拒）則重試幾次
async function synthesizeWithRetry(text, voiceId, retries = 2, delayMs = 1000) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await synthesize(text, voiceId);
    } catch (error) {
      if (error.code === 'TTS_UNAVAILABLE' && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
}

async function checkHealth() {
  try {
    const response = await fetch(`${TTS_BASE}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

module.exports = {
  TTS_PORT,
  listVoices,
  synthesize: synthesizeWithRetry,
  checkHealth,
};
