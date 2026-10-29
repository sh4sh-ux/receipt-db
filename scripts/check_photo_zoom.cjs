#!/usr/bin/env node
// v5.38 — 영수증 사진 확대 뷰어(핀치·더블탭·휠·버튼·끌기·뒤로가기·배경 탭 닫기)
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),port=4182;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const pn=decodeURIComponent(new URL(req.url,'http://x').pathname);const file=path.resolve(root,pn==='/'?'index.html':pn.replace(/^\/+/,''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,d)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(d);});});
const st=page=>page.evaluate(()=>({open:lightbox.classList.contains('open'),s:+_lb.s.toFixed(3),x:Math.round(_lb.x),y:Math.round(_lb.y),pct:document.getElementById('lbReset').textContent,ov:_ovStack.length}));
const ptr=(page,type,id,x,y,target)=>page.evaluate(([type,id,x,y,target])=>{const el=target==='bg'?lightbox:lightboxImg;el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y,isPrimary:id===1}));},[type,id,x,y,target||'img']);
(async()=>{
  await new Promise((ok,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',ok);});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    for(const prof of [{label:'폰',viewport:{width:390,height:844},isMobile:true,hasTouch:true},{label:'PC',viewport:{width:1280,height:900}}]){
      const ctx=await browser.newContext({...prof,serviceWorkers:'block'});const page=await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>typeof openLightbox==='function');
      const url=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=1200;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,800,1200);g.fillStyle='#333';g.font='48px sans-serif';g.fillText('RECEIPT',40,100);return c.toDataURL('image/png');});
      const open=async()=>{await page.evaluate(u=>openLightbox(u),url);await page.waitForFunction(()=>lightboxImg.complete&&lightboxImg.naturalWidth>0);};
      const must=(c,m,v)=>{if(!c)throw new Error(`${prof.label}: ${m} ${JSON.stringify(v||'')}`);};
      await open();let a=await st(page);must(a.open&&a.s===1&&a.pct==='100%'&&a.ov>=1,'열기',a);
      // 버튼
      await page.click('#lbIn');a=await st(page);must(Math.abs(a.s-1.5)<.01&&a.pct==='150%','+ 버튼',a);
      await page.click('#lbOut');a=await st(page);must(a.s===1,'− 버튼(1배에서 멈춤)',a);
      await page.click('#lbIn');await page.click('#lbReset');a=await st(page);must(a.s===1&&a.x===0&&a.y===0,'100% 버튼',a);
      // 휠
      const box=await page.locator('#lightboxImg').boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-400);a=await st(page);must(a.s>1.3,'휠 확대',a);
      await page.click('#lbReset');
      // 핀치(두 손가락): 150px → 300px = 약 2배, 가운데 고정
      const cx=prof.viewport.width/2,cy=prof.viewport.height/2;
      await ptr(page,'pointerdown',1,cx-75,cy);await ptr(page,'pointerdown',2,cx+75,cy);
      await ptr(page,'pointermove',2,cx+225,cy);a=await st(page);
      must(a.s>1.9&&a.s<2.1,'핀치 배율',a);
      // 손가락을 떼고 한 손가락 끌기 → 이동, 확대 중 배경 탭은 닫지 않음
      await ptr(page,'pointerup',2,cx+225,cy);await ptr(page,'pointerup',1,cx-75,cy);
      const before=await st(page);
      await ptr(page,'pointerdown',3,cx,cy);await ptr(page,'pointermove',3,cx-60,cy-40);await ptr(page,'pointerup',3,cx-60,cy-40);a=await st(page);
      must(a.x!==before.x||a.y!==before.y,'확대 후 끌어 이동',{before,a});
      // 한계: 아주 멀리 끌어도 사진이 화면 밖으로 사라지지 않는다
      await ptr(page,'pointerdown',4,cx,cy);await ptr(page,'pointermove',4,cx-5000,cy-5000);await ptr(page,'pointerup',4,cx-5000,cy-5000);
      const lim=await page.evaluate(()=>{const vw=lightbox.clientWidth,vh=lightbox.clientHeight,w=lightboxImg.offsetWidth*_lb.s,h=lightboxImg.offsetHeight*_lb.s;return{x:_lb.x,y:_lb.y,mx:Math.max(0,(w-vw)/2),my:Math.max(0,(h-vh)/2)};});
      must(Math.abs(lim.x)<=lim.mx+1&&Math.abs(lim.y)<=lim.my+1,'이동 한계',lim);
      await page.click('#lbReset');
      // 더블탭: 1배 → 2.5배 → 1배
      await ptr(page,'pointerdown',5,cx,cy);await ptr(page,'pointerup',5,cx,cy);await ptr(page,'pointerdown',6,cx,cy);await ptr(page,'pointerup',6,cx,cy);
      a=await st(page);must(Math.abs(a.s-2.5)<.01,'더블탭 확대',a);
      await ptr(page,'pointerdown',7,cx,cy);await ptr(page,'pointerup',7,cx,cy);await new Promise(r=>setTimeout(r,350));await ptr(page,'pointerdown',8,cx,cy);await ptr(page,'pointerup',8,cx,cy);
      a=await st(page);must(a.open&&a.s===2.5,'느린 두 번 탭은 더블탭이 아님',a);   // 350ms 간격 → 닫히지도 않음(확대 중)
      await ptr(page,'pointerdown',9,cx,cy);await ptr(page,'pointerup',9,cx,cy);await ptr(page,'pointerdown',10,cx,cy);await ptr(page,'pointerup',10,cx,cy);
      a=await st(page);must(a.s===1,'더블탭 원래 크기',a);
      // 배경(이미지 밖) 한 번 탭 → 닫힘
      await ptr(page,'pointerdown',11,5,5,'bg');await ptr(page,'pointerup',11,5,5,'bg');
      await page.waitForFunction(()=>!lightbox.classList.contains('open'),null,{timeout:3000});
      // 뒤로가기로 닫기 + 열려 있는 동안 당겨서 새로고침 차단 목록에 포함
      await open();await page.evaluate(()=>history.back());await page.waitForFunction(()=>!lightbox.classList.contains('open'),null,{timeout:3000});
      a=await st(page);must(a.s===1&&a.ov===0,'뒤로가기로 닫고 상태 초기화',a);
      // Esc, ✕
      await open();await page.keyboard.press('Escape');await page.waitForFunction(()=>!lightbox.classList.contains('open'),null,{timeout:3000});
      await open();await page.click('#lightboxClose');await page.waitForFunction(()=>!lightbox.classList.contains('open'),null,{timeout:3000});
      await ctx.close();
    }
    console.log('OK: 영수증 사진 확대 — 버튼·휠·핀치·더블탭·끌기·이동 한계·배경 탭/뒤로가기/Esc/✕ 닫기(폰·PC)');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.message||e);process.exit(1);});
