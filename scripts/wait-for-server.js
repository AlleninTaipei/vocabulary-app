// 等到伺服器真的能回應才結束, 給啟動.bat 用, 避免固定等幾秒就開瀏覽器
// 用法: node wait-for-server.js <port> [timeoutSeconds]
const http = require('http');

const port = process.argv[2] || '3000';
const timeoutSeconds = Number(process.argv[3] || 30);
const deadline = Date.now() + timeoutSeconds * 1000;

function check() {
  const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
    res.destroy();
    process.exit(0);
  });

  req.on('error', retry);
  req.on('timeout', () => {
    req.destroy();
    retry();
  });
}

function retry() {
  if (Date.now() > deadline) {
    console.error(`等待伺服器逾時 (${timeoutSeconds} 秒), 請查看伺服器視窗的錯誤訊息.`);
    process.exit(1);
  }
  setTimeout(check, 500);
}

check();
