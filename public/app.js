// DOM 元素
const wordInput = document.getElementById('word-input');
const lookupBtn = document.getElementById('lookup-btn');
const resultArea = document.getElementById('result-area');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const saveBtn = document.getElementById('save-btn');
const providerSelect = document.getElementById('provider-select');
const modelSelect = document.getElementById('model-select');

// API Key modal
const apikeyModal = document.getElementById('apikey-modal');
const apikeyModalDesc = document.getElementById('apikey-modal-desc');
const apikeyModalLink = document.getElementById('apikey-modal-link');
const apikeyInput = document.getElementById('apikey-input');
const apikeyRemember = document.getElementById('apikey-remember');
const apikeyCancel = document.getElementById('apikey-cancel');
const apikeyConfirm = document.getElementById('apikey-confirm');
const apikeyClearRow = document.getElementById('apikey-clear-row');
const apikeyClearBtn = document.getElementById('apikey-clear-btn');

// 供應商資料與使用者輸入的 API Key（依使用者選擇, 存於記憶體或瀏覽器 local storage）
let providersInfo = [];
const apiKeyOverrides = {};

// 各供應商申請 API Key 的網址（跟 README 列出的一致）
const PROVIDER_SIGNUP_LINKS = {
  anthropic: 'https://console.anthropic.com/',
  google: 'https://aistudio.google.com/',
  openai: 'https://platform.openai.com/'
};

// API Key local storage 存取工具
function storageKeyFor(providerId) {
  return `vocab-app.apiKey.${providerId}`;
}
function loadStoredApiKey(providerId) {
  return localStorage.getItem(storageKeyFor(providerId)) || '';
}
function saveStoredApiKey(providerId, key) {
  localStorage.setItem(storageKeyFor(providerId), key);
}
function removeStoredApiKey(providerId) {
  localStorage.removeItem(storageKeyFor(providerId));
}

// 依目前選擇的供應商, 顯示或隱藏「清除已儲存的 API Key」按鈕
function updateApiKeyClearButton() {
  const providerId = providerSelect.value;
  const hasStored = Boolean(loadStoredApiKey(providerId));
  apikeyClearRow.classList.toggle('hidden', !hasStored);
}

// 分頁
const tabs = {
  lookup: document.getElementById('tab-lookup'),
  dictionary: document.getElementById('tab-dictionary'),
  flashcard: document.getElementById('tab-flashcard')
};
const pages = {
  lookup: document.getElementById('page-lookup'),
  dictionary: document.getElementById('page-dictionary'),
  flashcard: document.getElementById('page-flashcard')
};

// 字卡
const flashcard = document.getElementById('flashcard');
const flashcardContainer = document.getElementById('flashcard-container');
const flashcardControls = document.getElementById('flashcard-controls');
const flashcardEmpty = document.getElementById('flashcard-empty');

// 當前資料
let currentWord = null;
let flashcardWords = [];
let currentFlashcardIndex = 0;

