#!/usr/bin/env node
const {chromium}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..'),port=4179;
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

async function seed(page){
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
    await new Promise(resolve=>setTimeout(resolve,80));
    await dbClear('receipts');await dbClear('images');
    const now=nowISO(),receipt={id:'rec_20261027_001_order',date:'2026-10-27',time:'23:45',store:'축제 노래연습장',category:'노래방',total:60000,items:[{name:'첫 품목',quantity:1,unitPrice:10000,amount:10000},{name:'둘째 품목',quantity:1,unitPrice:20000,amount:20000},{name:'셋째 품목',quantity:1,unitPrice:30000,amount:30000}],participants:['이영환','조상현'],paidBy:'조상현',tags:[],notes:'',createdAt:now,updatedAt:now};
    await dbPut('receipts',receipt);await loadAll();selectedId=receipt.id;_mobileListMode='detail';switchTab('list');renderSide();await renderDetail();
  });
  await page.locator('#detailItemsToggle').dispatchEvent('click');
}

async function names(page){return page.locator('#itemsTable tr[data-idx] input[data-f="name"]').evaluateAll(inputs=>inputs.map(input=>input.value));}
async function saveAndRead(page){
  const expected=await names(page);
  await page.locator('#detailConfirmBtn').dispatchEvent('click');
  await page.waitForFunction(async expected=>{const r=await dbGet('receipts','rec_20261027_001_order');return r&&r.items.map(x=>x.name).join('|')===expected.join('|');},expected);
  return page.evaluate(async()=>{const r=await dbGet('receipts','rec_20261027_001_order');return r.items.map(x=>x.name);});
}

(async()=>{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--disable-crash-reporter','--disable-crashpad','--noerrdialogs']});
  try{
    const pc=await browser.newPage({viewport:{width:1280,height:900}});await seed(pc);
    const firstHandle=pc.locator('.item-drag-handle').first();await firstHandle.focus();await firstHandle.press('ArrowDown');
    const pcOrder=await names(pc);
    if(pcOrder.join('|')!=='둘째 품목|첫 품목|셋째 품목')throw new Error(`PC 키보드 순서 변경 실패: ${pcOrder.join('|')}`);
    const pcSaved=await saveAndRead(pc);
    if(pcSaved.join('|')!==pcOrder.join('|'))throw new Error(`PC 저장 순서 불일치: ${pcSaved.join('|')}`);
    await pc.close();

    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1'});
    const mobile=await context.newPage();await seed(mobile);
    const noOverlap=await mobile.locator('#itemsTable tr[data-idx]').first().evaluate(row=>{
      const amount=row.querySelector('input[data-f="amount"]').getBoundingClientRect();
      const actions=row.querySelector('.detail-item-actions').getBoundingClientRect();
      return {ok:amount.right<=actions.left+.5,amountRight:amount.right,actionsLeft:actions.left};
    });
    if(!noOverlap.ok)throw new Error(`모바일 금액과 순서·삭제 버튼 겹침: amountRight=${noOverlap.amountRight}, actionsLeft=${noOverlap.actionsLeft}`);
    const handles=mobile.locator('.item-drag-handle'),from=await handles.first().boundingBox(),to=await handles.nth(2).boundingBox();
    if(!from||!to)throw new Error('모바일 드래그 핸들 위치를 찾지 못함');
    await mobile.mouse.move(from.x+from.width/2,from.y+from.height/2);await mobile.mouse.down();
    await mobile.mouse.move(to.x+to.width/2,to.y+to.height+10,{steps:8});await mobile.mouse.up();
    const mobileOrder=await names(mobile);
    if(mobileOrder.join('|')!=='둘째 품목|셋째 품목|첫 품목')throw new Error(`모바일 드래그 순서 변경 실패: ${mobileOrder.join('|')}`);
    const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
    if(overflow)throw new Error('모바일 품목 핸들 추가 후 가로 넘침 발생');
    const mobileSaved=await saveAndRead(mobile);
    if(mobileSaved.join('|')!==mobileOrder.join('|'))throw new Error(`모바일 저장 순서 불일치: ${mobileSaved.join('|')}`);
    await context.close();
    console.log('OK: PC 키보드와 모바일 드래그로 품목 순서를 바꾸고 저장 후에도 유지합니다');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error.stack||error);server.close();process.exit(1);});
