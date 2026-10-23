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

const profiles=[
  {label:'PC',mobile:false,viewport:{width:1280,height:900},hasTouch:false,isMobile:false},
  {label:'안드로이드',mobile:true,viewport:{width:412,height:915},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36'},
  {label:'아이폰',mobile:true,viewport:{width:390,height:844},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1'},
];

async function openPage(browser,url,profile){
  const {label,mobile,...options}=profile;
  const context=await browser.newContext(options);
  await context.addInitScript(()=>{
    window.__nativeDatePickerCalls=0;
    HTMLInputElement.prototype.showPicker=function(){window.__nativeDatePickerCalls++;};
  });
  const page=await context.newPage();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  return {context,page};
}

async function assertFits(page,selector,label){
  const result=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,vw:innerWidth,vh:innerHeight,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};});
  if(result.left<0||result.top<0||result.right>result.vw||result.bottom>result.vh||result.overflow)throw new Error(`${label} 화면 넘침: ${JSON.stringify(result)}`);
}

async function assertPullRefreshBlocked(page,targetSelector,pickerSelector,label){
  await page.locator(targetSelector).evaluate(el=>{
    const fire=(type,y)=>{
      const point={clientX:innerWidth/2,clientY:y};
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(event,'touches',{value:type==='touchend'?[]:[point]});
      Object.defineProperty(event,'changedTouches',{value:[point]});
      el.dispatchEvent(event);
    };
    fire('touchstart',220);fire('touchmove',320);fire('touchend',320);
  });
  await page.waitForTimeout(450);
  const state=await page.evaluate(selector=>{const ind=document.querySelector('.ptr-ind');return{picker:document.querySelectorAll(selector).length,opacity:ind?.style.opacity||'',transform:ind?.style.transform||'',spin:!!ind?.classList.contains('spin')};},pickerSelector);
  if(state.picker!==1||state.opacity||state.transform||state.spin)throw new Error(`${label} 스크롤이 당겨서 새로고침을 시작함: ${JSON.stringify(state)}`);
}

async function clickTimeOption(page,selector){
  const option=page.locator(selector);
  await option.evaluate(el=>{const list=el.closest('.time-pop-list');if(list)list.scrollTop=Math.max(0,el.offsetTop-(list.clientHeight-el.offsetHeight)/2);});
  await option.click();
}