// 我的字典 - 目前載入的全部單字, 以及依詞性篩選的狀態（null 代表「全部」）
let dictionaryWords = [];
let dictionaryPosFilter = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 分頁切換
  Object.keys(tabs).forEach(tabName => {
    tabs[tabName].addEventListener('click', () => switchTab(tabName));
  });

  // 每次載入頁面隨機化 name 屬性, 避免 Chrome 顯示先前輸入過的建議清單
  wordInput.setAttribute('name', `word-search-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // 載入供應商 / 模型清單
  loadProviders();
  providerSelect.addEventListener('change', () => {
    populateModelSelect(providerSelect.value);
    updateApiKeyClearButton();
  });
  apikeyClearBtn.addEventListener('click', () => {
    const providerId = providerSelect.value;
    removeStoredApiKey(providerId);
    delete apiKeyOverrides[providerId];
    updateApiKeyClearButton();
  });

  // 查詢按鈕
  lookupBtn.addEventListener('click', lookupWord);
  wordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') lookupWord();
  });

  // API Key modal
  apikeyCancel.addEventListener('click', closeApiKeyModal);
  apikeyConfirm.addEventListener('click', confirmApiKey);
  apikeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') confirmApiKey();
  });

  // 儲存按鈕
  saveBtn.addEventListener('click', saveWord);

  // 字卡點擊翻轉
  flashcard.addEventListener('click', () => {
    flashcard.classList.toggle('flipped');
  });

  // 字卡控制
  document.getElementById('btn-mastered').addEventListener('click', () => markMastery(true));
  document.getElementById('btn-not-mastered').addEventListener('click', () => markMastery(false));
  document.getElementById('btn-reset-all').addEventListener('click', resetAllMastery);

  // 語音選擇
  loadVoices();
  const voiceSelect = document.getElementById('voice-select');
  if (voiceSelect) {
    voiceSelect.addEventListener('change', () => onVoiceChange(voiceSelect.value));
  }
});

// 切換分頁
function switchTab(tabName) {
  Object.keys(tabs).forEach(name => {
    tabs[name].classList.toggle('active', name === tabName);
    pages[name].classList.toggle('hidden', name !== tabName);
  });

  // 載入對應頁面的資料
  if (tabName === 'dictionary') {
    loadDictionary();
  } else if (tabName === 'flashcard') {
    loadFlashcards();
  }
}

// 載入供應商 / 模型清單
async function loadProviders() {
  try {
    const response = await fetch('/api/providers');
    const data = await response.json();

    providersInfo = data.providers;
    providerSelect.innerHTML = providersInfo.map(p => `
      <option value="${p.id}">${p.label}</option>
    `).join('');
    providerSelect.value = data.defaultProvider;
    populateModelSelect(providerSelect.value);

    // 從 local storage 還原使用者選擇「記住」的 API Key
    providersInfo.forEach(p => {
      if (!p.requiresApiKey) return;
      const stored = loadStoredApiKey(p.id);
      if (stored) apiKeyOverrides[p.id] = stored;
    });
    updateApiKeyClearButton();
  } catch (error) {
    console.error('載入供應商清單失敗:', error);
  }
}

// 依供應商填入模型下拉選單
function populateModelSelect(providerId) {
  const info = providersInfo.find(p => p.id === providerId);
  if (!info) return;

  modelSelect.innerHTML = info.models.map(m => `<option value="${m}">${m}</option>`).join('');
  modelSelect.value = info.defaultModel;
}

// 彈出 API Key 輸入視窗, 回傳使用者輸入的 Key（取消則為 null）
let apikeyResolver = null;
function promptForApiKey(providerId) {
  const info = providersInfo.find(p => p.id === providerId);
  apikeyModalDesc.textContent = `請輸入 ${info ? info.label : providerId} 的 API Key 才能查詢.`;

  const signupUrl = PROVIDER_SIGNUP_LINKS[providerId];
  if (signupUrl) {
    apikeyModalLink.href = signupUrl;
    apikeyModalLink.textContent = `還沒有 API Key ? 前往 ${info ? info.label : providerId} 申請`;
    apikeyModalLink.classList.remove('hidden');
  } else {
    apikeyModalLink.classList.add('hidden');
  }

  apikeyInput.value = '';
  apikeyRemember.checked = Boolean(loadStoredApiKey(providerId));
  apikeyModal.classList.remove('hidden');
  apikeyInput.focus();

  return new Promise((resolve) => {
    apikeyResolver = resolve;
  });
}

function closeApiKeyModal() {
  apikeyModal.classList.add('hidden');
  if (apikeyResolver) {
    apikeyResolver(null);
    apikeyResolver = null;
  }
}

function confirmApiKey() {
  const key = apikeyInput.value.trim();
  const remember = apikeyRemember.checked;
  const providerId = providerSelect.value;

  apikeyModal.classList.add('hidden');

  if (remember && key) {
    saveStoredApiKey(providerId, key);
  } else {
    removeStoredApiKey(providerId);
  }
  updateApiKeyClearButton();

  if (apikeyResolver) {
    apikeyResolver(key || null);
    apikeyResolver = null;
  }
}

// 查詢單字
async function lookupWord() {
  const word = wordInput.value.trim();
  if (!word) return;
  await performLookup(word);
}

async function performLookup(word) {
  // 顯示載入中
  resultArea.classList.add('hidden');
  errorMessage.classList.add('hidden');
  loading.classList.remove('hidden');

  const provider = providerSelect.value;
  const model = modelSelect.value;

  try {
    const response = await fetch('/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, provider, model, apiKey: apiKeyOverrides[provider] })
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.code === 'MISSING_API_KEY') {
        loading.classList.add('hidden');
        const key = await promptForApiKey(data.provider);
        if (key) {
          apiKeyOverrides[data.provider] = key;
          return performLookup(word);
        }
        throw new Error(data.error || '查詢失敗');
      }
      throw new Error(data.error || '查詢失敗');
    }

    // 儲存當前單字資料
    currentWord = data;

    // 顯示結果
    displayResult(data);

  } catch (error) {
    showError(error.message);
  } finally {
    loading.classList.add('hidden');
  }
}

// 顯示查詢結果
function displayResult(data) {
  document.getElementById('result-word').textContent = data.word;
  document.getElementById('result-pos').textContent = data.pos;
  document.getElementById('result-explanation').textContent = data.explanation;

  // 柯林斯 COBUILD 風格的整句英文解釋（舊資料可能沒有這個欄位）
  const cobuildEl = document.getElementById('result-cobuild');
  if (data.cobuild) {
    cobuildEl.textContent = data.cobuild;
    cobuildEl.classList.remove('hidden');
  } else {
    cobuildEl.textContent = '';
    cobuildEl.classList.add('hidden');
  }

  // 例句
  const examplesList = document.getElementById('result-examples');
  examplesList.innerHTML = data.examples.map(ex => `
    <li class="example-item">
      <p class="example-en">${ex.en}</p>
      <p class="example-zh">${ex.zh}</p>
    </li>
  `).join('');

  // 相關單字
  const relatedDiv = document.getElementById('result-related');
  relatedDiv.innerHTML = data.related.map(word => `
    <span class="related-tag" onclick="quickLookup('${word}')">${word}</span>
  `).join('');

  // 更新儲存按鈕狀態
  if (data.saved) {
    saveBtn.textContent = '已儲存';
    saveBtn.disabled = true;
    saveBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
    saveBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
  } else {
    saveBtn.textContent = '儲存到字典';
    saveBtn.disabled = false;
    saveBtn.classList.add('bg-green-500', 'hover:bg-green-600');
    saveBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
  }

  // 顯示 API 使用量（只有新查詢才有 usage 資料）
  const usageStats = document.getElementById('usage-stats');
  if (data.usage) {
    document.getElementById('stat-input').textContent = data.usage.input_tokens.toLocaleString();
    document.getElementById('stat-output').textContent = data.usage.output_tokens.toLocaleString();
    document.getElementById('stat-total').textContent = data.usage.total_tokens.toLocaleString();
    document.getElementById('stat-cost').textContent = `$${data.usage.estimated_cost_usd}`;
    document.getElementById('stat-model').textContent = `Model: ${data.usage.model}`;
    usageStats.classList.remove('hidden');
  } else {
    // 從資料庫讀取的單字沒有 usage 資料
    usageStats.classList.add('hidden');
  }

  resultArea.classList.remove('hidden');
}

// 快速查詢（點擊相關單字）
function quickLookup(word) {
  wordInput.value = word;
  lookupWord();
}

// 儲存單字
async function saveWord() {
  if (!currentWord || currentWord.saved) return;

  try {
    const response = await fetch('/api/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentWord)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '儲存失敗');
    }

    // 更新按鈕狀態
    currentWord.saved = true;
    currentWord.id = data.id;
    saveBtn.textContent = '已儲存';
    saveBtn.disabled = true;
    saveBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
    saveBtn.classList.add('bg-gray-400', 'cursor-not-allowed');

  } catch (error) {
    showError(error.message);
  }
}

// 顯示錯誤
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

// 載入字典
async function loadDictionary() {
  try {
    const response = await fetch('/api/words');
    dictionaryWords = await response.json();
    dictionaryPosFilter = null;
    renderPosFilter();
    renderDictionaryList();
  } catch (error) {
    console.error('載入字典失敗:', error);
  }
}

// 依詞性統計數量, 畫出「全部 + 各詞性」的篩選標籤（一次只選一個）
function renderPosFilter() {
  const filterEl = document.getElementById('pos-filter');

  if (dictionaryWords.length === 0) {
    filterEl.innerHTML = '';
    return;
  }

  const counts = {};
  dictionaryWords.forEach(w => {
    const pos = w.pos || '未分類';
    counts[pos] = (counts[pos] || 0) + 1;
  });

  const chips = [{ label: '全部', value: null, count: dictionaryWords.length }]
    .concat(Object.keys(counts).map(pos => ({ label: pos, value: pos, count: counts[pos] })));

  filterEl.innerHTML = chips.map(chip => {
    const active = dictionaryPosFilter === chip.value;
    const activeClass = active
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
    const jsValue = chip.value === null ? 'null' : `'${chip.value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    return `
      <button
        onclick="setDictionaryFilter(${jsValue})"
        class="pos-chip px-3 py-1 rounded-full text-sm font-medium transition ${activeClass}"
      >
        ${chip.label} (${chip.count})
      </button>
    `;
  }).join('');
}

// 切換詞性篩選（點擊篩選標籤時呼叫）
function setDictionaryFilter(pos) {
  dictionaryPosFilter = pos;
  renderPosFilter();
  renderDictionaryList();
}

// 依目前的詞性篩選狀態畫出單字列表
function renderDictionaryList() {
  const listEl = document.getElementById('dictionary-list');
  const emptyEl = document.getElementById('empty-dictionary');
  const countEl = document.getElementById('word-count');

  if (dictionaryWords.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    countEl.textContent = '';
    return;
  }

  emptyEl.classList.add('hidden');

  const words = dictionaryPosFilter === null
    ? dictionaryWords
    : dictionaryWords.filter(w => (w.pos || '未分類') === dictionaryPosFilter);

  countEl.textContent = dictionaryPosFilter === null
    ? `共 ${dictionaryWords.length} 個單字`
    : `${dictionaryPosFilter}: ${words.length} 個單字（共 ${dictionaryWords.length} 個）`;

  listEl.innerHTML = words.map(word => `
      <div class="dictionary-item ${word.mastered ? 'mastered' : ''}" data-id="${word.id}">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-lg text-gray-800">${word.word}</span>
              <span class="text-sm text-indigo-500">${word.pos}</span>
              ${word.mastered ? '<span class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded">已熟悉</span>' : ''}
            </div>
            ${word.cobuild ? `<p class="text-gray-600 italic mt-1">${word.cobuild}</p>` : ''}
            <p class="text-gray-600 mt-1">${word.explanation}</p>
            ${word.examples && word.examples.length ? `
              <ul class="space-y-1 mt-2">
                ${word.examples.map(ex => `
                  <li class="example-item">
                    <p class="example-en">${ex.en}</p>
                    <p class="example-zh">${ex.zh}</p>
                  </li>
                `).join('')}
              </ul>
            ` : ''}
          </div>
          <button
            onclick="deleteWord(${word.id})"
            class="delete-btn text-red-400 hover:text-red-600 p-1"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
}

