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
const apikeyInput = document.getElementById('apikey-input');
const apikeyRemember = document.getElementById('apikey-remember');
const apikeyCancel = document.getElementById('apikey-cancel');
const apikeyConfirm = document.getElementById('apikey-confirm');
const apikeyClearRow = document.getElementById('apikey-clear-row');
const apikeyClearBtn = document.getElementById('apikey-clear-btn');

// 供應商資料與使用者輸入的 API Key（依使用者選擇, 存於記憶體或瀏覽器 local storage）
let providersInfo = [];
const apiKeyOverrides = {};

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
    const words = await response.json();

    const listEl = document.getElementById('dictionary-list');
    const emptyEl = document.getElementById('empty-dictionary');
    const countEl = document.getElementById('word-count');

    if (words.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      countEl.textContent = '';
      return;
    }

    emptyEl.classList.add('hidden');
    countEl.textContent = `共 ${words.length} 個單字`;

    listEl.innerHTML = words.map(word => `
      <div class="dictionary-item ${word.mastered ? 'mastered' : ''}" data-id="${word.id}">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-lg text-gray-800">${word.word}</span>
              <span class="text-sm text-indigo-500">${word.pos}</span>
              ${word.mastered ? '<span class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded">已熟悉</span>' : ''}
            </div>
            <p class="text-gray-600 mt-1">${word.explanation}</p>
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

  } catch (error) {
    console.error('載入字典失敗:', error);
  }
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

  // 更新內容
  document.getElementById('flashcard-word').textContent = word.word;
  document.getElementById('flashcard-pos').textContent = word.pos;
  document.getElementById('flashcard-explanation').textContent = word.explanation;

  const examplesHtml = word.examples.map(ex => `
    <p class="mb-1"><strong>${ex.en}</strong></p>
    <p class="text-gray-500 mb-2">${ex.zh}</p>
  `).join('');
  document.getElementById('flashcard-examples').innerHTML = examplesHtml;

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
