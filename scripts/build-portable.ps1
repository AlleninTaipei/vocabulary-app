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

$batContent = @'
@echo off
chcp 65001 >nul
cd /d "%~dp0app"
echo 正在啟動 我的單字本 ...
start "我的單字本 - 伺服器視窗 (關閉此視窗即可停止程式)" "%~dp0node\node.exe" server.js
timeout /t 3 /nobreak >nul
start "" http://localhost:3000
'@
Set-Content -Path (Join-Path $PackageDir '啟動.bat') -Value $batContent -Encoding UTF8

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
'@
Set-Content -Path (Join-Path $PackageDir '使用說明.txt') -Value $readmeContent -Encoding UTF8

Write-Host "== 完成 =="
Write-Host "打包結果位於: $PackageDir"
Write-Host "可以手動壓縮成 zip 分享給對方, 或執行:"
Write-Host "  Compress-Archive -Path '$PackageDir' -DestinationPath '$DistDir\vocab-app-portable-win64.zip' -Force"
