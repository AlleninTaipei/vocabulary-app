const { execSync } = require('child_process');
const port = process.argv[2] || '3000';

try {
  const output = execSync('netstat -ano').toString();
  const pids = output
    .split('\n')
    .filter(l => l.includes(`:${port} `) || l.includes(`:${port}\r`))
    .filter(l => l.includes('LISTENING'))
    .map(l => l.trim().split(/\s+/).pop())
    .filter(pid => pid && /^\d+$/.test(pid) && pid !== '0');

  [...new Set(pids)].forEach(pid => {
    try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (_) {}
  });
} catch (_) {}
