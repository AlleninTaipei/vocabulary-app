# 打包成可携式版本 (Windows), 給沒有安裝 Node.js 的人試用
# 用法: powershell -ExecutionPolicy Bypass -File scripts\build-portable.ps1

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$NodeVersion = (node --version).TrimStart('v')
$DistDir = Join-Path $RepoRoot 'dist'
$PackageDir = Join-Path $DistDir 'vocab-app-portable'
$AppDir = Join-Path $PackageDir 'app'
$NodeDir = Join-Path $PackageDir 'node'
$CacheDir = Join-Path $DistDir '_cache'
$NodeZipUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
$NodeZipPath = Join-Path $CacheDir "node-v$NodeVersion-win-x64.zip"

# 語音功能 (Kokoro TTS sidecar) 相關設定
$PythonVersion = '3.12.7'
$PythonZipUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$PythonZipPath = Join-Path $CacheDir "python-$PythonVersion-embed-amd64.zip"
$GetPipUrl = 'https://bootstrap.pypa.io/get-pip.py'
$GetPipPath = Join-Path $CacheDir 'get-pip.py'
$TtsServiceSrcDir = Join-Path $RepoRoot 'tts-service'
$TtsServiceDir = Join-Path $AppDir 'tts-service'
$PythonDir = Join-Path $TtsServiceDir 'python'
# 本機已有 script-kokoro-app 的 Kokoro 模型檔與已快取的語音包時, 打包時直接沿用,
# 不用每次都重新從 Hugging Face 下載
$KokoroOnnxSource = 'D:\repo\script-kokoro-app\kokoro.onnx'
$HfCacheSource = Join-Path $env:USERPROFILE '.cache\huggingface\hub\models--hexgrad--Kokoro-82M'

Write-Host "== 清除舊的打包結果 =="
if (Test-Path $PackageDir) { Remove-Item -Recurse -Force $PackageDir }
New-Item -ItemType Directory -Force -Path $AppDir, $NodeDir, $CacheDir | Out-Null

Write-Host "== 複製程式碼 (不含 node_modules, .env, vocabulary.db) =="
$filesToCopy = @('server.js', 'providers.js', 'database.js', 'tts.js', 'package.json', 'package-lock.json', '.env.example')
foreach ($f in $filesToCopy) {
  Copy-Item (Join-Path $RepoRoot $f) $AppDir
}
Copy-Item (Join-Path $RepoRoot 'public') $AppDir -Recurse
Copy-Item (Join-Path $RepoRoot 'scripts') $AppDir -Recurse -Exclude 'build-portable.ps1'

Write-Host "== 複製 node_modules (沿用目前已安裝好的內容, 純 JS 依賴不需重新安裝) =="
Copy-Item (Join-Path $RepoRoot 'node_modules') $AppDir -Recurse

Write-Host "== 下載可携式 Node.js v$NodeVersion (win-x64) =="
if (-not (Test-Path $NodeZipPath)) {
  Invoke-WebRequest -Uri $NodeZipUrl -OutFile $NodeZipPath
} else {
  Write-Host "已有快取, 跳過下載: $NodeZipPath"
}

Write-Host "== 解壓縮並取出 node.exe =="
$ExtractTemp = Join-Path $CacheDir "node-v$NodeVersion-win-x64"
if (Test-Path $ExtractTemp) { Remove-Item -Recurse -Force $ExtractTemp }
Expand-Archive -Path $NodeZipPath -DestinationPath $CacheDir -Force
Copy-Item (Join-Path $ExtractTemp 'node.exe') $NodeDir

Write-Host "== 語音功能 (Kokoro TTS): 準備內嵌版 Python =="
New-Item -ItemType Directory -Force -Path $PythonDir | Out-Null

if (-not (Test-Path $PythonZipPath)) {
  Invoke-WebRequest -Uri $PythonZipUrl -OutFile $PythonZipPath
} else {
  Write-Host "已有快取, 跳過下載: $PythonZipPath"
}
Expand-Archive -Path $PythonZipPath -DestinationPath $PythonDir -Force

# 內嵌版 Python 預設關閉 site-packages 且沒有 pip, 需取消 ._pth 裡 "import site" 的註解才能安裝套件
$PthFile = Get-ChildItem $PythonDir -Filter 'python3*._pth' | Select-Object -First 1
(Get-Content $PthFile.FullName) -replace '^#\s*import site', 'import site' | Set-Content $PthFile.FullName

if (-not (Test-Path $GetPipPath)) {
  Invoke-WebRequest -Uri $GetPipUrl -OutFile $GetPipPath
} else {
  Write-Host "已有快取, 跳過下載: $GetPipPath"
}
$PythonExe = Join-Path $PythonDir 'python.exe'
& $PythonExe $GetPipPath --no-warn-script-location
if ($LASTEXITCODE -ne 0) { throw "get-pip.py 失敗 (exit code $LASTEXITCODE)" }

# 內嵌版 Python 沒有內建 setuptools/wheel, 部分套件的間接依賴 (例如 docopt) 只有原始碼發行版,
# 缺 setuptools.build_meta 會導致 pip install 失敗, 需先手動裝好
& $PythonExe -m pip install --no-warn-script-location setuptools wheel
if ($LASTEXITCODE -ne 0) { throw "安裝 setuptools/wheel 失敗 (exit code $LASTEXITCODE)" }

Write-Host "== 語音功能: 安裝精簡版 Kokoro 依賴 (需要網路連線, 只在建置機器上跑一次) =="
& $PythonExe -m pip install --no-warn-script-location -r (Join-Path $TtsServiceSrcDir 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw "安裝 tts-service 依賴失敗 (exit code $LASTEXITCODE), 語音功能無法使用" }

