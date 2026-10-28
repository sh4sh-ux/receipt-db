const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const expectedVersion = indexSource.match(/const APP_VERSION='(v[0-9.]+)'/)?.[1];
if (!expectedVersion) throw new Error('APP_VERSION not found');
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
    const context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('console', message => console.log(`browser:${message.type()}: ${message.text()}`));
    page.on('pageerror', error => console.log(`browser:pageerror: ${error.message}`));
    await page.goto('http://127.0.0.1:4180/', { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForURL(url => url.searchParams.get('__app_v') === expectedVersion, { timeout: 15000 });
    } catch (error) {
      const state = await page.evaluate(async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        return { href: location.href, controller: navigator.serviceWorker.controller?.scriptURL || '', registrations: regs.map(r => ({ installing: r.installing?.state, waiting: r.waiting?.state, active: r.active?.state, script: r.active?.scriptURL })) };
      });
      throw new Error(`${error.message}; state=${JSON.stringify(state)}`);
    }
    await page.waitForFunction(version => document.querySelector('#appVersion')?.textContent === version, expectedVersion);
    const registration = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { controlled: !!navigator.serviceWorker.controller, script: r.active?.scriptURL || '' };
    });
    if (!registration.controlled || !registration.script.includes(`v=${expectedVersion}`)) {
      throw new Error(`unexpected registration: ${JSON.stringify(registration)}`);
    }
    const headerStyles = await page.locator('.side-top .app-eye,.main-top .main-eye,.side-top .app-version,.main-top .app-version').evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return { text: element.textContent.trim(), color: style.color, size: style.fontSize, weight: style.fontWeight, smoothing: style.webkitFontSmoothing };
    }));
    const unclear = headerStyles.filter(style => style.color !== 'rgb(17, 17, 17)' || style.size !== '11px' || style.weight !== '700' || style.smoothing !== 'auto');
    if (unclear.length) throw new Error(`모바일 헤더 선명도 불일치: ${JSON.stringify(unclear)}`);
    console.log(`OK: 새 서비스워커가 열린 화면을 ${expectedVersion} 문서로 자동 전환합니다`);
    console.log(`OK: 모바일 ${headerStyles.length}개 헤더 눈썹·버전이 검정 11px/700으로 동일합니다`);
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
