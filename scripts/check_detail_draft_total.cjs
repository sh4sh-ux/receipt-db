#!/usr/bin/env node
const {chromium}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..'),port=4178;
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return;}
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  });
});

(async()=>{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--disable-crash-reporter','--disable-crashpad','--noerrdialogs']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
    await page.evaluate(async()=>{
      await new Promise(resolve=>setTimeout(resolve,80));
      await dbClear('receipts');await dbClear('images');
      const now=nowISO(),receipt={id:'rec_20261006_001_total',date:'2026-10-06',time:'22:13',store:'축제 노래연습장',category:'노래방',total:44000,items:[{name:'노래방 (1시간)',quantity:1,unitPrice:30000,amount:30000},{name:'소주',quantity:2,unitPrice:7000,amount:14000}],participants:['신유철','조상현'],paidBy:'조상현',tags:[],notes:'',createdAt:now,updatedAt:now};
      await dbPut('receipts',receipt);await loadAll();selectedId=receipt.id;renderSide();await renderDetail();
    });
    await page.locator('#detailItemsToggle').dispatchEvent('click');
    const quantity=page.locator('#itemsTable input[data-f="quantity"]').nth(1);
    await quantity.evaluate(el=>{el.value='3';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const draft={
      totalInput:await page.locator('#dTotalAmt').inputValue(),
      card:await page.locator('#detailBody .det-hd-amt').textContent(),
      header:await page.locator('#mainSub').textContent(),
      audit:await page.locator('#detailAmountAudit').textContent(),
    };
    if(draft.totalInput!=='51,000'||draft.card.trim()!=='51,000원'||!draft.header.includes('51,000원')||!draft.audit.includes('금액 확인 완료'))throw new Error(`편집 중 금액 표시 불일치: ${JSON.stringify(draft)}`);
    await page.locator('#detailConfirmBtn').dispatchEvent('click');
    await page.waitForFunction(async()=>{const r=await dbGet('receipts','rec_20261006_001_total');return r&&r.total===51000;});
    const saved=await page.evaluate(async()=>({db:(await dbGet('receipts','rec_20261006_001_total')).total,card:document.querySelector('#detailBody .det-hd-amt')?.textContent||'',header:document.getElementById('mainSub')?.textContent||''}));
    if(saved.db!==51000||saved.card.trim()!=='51,000원'||!saved.header.includes('51,000원'))throw new Error(`저장 후 금액 표시 불일치: ${JSON.stringify(saved)}`);
    console.log('OK: 품목 수정 즉시 오른쪽 헤더·카드·합계·검증과 저장값이 같은 금액을 표시합니다');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error.stack||error);server.close();process.exit(1);});
