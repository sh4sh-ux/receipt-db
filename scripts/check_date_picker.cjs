#!/usr/bin/env node
const {chromium}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');

const receiptRoot=path.resolve(__dirname,'..');
const dutchRoot=path.resolve(__dirname,'..','..','dutch-pay');
const receiptUrl='http://127.0.0.1:4173/';
const dutchUrl='http://127.0.0.1:4174/';

function startServer(root,port){
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,data)=>{
      if(error){res.writeHead(404).end();return;}
      const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    });
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server));});
}

async function openPage(browser,url,mobile){
  const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1280,height:900},
    hasTouch:mobile,
    isMobile:mobile,
  });
  await context.addInitScript(()=>{
    window.__nativeDatePickerCalls=0;
    HTMLInputElement.prototype.showPicker=function(){window.__nativeDatePickerCalls++;};
  });
  const page=await context.newPage();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  return {context,page};
}

async function checkReceipt(browser,mobile){
  const {context,page}=await openPage(browser,receiptUrl,mobile);
  const open=()=>page.locator('label.kv-date').dispatchEvent('click');
  await open();
  const suffix=mobile?'.mobile':'';
  if(await page.locator(`.date-pop${suffix}`).count()!==1)throw new Error(`영수증 ${mobile?'모바일':'PC'} 달력이 한 개 열리지 않음`);
  if((await page.locator('.date-pop-backdrop').count())!==(mobile?1:0))throw new Error('영수증 모바일 배경 수 불일치');
  if(await page.evaluate(()=>window.__nativeDatePickerCalls)!==0)throw new Error('영수증 네이티브 달력이 호출됨');
  await page.locator('.date-pop-title').click();
  if(await page.locator('.date-pop-choice[data-date-year]').count()!==12)throw new Error('영수증 연도 선택 12개 아님');
  await page.locator('.date-pop-choice[data-date-year]:not(:disabled)').nth(5).click();
  if(await page.locator('.date-pop-choice[data-date-month]').count()!==12)throw new Error('영수증 월 선택 12개 아님');
  await page.locator('.date-pop-choice[data-date-month="9"]').click();
  await page.locator('.date-pop-day[data-date-value$="-10-15"]').click();
  if(!/-10-15$/.test(await page.locator('#addDate').inputValue()))throw new Error('영수증 날짜 반영 실패');
  await open();
  await open();
  if(await page.locator('.date-pop').count()!==0)throw new Error('영수증 같은 칸 재클릭 닫기 실패');
  const openTime=()=>page.locator('label.kv-time').dispatchEvent('click');
  await openTime();
  const timeSuffix=mobile?'.mobile':'';
  if(await page.locator(`.time-pop${timeSuffix}`).count()!==1)throw new Error(`영수증 ${mobile?'모바일':'PC'} 시간 선택기가 한 개 열리지 않음`);
  if((await page.locator('.time-pop-backdrop').count())!==(mobile?1:0))throw new Error('영수증 모바일 시간 배경 수 불일치');
  if(await page.evaluate(()=>window.__nativeDatePickerCalls)!==0)throw new Error('영수증 네이티브 시간 다이얼이 호출됨');
  await page.locator('[data-time-hour]').selectOption('20');
  await page.locator('[data-time-minute]').selectOption('57');
  await page.locator('[data-time-done]').click();
  if(await page.locator('#addTime').inputValue()!=='20:57')throw new Error('영수증 시간 반영 실패');
  await openTime();
  await openTime();
  if(await page.locator('.time-pop').count()!==0)throw new Error('영수증 같은 시간 칸 재클릭 닫기 실패');
  await context.close();
}

async function checkDutch(browser,mobile){
  const {context,page}=await openPage(browser,dutchUrl,mobile);
  const open=()=>page.locator('#meetingDateInp').evaluate(inp=>inp.closest('.dp-wrap').dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await open();
  const suffix=mobile?'.mobile':'';
  if(await page.locator(`.dp-pop${suffix}`).count()!==1)throw new Error(`더치페이 ${mobile?'모바일':'PC'} 달력이 한 개 열리지 않음`);
  if((await page.locator('.dp-pop-backdrop').count())!==(mobile?1:0))throw new Error('더치페이 모바일 배경 수 불일치');
  if(await page.evaluate(()=>window.__nativeDatePickerCalls)!==0)throw new Error('더치페이 네이티브 달력이 호출됨');
  await page.locator('.dp-pop-title').click();
  if(await page.locator('.dp-pop-choice[data-dp-year]').count()!==12)throw new Error('더치페이 연도 선택 12개 아님');
  await page.locator('.dp-pop-choice[data-dp-year]:not(:disabled)').nth(5).click();
  if(await page.locator('.dp-pop-choice[data-dp-month]').count()!==12)throw new Error('더치페이 월 선택 12개 아님');
  await page.locator('.dp-pop-choice[data-dp-month="9"]').click();
  await page.locator('.dp-pop-day[data-dp-value$="-10-15"]').click();
  if(!/-10-15$/.test(await page.locator('#meetingDateInp').inputValue()))throw new Error('더치페이 날짜 반영 실패');
  await open();
  await open();
  if(await page.locator('.dp-pop').count()!==0)throw new Error('더치페이 같은 칸 재클릭 닫기 실패');
  await context.close();
}

(async()=>{
  const servers=await Promise.all([startServer(receiptRoot,4173),startServer(dutchRoot,4174)]);
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--disable-crash-reporter','--disable-crashpad','--noerrdialogs']});
  try{
    await checkReceipt(browser,false);
    await checkReceipt(browser,true);
    await checkDutch(browser,false);
    await checkDutch(browser,true);
    console.log('OK: 두 앱 날짜 및 영수증 시간 선택기의 PC·모바일 UI와 동작이 동일합니다');
  }finally{await browser.close();servers.forEach(server=>server.close());}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
