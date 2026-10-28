const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

async function main() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => server.listen(4180, '127.0.0.1', resolve).once('error', reject));

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--disable-crash-reporter', '--disable-crashpad', '--noerrdialogs']
  });
  try {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    page.on('console', message => console.log(`browser:${message.type()}: ${message.text()}`));
    page.on('pageerror', error => console.log(`browser:pageerror: ${error.message}`));
    await page.goto('http://127.0.0.1:4180/', { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForURL(url => url.searchParams.get('__app_v') === 'v5.27', { timeout: 15000 });
    } catch (error) {
      const state = await page.evaluate(async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        return { href: location.href, controller: navigator.serviceWorker.controller?.scriptURL || '', registrations: regs.map(r => ({ installing: r.installing?.state, waiting: r.waiting?.state, active: r.active?.state, script: r.active?.scriptURL })) };
      });
      throw new Error(`${error.message}; state=${JSON.stringify(state)}`);
    }
    await page.waitForFunction(() => document.querySelector('#appVersion')?.textContent === 'v5.27');
    const registration = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { controlled: !!navigator.serviceWorker.controller, script: r.active?.scriptURL || '' };
    });
    if (!registration.controlled || !registration.script.includes('v=v5.27')) {
      throw new Error(`unexpected registration: ${JSON.stringify(registration)}`);
    }
    console.log('OK: 새 서비스워커가 열린 화면을 v5.27 문서로 자동 전환합니다');
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