async function checkReceipt(browser,profile){
  const {mobile,label}=profile,{context,page}=await openPage(browser,receiptUrl,profile);
  const open=()=>page.locator('label.kv-date').dispatchEvent('click');
  await open();
  const suffix=mobile?'.mobile':'';
  if(await page.locator(`.date-pop${suffix}`).count()!==1)throw new Error(`영수증 ${label} 달력이 한 개 열리지 않음`);
  await assertFits(page,'.date-pop',`영수증 ${label} 달력`);
  if((await page.locator('.date-pop-backdrop').count())!==(mobile?1:0))throw new Error('영수증 모바일 배경 수 불일치');
  if(mobile)await assertPullRefreshBlocked(page,'.date-pop','.date-pop',`영수증 ${label} 날짜`);
  if(await page.evaluate(()=>window.__nativeDatePickerCalls)!==0)throw new Error('영수증 네이티브 달력이 호출됨');
  await page.locator('.date-pop-title').click();
  if(await page.locator('.date-pop-choice[data-date-year]').count()!==12)throw new Error('영수증 연도 선택 12개 아님');
  await page.locator('.date-pop-choice[data-date-year]:not(:disabled)').nth(5).click();
  if(await page.locator('.date-pop-choice[data-date-month]').count()!==12)throw new Error('영수증 월 선택 12개 아님');
  await page.locator('.date-pop-choice[data-date-month="9"]').click();
  await page.locator('.date-pop-day[data-date-value$="-10-15"]').click();
  if(!/-10-15$/.test(await page.locator('#addDate').inputValue()))throw new Error('영수증 날짜 반영 실패');
  if(mobile&&await page.locator('#addDate').evaluate(inp=>document.activeElement===inp))throw new Error(`영수증 ${label} 날짜 종료 후 네이티브 input에 포커스됨`);
  if(mobile&&await page.locator('body').evaluate(body=>body.style.position==='fixed'))throw new Error(`영수증 ${label} 날짜 종료 후 배경 잠금이 남음`);
  await open();
  await open();
  if(await page.locator('.date-pop').count()!==0)throw new Error('영수증 같은 칸 재클릭 닫기 실패');
  const openTime=()=>page.locator('label.kv-time').dispatchEvent('click');
  await openTime();
  const timeSuffix=mobile?'.mobile':'';
  if(await page.locator(`.time-pop${timeSuffix}`).count()!==1)throw new Error(`영수증 ${label} 시간 선택기가 한 개 열리지 않음`);
  await assertFits(page,'.time-pop',`영수증 ${label} 시간 선택기`);
  if((await page.locator('.time-pop-backdrop').count())!==(mobile?1:0))throw new Error('영수증 모바일 시간 배경 수 불일치');
  if(mobile)await assertPullRefreshBlocked(page,'.time-pop-list[aria-label="분"]','.time-pop',`영수증 ${label} 시간`);
  if(await page.evaluate(()=>window.__nativeDatePickerCalls)!==0)throw new Error('영수증 네이티브 시간 다이얼이 호출됨');
  if(await page.locator('.time-pop select').count()!==0)throw new Error('영수증 시간에 네이티브 select가 남아 있음');
  if(await page.locator('[data-time-hour]').count()!==24||await page.locator('[data-time-minute]').count()!==60)throw new Error('영수증 앱 시·분 목록 개수 불일치');
  const beforeTime=await page.locator('#addTime').inputValue();
  if(mobile){
    if(!await page.locator('body').evaluate(body=>body.style.position==='fixed'))throw new Error(`영수증 ${label} 시간 모달의 배경 페이지가 잠기지 않음`);
    const minuteList=page.locator('.time-pop-list[aria-label="분"]');
    await minuteList.evaluate(el=>{el.scrollTop=400;el.dispatchEvent(new Event('scroll'));});
    await page.waitForTimeout(80);
    const beforeScroll=await minuteList.evaluate(el=>el.scrollTop);
    if(Math.abs(beforeScroll-400)>2||await page.locator('.time-pop').count()!==1)throw new Error(`영수증 ${label} 시간 목록 스크롤이 유지되지 않음`);
    await page.locator('[data-time-minute="12"]').evaluate(el=>el.click());
    const afterScroll=await minuteList.evaluate(el=>el.scrollTop);
    if(Math.abs(afterScroll-beforeScroll)>2)throw new Error(`영수증 ${label} 시간 선택 시 목록이 튕김: ${beforeScroll} → ${afterScroll}`);
  }
  await clickTimeOption(page,'[data-time-hour="19"]');
  if(await page.locator('.date-pop').count()!==0||await page.locator('.time-pop').count()!==1)throw new Error('영수증 시간 목록 클릭이 날짜 달력과 충돌함');
  await clickTimeOption(page,'[data-time-minute="56"]');
  if(await page.locator('#addTime').inputValue()!==beforeTime)throw new Error('영수증 시간이 완료 전에 반영됨');
  if(mobile)await page.locator('.time-pop-backdrop').click({position:{x:2,y:2}});
  else await page.locator('body').dispatchEvent('click');
  if(await page.locator('.time-pop').count()!==0||await page.locator('#addTime').inputValue()!==beforeTime)throw new Error('영수증 시간 취소가 원래 값을 보존하지 않음');
  if(mobile&&await page.locator('body').evaluate(body=>body.style.position==='fixed'))throw new Error(`영수증 ${label} 시간 취소 후 배경 잠금이 남음`);
  await openTime();
  await clickTimeOption(page,'[data-time-hour="20"]');
  await clickTimeOption(page,'[data-time-minute="57"]');
  await page.locator('[data-time-done]').click();
  if(await page.locator('#addTime').inputValue()!=='20:57')throw new Error('영수증 시간 반영 실패');
  if(mobile&&await page.locator('#addTime').evaluate(inp=>document.activeElement===inp))throw new Error(`영수증 ${label} 시간 종료 후 네이티브 input에 포커스됨`);
  if(mobile&&await page.locator('body').evaluate(body=>body.style.position==='fixed'))throw new Error(`영수증 ${label} 시간 완료 후 배경 잠금이 남음`);
  await openTime();
  await openTime();
  if(await page.locator('.time-pop').count()!==0)throw new Error('영수증 같은 시간 칸 재클릭 닫기 실패');
  await page.locator('[data-nav="input"]').click();
  await page.waitForTimeout(80);
  const scrollBefore=await page.locator('#pasteTa').evaluate(ta=>{const main=ta.closest('.main-body');return{active:document.activeElement===ta,overflow:getComputedStyle(ta).overflowY,textarea:ta.scrollTop,main:main.scrollTop,max:main.scrollHeight-main.clientHeight};});
  await page.locator('#pasteTa').hover();
  await page.mouse.wheel(0,500);
  await page.waitForTimeout(80);
  const scrollAfter=await page.locator('#pasteTa').evaluate(ta=>({textarea:ta.scrollTop,main:ta.closest('.main-body').scrollTop}));
  if(scrollBefore.active)throw new Error(`영수증 ${label} 새 화면 진입 시 붙여넣기 칸이 자동 포커스됨`);
  if(scrollBefore.overflow!=='hidden'||scrollAfter.textarea!==0)throw new Error(`영수증 ${label} 빈 붙여넣기 안내문이 스크롤을 가로챔`);
  if(scrollBefore.max>0&&scrollAfter.main<=scrollBefore.main)throw new Error(`영수증 ${label} 붙여넣기 칸 위 휠이 화면으로 전달되지 않음`);
  await context.close();
}

async function checkDutch(browser,profile){
  const {mobile,label}=profile,{context,page}=await openPage(browser,dutchUrl,profile);
  const open=()=>page.locator('#meetingDateInp').evaluate(inp=>inp.closest('.dp-wrap').dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await open();
  const suffix=mobile?'.mobile':'';
  if(await page.locator(`.dp-pop${suffix}`).count()!==1)throw new Error(`더치페이 ${label} 달력이 한 개 열리지 않음`);
  await assertFits(page,'.dp-pop',`더치페이 ${label} 달력`);
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
    for(const profile of profiles){await checkReceipt(browser,profile);await checkDutch(browser,profile);}
    console.log('OK: PC·안드로이드·아이폰에서 두 앱 날짜 및 영수증 시간 선택기의 UI와 동작이 동일합니다');
  }finally{await browser.close();servers.forEach(server=>server.close());}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
