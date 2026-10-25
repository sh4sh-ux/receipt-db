#!/usr/bin/env node
const {chromium}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const port=4190;

function startServer(){
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,data)=>{
      if(error){res.writeHead(404).end();return;}
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    });
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server));});
}

function closeEnough(values,tolerance=1){
  return Math.max(...values)-Math.min(...values)<=tolerance;
}

async function checkProfile(browser,profile){
  const context=await browser.newContext({viewport:profile.viewport,isMobile:profile.mobile,hasTouch:profile.mobile});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#monthNav');

  const nav=await page.evaluate(()=>{
    const box=selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),s=getComputedStyle(el);return{x:r.x,y:r.y,width:r.width,height:r.height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,whiteSpace:s.whiteSpace}};
    const root=document.documentElement,nav=document.querySelector('#monthNav').getBoundingClientRect();
    return {viewport:innerWidth,pageScrollWidth:root.scrollWidth,nav:{x:nav.x,width:nav.width},label:box('#monthLabel'),segment:box('.month-nav-seg'),all:box('#monthToday'),select:box('#batchSelectToggle')};
  });
  const expectedPad=profile.mobile?18:28;
  if(nav.pageScrollWidth>nav.viewport)throw new Error(`${profile.label}: 페이지 가로 넘침 ${JSON.stringify(nav)}`);
  if(nav.label.whiteSpace!=='nowrap'||nav.label.height>24)throw new Error(`${profile.label}: 월 표시가 두 줄 ${JSON.stringify(nav.label)}`);
  if(Math.abs(nav.segment.width-126)>1||Math.abs(nav.segment.height-34)>1)throw new Error(`${profile.label}: 전체·선택 세그먼트 크기 불일치 ${JSON.stringify(nav.segment)}`);
  if(Math.abs(nav.all.width-nav.select.width)>1)throw new Error(`${profile.label}: 전체·선택 너비 불균형`);
  if(nav.label.x+nav.label.width>nav.segment.x)throw new Error(`${profile.label}: 월 표시와 세그먼트 겹침`);
  if(nav.nav.x+expectedPad-1>nav.label.x)throw new Error(`${profile.label}: 왼쪽 여백 침범`);
  if(nav.segment.x+nav.segment.width>nav.nav.x+nav.nav.width-expectedPad+1)throw new Error(`${profile.label}: 오른쪽 여백 침범`);
  const segmentX=nav.segment.x;
  await page.locator('#monthPrev').dispatchEvent('click');
  const afterMonth=await page.locator('.month-nav-seg').boundingBox();
  if(Math.abs(afterMonth.x-segmentX)>1)throw new Error(`${profile.label}: 한 자리 월 전환 때 버튼 위치 이동`);
  await page.locator('#batchSelectToggle').dispatchEvent('click');
  if(await page.locator('#batchSelectToggle').getAttribute('aria-pressed')!=='true')throw new Error(`${profile.label}: 선택 전환 실패`);
  const afterSelect=await page.locator('.month-nav-seg').boundingBox();
  if(Math.abs(afterSelect.x-segmentX)>1)throw new Error(`${profile.label}: 선택→완료 전환 때 버튼 위치 이동`);
  await page.locator('#monthToday').dispatchEvent('click');
  if(await page.locator('#monthToday').getAttribute('aria-pressed')!=='true')throw new Error(`${profile.label}: 전체 전환 실패`);
  const afterAll=await page.locator('.month-nav-seg').boundingBox();
  if(Math.abs(afterAll.x-segmentX)>1)throw new Error(`${profile.label}: 전체→이번 달 전환 때 버튼 위치 이동`);

  const trend=await page.evaluate(()=>{
    receipts=[
      {id:'layout-a',date:'2024-01-03',total:10000,payer:'나',participants:['나'],category:'식비'},
      {id:'layout-b',date:'2025-06-15',total:20000,payer:'나',participants:['나'],category:'교통'},
      {id:'layout-c',date:'2026-10-21',total:30000,payer:'나',participants:['나'],category:'술집'}
    ];
    _ledgerTimeFilter={type:'all'};
    const host=document.createElement('div');
    host.style.cssText=`position:fixed;left:0;top:0;width:${innerWidth<=780?'100%':'760px'};padding:20px;background:white;z-index:99999`;
    document.body.appendChild(host);
    const result={};
    for(const unit of ['year','month','day']){
      _trendOv={unit,from:'2024-01-01',to:'2026-12-31',page:null,key:_trendKey()};
      host.innerHTML=_trendSectionHtml();
      const tabs=host.querySelector('.lp-tabs').getBoundingClientRect();
      const graph=host.querySelector('.lp-trend').getBoundingClientRect();
      result[unit]={tabs:[tabs.width,tabs.height],graph:[graph.width,graph.height]};
    }
    host.remove();
    return result;
  });
  const tabWidths=Object.values(trend).map(v=>v.tabs[0]),tabHeights=Object.values(trend).map(v=>v.tabs[1]),graphHeights=Object.values(trend).map(v=>v.graph[1]);
  if(!closeEnough(tabWidths)||!closeEnough(tabHeights)||Math.abs(tabWidths[0]-146)>1||Math.abs(tabHeights[0]-34)>1)throw new Error(`${profile.label}: 기간 세그먼트 크기 불일치 ${JSON.stringify(trend)}`);
  if(!closeEnough(graphHeights)||graphHeights[0]<(profile.mobile?235:227))throw new Error(`${profile.label}: 단위별 그래프 박스 높이 불일치 ${JSON.stringify(trend)}`);

  await context.close();
  return {label:profile.label,nav,trend};
}

(async()=>{
  const server=await startServer(),browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    const results=[];
    for(const profile of [
      {label:'PC 1280px',viewport:{width:1280,height:900},mobile:false},
      {label:'모바일 390px',viewport:{width:390,height:844},mobile:true}
    ])results.push(await checkProfile(browser,profile));
    for(const item of results)console.log(`${item.label}: 월=${Math.round(item.nav.label.width)}px, 전체·선택=${Math.round(item.nav.segment.width)}×${Math.round(item.nav.segment.height)}px, 그래프 높이(연/월/일)=${Object.values(item.trend).map(v=>Math.round(v.graph[1])).join('/')}px`);
    console.log('OK: PC·모바일 월 탐색 한 줄·여백과 연간·월별·일별 그래프 박스 높이가 동일합니다');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