// 刪除單字
async function deleteWord(id) {
  if (!confirm('確定要刪除這個單字嗎？')) return;

  try {
    const response = await fetch(`/api/words/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      loadDictionary();
    }
  } catch (error) {
    console.error('刪除失敗:', error);
  }
}

// 載入字卡
async function loadFlashcards() {
  try {
    const response = await fetch('/api/words/review');
    flashcardWords = await response.json();
    currentFlashcardIndex = 0;

    if (flashcardWords.length === 0) {
      flashcardContainer.classList.add('hidden');
      flashcardControls.classList.add('hidden');
      flashcardEmpty.classList.remove('hidden');
    } else {
      flashcardContainer.classList.remove('hidden');
      flashcardControls.classList.remove('hidden');
      flashcardEmpty.classList.add('hidden');
      showFlashcard();
    }
  } catch (error) {
    console.error('載入字卡失敗:', error);
  }
}

// 將文字安全地放進 HTML 屬性（例句為 AI 生成內容，可能含引號）
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 語音朗讀（本機 Kokoro TTS, 由伺服器代理呼叫；找不到語音服務時會靜默失敗）
let currentAudio = null;
let selectedVoiceId = localStorage.getItem('vocab-app.voiceId') || 'af_heart';

async function speakText(text) {
  if (!text) return;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  try {
    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId: selectedVoiceId })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('語音播放失敗:', err.error || response.status);
      return;
    }
    const blob = await response.blob();
    currentAudio = new Audio(URL.createObjectURL(blob));
    currentAudio.play();
  } catch (error) {
    console.error('語音播放失敗:', error);
  }
}

// 朗讀目前這張字卡的單字
function speakCurrentWord() {
  const word = flashcardWords[currentFlashcardIndex];
  if (word) speakText(word.word);
}

// 朗讀目前這張字卡的完整例句（克漏字挖空前的原句）
function speakCurrentSentence() {
  const word = flashcardWords[currentFlashcardIndex];
  if (word && word._clozeSourceSentence) speakText(word._clozeSourceSentence);
}

// 載入可選語音清單，填入語音選擇下拉選單
async function loadVoices() {
  try {
    const response = await fetch('/api/voices');
    const voices = await response.json();
    const select = document.getElementById('voice-select');
    if (!select) return;
    select.innerHTML = voices.map(v =>
      `<option value="${v.id}" ${v.id === selectedVoiceId ? 'selected' : ''}>${v.label}</option>`
    ).join('');
  } catch (error) {
    console.error('載入語音清單失敗:', error);
  }
}

function onVoiceChange(voiceId) {
  selectedVoiceId = voiceId;
  localStorage.setItem('vocab-app.voiceId', voiceId);
}

// 從例句做克漏字：找一句包含這個單字（含常見詞尾變化）的例句並挖空,
// 找不到符合的例句就回傳 null, 前端會退回顯示完整單字
function buildCloze(word) {
  if (!word.examples || word.examples.length === 0) return null;

  const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\w*\\b`, 'i');

  for (const ex of word.examples) {
    if (pattern.test(ex.en)) {
      word._clozeSourceSentence = ex.en;
      return ex.en.replace(pattern, '_____');
    }
  }
  word._clozeSourceSentence = null;
  return null;
}

// 顯示字卡
function showFlashcard() {
  if (currentFlashcardIndex >= flashcardWords.length) {
    // 全部複習完畢
    flashcardContainer.classList.add('hidden');
    flashcardControls.classList.add('hidden');
    flashcardEmpty.classList.remove('hidden');
    return;
  }

  const word = flashcardWords[currentFlashcardIndex];

  // 重置翻轉狀態
  flashcard.classList.remove('flipped');

  // 正面：找得到例句就做克漏字, 找不到就退回顯示完整單字
  const wordEl = document.getElementById('flashcard-word');
  const clozeEl = document.getElementById('flashcard-cloze');
  const cloze = buildCloze(word);
  if (cloze) {
    clozeEl.textContent = cloze;
    clozeEl.classList.remove('hidden');
    wordEl.classList.add('hidden');
  } else {
    wordEl.textContent = word.word;
    wordEl.classList.remove('hidden');
    clozeEl.classList.add('hidden');
  }

  // 背面：答案 (單字本身) + 其他資訊
  document.getElementById('flashcard-back-word').textContent = word.word;
  document.getElementById('flashcard-pos').textContent = word.pos;
  document.getElementById('flashcard-explanation').textContent = word.explanation;

  const examplesHtml = word.examples.map(ex => `
    <p class="mb-1 flex items-center gap-1">
      <strong>${ex.en}</strong>
      <button
        type="button"
        class="example-speak-btn text-indigo-400 hover:text-indigo-600 transition"
        data-text="${escapeHtml(ex.en)}"
        title="播放例句發音"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path>
        </svg>
      </button>
    </p>
    <p class="text-gray-500 mb-2">${ex.zh}</p>
  `).join('');
  const examplesContainer = document.getElementById('flashcard-examples');
  examplesContainer.innerHTML = examplesHtml;
  examplesContainer.querySelectorAll('.example-speak-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakText(btn.dataset.text);
    });
  });

  // 更新進度
  document.getElementById('flashcard-progress').textContent =
    `${currentFlashcardIndex + 1} / ${flashcardWords.length}`;
}

// 標記熟悉度
async function markMastery(mastered) {
  const word = flashcardWords[currentFlashcardIndex];

  try {
    await fetch(`/api/words/${word.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mastered: mastered ? 1 : 0 })
    });

    // 下一張
    currentFlashcardIndex++;
    showFlashcard();

  } catch (error) {
    console.error('更新失敗:', error);
  }
}

// 重置所有熟悉度
async function resetAllMastery() {
  try {
    const response = await fetch('/api/words');
    const words = await response.json();

    // 批量重置
    for (const word of words) {
      await fetch(`/api/words/${word.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mastered: 0 })
      });
    }

    // 重新載入
    loadFlashcards();

  } catch (error) {
    console.error('重置失敗:', error);
  }
}

// 將 quickLookup 和 deleteWord 暴露到全域
window.quickLookup = quickLookup;
window.deleteWord = deleteWord;
window.setDictionaryFilter = setDictionaryFilter;
window.speakCurrentWord = speakCurrentWord;
window.speakCurrentSentence = speakCurrentSentence;