Write-Host "== 語音功能: 複製 sidecar 程式與模型檔 =="
Copy-Item (Join-Path $TtsServiceSrcDir 'server.py') $TtsServiceDir
Copy-Item (Join-Path $TtsServiceSrcDir 'requirements.txt') $TtsServiceDir

$ModelDir = Join-Path $TtsServiceDir 'model'
New-Item -ItemType Directory -Force -Path $ModelDir | Out-Null

if (Test-Path $KokoroOnnxSource) {
  Copy-Item $KokoroOnnxSource (Join-Path $ModelDir 'kokoro.onnx')
} else {
  Write-Warning "找不到 $KokoroOnnxSource, 請先在 script-kokoro-app 依 test_onnx.py 產生 kokoro.onnx 後再重新打包, 否則語音功能將無法使用。"
}

if (Test-Path $HfCacheSource) {
  # 保留 Hugging Face 原本的快取目錄結構 (hub/models--hexgrad--Kokoro-82M/...),
  # 讓 sidecar 以 HF_HUB_OFFLINE=1 執行時能直接讀到本機快取, 不需連網下載模型設定檔與語音包
  $HfCacheDest = Join-Path $ModelDir 'hf-cache\hub\models--hexgrad--Kokoro-82M'
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $HfCacheDest) | Out-Null
  Copy-Item $HfCacheSource $HfCacheDest -Recurse -Force
} else {
  Write-Warning "找不到本機 Hugging Face 快取 ($HfCacheSource), 語音功能將無法使用。請先在 script-kokoro-app 環境下執行過一次 Kokoro 推論以產生快取。"
}

Write-Host "== 寫入啟動腳本與使用說明 =="

# .bat 內容故意全部用英文, 避免 cmd.exe 對中文編碼 (尤其是 UTF-8 BOM) 處理不一致
# 導致整個批次檔亂碼、無法執行. 中文說明改放在 使用說明.txt (純文字檔, 用 Notepad 開, 沒有這個問題)
$batContent = @'
@echo off
cd /d "%~dp0app"

echo Cleaning up any stuck connections on port 3000...
"%~dp0node\node.exe" scripts\kill-port.js 3000

echo Starting Vocabulary App server...
start "Vocabulary App Server (close this window to stop)" "%~dp0node\node.exe" server.js

echo Waiting for the server to be ready...
"%~dp0node\node.exe" scripts\wait-for-server.js 3000
if errorlevel 1 (
  echo.
  echo Server did not start in time. Check the "Server" window for error messages.
  echo Common causes: antivirus scanning node.exe on first run, or port 3000 already in use.
  pause
  exit /b 1
)

start "" http://127.0.0.1:3000
'@
# 用不帶 BOM 的方式寫入, 否則 cmd.exe 會把開頭的 BOM 位元組當成亂碼字元,
# 導致整個 .bat 無法執行 (即使內容全是英文, 有 BOM 一樣會壞)
$batPath = Join-Path $PackageDir '啟動.bat'
$normalized = ($batContent -replace "`r`n", "`n") -replace "`n", "`r`n"
[System.IO.File]::WriteAllText($batPath, $normalized, (New-Object System.Text.ASCIIEncoding))

$readmeContent = @'
我的單字本 - 可携式版本
========================

使用方式:
1. 雙擊「啟動.bat」
2. 會自動開啟一個新的黑色視窗 (伺服器), 幾秒後瀏覽器會自動打開查詢頁面
3. 第一次查單字時, 如果畫面跳出「需要 API Key」的視窗, 請輸入你自己的 API Key
   (可以點視窗裡的連結去對應網站申請), 或改用 Ollama / LM Studio 這類本機模型
4. 要關閉程式, 直接關掉「伺服器視窗」那個黑色視窗即可, 瀏覽器分頁可以照常關掉
5. 字卡頁面的喇叭按鈕是本機語音朗讀功能, 開啟程式後前幾秒語音引擎還在載入,
   這段時間點喇叭按鈕不會有聲音, 稍等一下再試即可; 之後全程不需要網路連線

注意事項:
- 這個資料夾裡沒有放任何人的 API Key, 需要你自己輸入才能查詢
- 查詢紀錄和字典資料會存在 app\vocabulary.db, 移除整個資料夾就會清空
- 語音朗讀的音檔快取會存在 app\audio-cache, 同一句話只會合成一次
- 僅支援 Windows 64 位元系統
- 伺服器只會監聽本機 (127.0.0.1), 不會對外部網路開放

如果瀏覽器出現「無法連上這個網站 / 拒絕連線」:
- 通常是伺服器還在啟動中 (企業電腦的防毒軟體第一次掃描 node.exe 會比較久),
  等「伺服器視窗」裡出現方框圖案的啟動訊息後, 重新整理頁面即可
- 如果「伺服器視窗」顯示 EADDRINUSE 之類的錯誤, 代表 port 3000 被其他程式占用,
  重新雙擊一次「啟動.bat」通常就會清掉
- 如果公司電腦完全不允許執行未知的 .exe (資安政策), 這個方式就無法使用,
  需要改用其他部署方式 (例如請 IT 白名單, 或改成 Docker/伺服器集中部署)
'@
Set-Content -Path (Join-Path $PackageDir '使用說明.txt') -Value $readmeContent -Encoding UTF8

Write-Host "== 完成 =="
Write-Host "打包結果位於: $PackageDir"
Write-Host "可以手動壓縮成 zip 分享給對方, 或執行:"
Write-Host "  Compress-Archive -Path '$PackageDir' -DestinationPath '$DistDir\vocab-app-portable-win64.zip' -Force"
