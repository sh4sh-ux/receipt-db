#!/usr/bin/env node
// v5.35 — 한국 시간 새벽(00:00~09:00)에도 '오늘' 기본 날짜가 어제(UTC)로 들어가지 않는지 검사한다.
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),port=4181;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const pn=decodeURIComponent(new URL(req.url,'http://x').pathname);const file=path.resolve(root,pn==='/'?'index.html':pn.replace(/^\/+/,''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,d)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(d);});});
(async()=>{
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'Asia/Seoul',serviceWorkers:'block'});
    await context.addInitScript(()=>{const Real=Date,off=new Real('2026-10-29T00:30:00+09:00').getTime()-Real.now();
      class D extends Real{constructor(...a){if(a.length===0)super(Real.now()+off);else super(...a);}static now(){return Real.now()+off;}}window.Date=D;});
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof switchTab==='function'&&typeof _todayYMD==='function');
    const r=await page.evaluate(()=>{switchTab('input');const t=[...document.querySelectorAll('button,[role=tab]')].find(e=>/직접 입력/.test(e.textContent)&&e.offsetParent);t&&t.click();return{today:_todayYMD(),addDate:document.getElementById('addDate')?.value||''};});
    if(r.today!=='2026-10-29')throw new Error(`로컬 오늘 날짜가 어긋남: ${JSON.stringify(r)}`);
    if(r.addDate!=='2026-10-29')throw new Error(`한국 시간 00:30에 직접 입력 날짜 기본값이 오늘이 아님: ${JSON.stringify(r)}`);
    console.log('OK: 한국 시간 새벽에도 오늘 날짜 기본값이 어제로 들어가지 않습니다');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
