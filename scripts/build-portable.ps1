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

Write-Host "== 清除舊的打包結果 =="
if (Test-Path $PackageDir) { Remove-Item -Recurse -Force $PackageDir }
New-Item -ItemType Directory -Force -Path $AppDir, $NodeDir, $CacheDir | Out-Null

Write-Host "== 複製程式碼 (不含 node_modules, .env, vocabulary.db) =="
$filesToCopy = @('server.js', 'providers.js', 'database.js', 'package.json', 'package-lock.json', '.env.example')
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

注意事項:
- 這個資料夾裡沒有放任何人的 API Key, 需要你自己輸入才能查詢
- 查詢紀錄和字典資料會存在 app\vocabulary.db, 移除整個資料夾就會清空
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
