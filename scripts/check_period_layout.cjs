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
    document.querySelector('.side-search').style.display='block';
    const root=document.documentElement,nav=document.querySelector('#monthNav').getBoundingClientRect();
    const order=[...document.querySelector('#monthNav').children].map(el=>el.id||el.className);
    return {viewport:innerWidth,pageScrollWidth:root.scrollWidth,nav:{x:nav.x,width:nav.width},order,search:box('#searchInp'),prev:box('#monthPrev'),label:box('#monthLabel'),next:box('#monthNext'),all:box('#monthToday'),select:box('#batchSelectToggle')};
  });
  const expectedPad=profile.mobile?18:28;
  if(nav.pageScrollWidth>nav.viewport)throw new Error(`${profile.label}: 페이지 가로 넘침 ${JSON.stringify(nav)}`);
  if(nav.label.whiteSpace!=='nowrap'||nav.label.height>24)throw new Error(`${profile.label}: 월 표시가 두 줄 ${JSON.stringify(nav.label)}`);
  if(nav.order.join('|')!=='monthPrev|monthLabel|monthNext|month-nav-seg')throw new Error(`${profile.label}: 월 탐색 순서 불일치 ${nav.order.join('|')}`);
  if(Math.abs(nav.all.height-30)>1||Math.abs(nav.select.height-30)>1)throw new Error(`${profile.label}: 전체·선택 버튼 높이 불일치`);
  if(Math.abs(nav.all.width-nav.select.width)>1)throw new Error(`${profile.label}: 전체·선택 너비 불균형`);
  if(!(nav.prev.x<nav.label.x&&nav.label.x<nav.next.x&&nav.next.x<nav.all.x&&nav.all.x<nav.select.x))throw new Error(`${profile.label}: 이전→년월→다음→전체→선택 시각 순서 불일치`);
  if(Math.abs(nav.prev.x-nav.search.x)>1)throw new Error(`${profile.label}: 이전 화살표와 검색창 왼쪽 불일치 ${JSON.stringify({prev:nav.prev.x,search:nav.search.x})}`);
  if(Math.abs((nav.select.x+nav.select.width)-(nav.search.x+nav.search.width))>1)throw new Error(`${profile.label}: 선택 버튼과 검색창 오른쪽 불일치 ${JSON.stringify({select:nav.select.x+nav.select.width,search:nav.search.x+nav.search.width})}`);
  if(nav.nav.x+expectedPad-1>nav.prev.x)throw new Error(`${profile.label}: 왼쪽 여백 침범`);
  const segmentX=nav.all.x,selectRight=nav.select.x+nav.select.width;
  await page.locator('#monthPrev').dispatchEvent('click');
  const afterMonth=await page.locator('#monthToday').boundingBox();
  if(Math.abs(afterMonth.x-segmentX)>1)throw new Error(`${profile.label}: 한 자리 월 전환 때 버튼 위치 이동`);
  await page.locator('#batchSelectToggle').dispatchEvent('click');
  if(await page.locator('#batchSelectToggle').getAttribute('aria-pressed')!=='true')throw new Error(`${profile.label}: 선택 전환 실패`);
  const afterSelect=await page.locator('#batchSelectToggle').boundingBox();
  if(Math.abs(afterSelect.x+afterSelect.width-selectRight)>1)throw new Error(`${profile.label}: 선택→완료 전환 때 버튼 위치 이동`);
  await page.locator('#monthToday').dispatchEvent('click');
  if(await page.locator('#monthToday').getAttribute('aria-pressed')!=='true')throw new Error(`${profile.label}: 전체 전환 실패`);
  const afterAll=await page.locator('#monthToday').boundingBox();
  if(Math.abs(afterAll.x-segmentX)>1)throw new Error(`${profile.label}: 전체→이번 달 전환 때 버튼 위치 이동`);
  await page.locator('#monthLabel').dispatchEvent('click');
  const monthCalendar=await page.evaluate(()=>{const search=document.querySelector('#searchInp').getBoundingClientRect(),calendar=document.querySelector('.date-pop').getBoundingClientRect();return{search:{left:search.left,right:search.right,width:search.width},calendar:{left:calendar.left,right:calendar.right,width:calendar.width}};});
  if(Math.abs(monthCalendar.search.left-monthCalendar.calendar.left)>1||Math.abs(monthCalendar.search.right-monthCalendar.calendar.right)>1||Math.abs(monthCalendar.search.width-monthCalendar.calendar.width)>1)throw new Error(`${profile.label}: 월 달력과 검색창 양끝 불일치 ${JSON.stringify(monthCalendar)}`);
  await page.locator('#monthLabel').dispatchEvent('click');

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
      const legend=host.querySelector('.lp-leg').getBoundingClientRect();
      result[unit]={tabs:[tabs.width,tabs.height],graph:[graph.width,graph.height],legendTop:legend.top-graph.top,legendBottom:graph.bottom-legend.bottom,axisLinks:host.querySelectorAll('.lp-xaxis [data-lpx][role="button"][tabindex="0"]').length,bars:host.querySelectorAll('.lp-col').length,activeColor:getComputedStyle(host.querySelector('.lp-tab.on')).color};
    }
    host.innerHTML='<div class="psplit-viewtoggle"><button class="on">개인</button><button>그룹</button></div>';
    const split=host.querySelector('.psplit-viewtoggle').getBoundingClientRect();result.split=[split.width,split.height];result.splitActiveColor=getComputedStyle(host.querySelector('.psplit-viewtoggle button.on')).color;
    host.remove();
    return result;
  });
  const units=['year','month','day'],tabWidths=units.map(k=>trend[k].tabs[0]),tabHeights=units.map(k=>trend[k].tabs[1]),graphHeights=units.map(k=>trend[k].graph[1]);
  const legendTops=units.map(k=>trend[k].legendTop),legendBottoms=units.map(k=>trend[k].legendBottom);
  if(!closeEnough(tabWidths)||!closeEnough(tabHeights)||Math.abs(tabWidths[0]-180)>1||Math.abs(tabHeights[0]-38)>1)throw new Error(`${profile.label}: 기간 세그먼트 크기 불일치 ${JSON.stringify(trend)}`);
  if(Math.abs(trend.split[0]-180)>1||Math.abs(trend.split[1]-38)>1||Math.abs(trend.split[0]-tabWidths[0])>1||Math.abs(trend.split[1]-tabHeights[0])>1)throw new Error(`${profile.label}: 연/월/일과 개인/그룹 세그먼트 규격 불일치 ${JSON.stringify(trend)}`);
  for(const unit of units)if(trend[unit].activeColor!==trend.splitActiveColor)throw new Error(`${profile.label}: 선택 탭 파란색 불일치 ${JSON.stringify({unit,trend:trend[unit].activeColor,people:trend.splitActiveColor})}`);
  for(const unit of ['year','month','day'])if(trend[unit].axisLinks!==trend[unit].bars)throw new Error(`${profile.label}: ${unit} X축 날짜 클릭 대상 누락 ${JSON.stringify(trend[unit])}`);
  if(!closeEnough(graphHeights)||graphHeights[0]<(profile.mobile?235:227))throw new Error(`${profile.label}: 단위별 그래프 박스 높이 불일치 ${JSON.stringify(trend)}`);
  if(!closeEnough(legendTops)||!closeEnough(legendBottoms))throw new Error(`${profile.label}: 단위별 범례 Y좌표 불일치 ${JSON.stringify(trend)}`);

  const axisClick=await page.evaluate(()=>{
    _trendOv={unit:'day',from:'2026-10-21',to:'2026-10-21',page:null,key:_trendKey()};
    const body=document.getElementById('detailBody');body.innerHTML=_trendSectionHtml();
    const x=body.querySelector('[data-lpx="2026-10-21"]');x.click();
    return {mobile:_isMobileLayout(),picked:_trendPick?.k||'',sheet:!!document.querySelector('body > .mtg-sheet-backdrop')};
  });
  if(axisClick.mobile?!axisClick.sheet:axisClick.picked!=='2026-10-21')throw new Error(`${profile.label}: X축 일자 클릭 목록 열기 실패 ${JSON.stringify(axisClick)}`);

  const promptCopies=await page.evaluate(()=>({
    treat:_promptCopyText({total:22000,paidBy:'조상현',treat:true,participants:['조상현','장승욱'],items:[
      {name:'왕노가리',quantity:2,unitPrice:3000,amount:6000},
      {name:'왕쥐포',quantity:1,unitPrice:3000,amount:3000}
    ]}),
    dutch:_promptCopyText({total:114000,paidBy:'조상현',treat:false,participants:['조상현','이정환','박지연'],items:[
      {name:'동인동 매운소갈비찜 세트',quantity:1,unitPrice:89000,amount:89000},
      {name:'-SET 동인동 매운소갈비찜',quantity:1,unitPrice:0,amount:0}
    ]})
  }));
  const expectedTreat='총 22,000원 [조상현 결제]\n왕노가리 | 2 | 3,000 | 6,000\n왕쥐포 | 1 | 3,000 | 3,000';
  const expectedDutch='총 114,000원 [조상현 결제 / 더치페이]\n동인동 매운소갈비찜 세트 | 1 | 89,000 | 89,000\n-SET 동인동 매운소갈비찜 | 1 | 0 | 증정품';
  if(promptCopies.treat!==expectedTreat||promptCopies.dutch!==expectedDutch)throw new Error(`${profile.label}: 프롬프트 복사 형식 불일치 ${JSON.stringify(promptCopies)}`);

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
    for(const item of results)console.log(`${item.label}: 검색창 양끝=${Math.round(item.nav.search.x)}–${Math.round(item.nav.search.x+item.nav.search.width)}px, 탐색 양끝=${Math.round(item.nav.prev.x)}–${Math.round(item.nav.select.x+item.nav.select.width)}px, 세그먼트=${Math.round(item.trend.year.tabs[0])}×${Math.round(item.trend.year.tabs[1])}px, 범례 Y(연/월/일)=${['year','month','day'].map(k=>Math.round(item.trend[k].legendTop)).join('/')}px`);
    console.log('OK: PC·모바일 월 탐색 양끝과 검색창이 일치하고 연간·월별·일별 범례 Y좌표가 동일합니다');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
