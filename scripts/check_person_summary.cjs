#!/usr/bin/env node
// 사람 탭 요약(더치페이 기록 보관함 모양, dpcard.css) 검사: 1280·390에서
// 월 이동·범위 칩·카드 펼침(처음엔 접힘)·영수증 표·요약 줄→기존 창·영수증 열기·더치페이 전송·사람 바꾸면 초기화·콘솔 오류.
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),port=4182;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const pn=decodeURIComponent(new URL(req.url,'http://x').pathname);const file=path.resolve(root,pn==='/'?'index.html':'.'+pn);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,d)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(d);});});
let fails=[];
const ok=(name,cond,extra)=>{if(!cond)fails.push(name+(extra?` (${extra})`:''));};
(async()=>{
  await new Promise((res,rej)=>{server.once('error',rej);server.listen(port,'127.0.0.1',res);});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    for(const [w,h] of [[1280,1000],[390,900]]){
      const ctx=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});
      const p=await ctx.newPage();
      const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push('console:'+m.text());});
      await p.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
      await p.waitForFunction(()=>typeof _selectPerson==='function'&&typeof dbPut==='function');await p.waitForTimeout(600);
      await p.evaluate(async()=>{
        setMyName('조상현');window.open=()=>({location:{},close(){}});window.confirm=()=>true;
        const R=[['r1','2026-11-17','18:50','조광',96000,'신유철',['조상현','신유철'],true,[{name:'소주',quantity:4,unitPrice:5000,amount:20000},{name:'순대모듬(대)',quantity:1,unitPrice:54000,amount:54000},{name:'술국',quantity:1,unitPrice:26000,amount:26000},{name:'[쿠폰] 할인',quantity:1,unitPrice:-4000,amount:-4000}]],
          ['r2','2026-11-17','20:44','축제 노래연습장',84000,'조상현',['조상현','신유철'],true,null],
          ['r3','2026-11-03','17:02','전북상회',70000,'조상현',['조상현','신유철','이영환'],false,null],
          ['r4','2026-11-03','23:06','SBS노래방',62000,'신유철',['조상현','신유철','이영환'],false,null],
          ['r5','2026-10-06','19:33','조광',67000,'신유철',['조상현','신유철'],true,null]];
        for(const [id,date,time,store,total,pb,pp,tr,items] of R)await dbPut('receipts',{id:'rec_'+id,date,time,store,total,items:items||[{name:store+' 메뉴',quantity:1,unitPrice:total,amount:total}],paidBy:pb,participants:pp,treat:tr,category:'외식',createdAt:nowISO(),updatedAt:nowISO()});
        await loadAll();renderSide();});
      await p.click('#navPersonBtn');await p.waitForTimeout(400);
      await p.evaluate(()=>_selectPerson('신유철'));await p.waitForTimeout(700);
      const tag=`[${w}px] `;
      const cnt=s=>p.evaluate(s=>document.querySelectorAll(s).length,s);
      const txt=s=>p.evaluate(s=>{const e=document.querySelector(s);return e?e.textContent.trim():null;},s);
      const disp=s=>p.evaluate(s=>[...document.querySelectorAll(s)].map(e=>getComputedStyle(e).display),s);
      ok(tag+'만남 카드 3장',await cnt('.dpx-record-card')===3);
      ok(tag+'처음엔 모든 카드가 접혀 있음',(await disp('.dpx-rc-body')).every(d=>d==='none'));
      ok(tag+'요약에 만남 3회',/3회/.test(await txt('.dpx-hmn-stat-col-val')||''));
      ok(tag+'주황 글자 없음(요약 숫자·배지)',await p.evaluate(()=>{const bad=[];document.querySelectorAll('#psnDpx *').forEach(e=>{if(e.children.length||e.matches('.dpx-hmn-spend-val,.dpx-hmn-treat'))return;if(!e.textContent.trim())return;const c=getComputedStyle(e).color;const m=c.match(/\d+/g);if(!m)return;const [r,g,b]=m.map(Number);if(r>200&&g>110&&g<190&&b<90)bad.push(e.className+':'+c);});return bad.length===0;}));
      await p.click('.dpx-rc-hd');await p.waitForTimeout(120);
      const sty=await p.evaluate(()=>{const g=(q,k)=>getComputedStyle(document.querySelector('.dpx-rc-body.dpx-open '+q))[k];return {amt:g('.dpx-rc-item-amt','fontSize')+'/'+g('.dpx-rc-item-amt','fontWeight'),name:g('.dpx-rc-item-name','fontSize')+'/'+g('.dpx-rc-item-name','fontWeight'),svg:g('.dpx-pay-ic svg','width'),badgeIn:!!document.querySelector('.dpx-rc-body.dpx-open .dpx-rc-item-name-row .dpx-treat-badge'),order:[...document.querySelector('.dpx-rc-body.dpx-open .dpx-rc-item-row').children].map(e=>e.className.replace(/dpx-/g,'').split(' ')[0]).join(',')};});
      ok(tag+'지출 행 = 더치페이 규격(금액 13/600·이름 13/500·아이콘 20px(30px 원)·배지는 이름 줄·화살표→금액 순서)',sty.amt==='13px/600'&&sty.name==='13px/500'&&sty.svg==='20px'&&sty.badgeIn&&/rc-item-info,rc-chev,rc-item-amt/.test(sty.order),JSON.stringify(sty));
      await p.click('.dpx-rc-hd');await p.waitForTimeout(120);
      await p.focus('.dpx-rc-hd');await p.keyboard.press('Enter');await p.waitForTimeout(120);
      ok(tag+'Enter로 카드 펼침(하나만 보임)',(await disp('.dpx-rc-body')).filter(d=>d!=='none').length===1);
      await p.keyboard.press('Enter');await p.waitForTimeout(120);
      ok(tag+'Enter 다시 = 접힘',(await disp('.dpx-rc-body')).every(d=>d==='none'));
      await p.click('.dpx-rc-hd');await p.waitForTimeout(120);
      await p.click('.dpx-rc-item-row');await p.waitForTimeout(120);
      ok(tag+'영수증 표 펼침(하나만)',(await disp('.dpx-rc-receipt-wrap')).filter(d=>d!=='none').length===1);
      ok(tag+'표 품목 4줄',await p.evaluate(()=>document.querySelectorAll('.dpx-rc-receipt-wrap.dpx-open tbody tr').length)===4);
      ok(tag+'합계 일치 표시',/합계 일치/.test(await txt('.dpx-receipt-audit')||''));
      await p.click('[data-dpx="seg"][data-k="duo"]');await p.waitForTimeout(120);
      ok(tag+'단둘이 = 카드 2장',await cnt('.dpx-record-card')===2);
      ok(tag+'범위를 바꿔도 펼침 유지',await cnt('.dpx-rc-body.dpx-open')>=1);
      await p.click('[data-dpx="seg"][data-k="grp"]');await p.waitForTimeout(120);
      ok(tag+'여럿이 = 카드 1장',await cnt('.dpx-record-card')===1);
      await p.click('[data-dpx="seg"][data-k="all"]');await p.waitForTimeout(120);
      await p.click('[data-dpx="all"]');await p.waitForTimeout(120);
      ok(tag+'월별 = 2026년 11월·카드 2장',(await txt('.dpx-hmn-label'))==='2026년 11월'&&await cnt('.dpx-record-card')===2);
      ok(tag+'최신 달에서 다음 비활성',await p.evaluate(()=>document.querySelector('[data-dpx="next"]').disabled));
      await p.click('[data-dpx="prev"]');await p.waitForTimeout(120);
      ok(tag+'이전 달 = 10월·카드 1장',(await txt('.dpx-hmn-label'))==='2026년 10월'&&await cnt('.dpx-record-card')===1);
      ok(tag+'가장 오래된 달에서 이전 비활성',await p.evaluate(()=>document.querySelector('[data-dpx="prev"]').disabled));
      await p.click('[data-dpx="all"]');await p.waitForTimeout(120);
      ok(tag+'전체 복귀 = 카드 3장',await cnt('.dpx-record-card')===3&&(await txt('.dpx-hmn-label'))==='전체 기록');
      for(const [sel,re,name] of [['.dpx-hmn-stat-col[data-psnd="paid"] .dpx-hmn-stat-col-lbl',/결제 밸런스/,'결제 밸런스 창'],['.dpx-hmn-treat[data-psnd="treatn"]',/한턱/,'한턱 창'],['.dpx-hmn-stat-col[data-psnd="mtg"]',/만남/,'만남 창']]){
        await p.click(sel);await p.waitForTimeout(400);
        ok(tag+name+' 열림',re.test(await txt('.mtg-sheet .mtg-sheet-title')||''));
        await p.keyboard.press('Escape');await p.waitForTimeout(350);
      }
      ok(tag+'지출 없는 만남·만남 관리 버튼',await cnt('#relMtgGather')===1&&await cnt('#relMtgConfirmed')===1);
      await p.click('#relMtgConfirmed');await p.waitForTimeout(500);
      ok(tag+'만남 관리 = 만남 창',/만남/.test(await txt('.mtg-sheet .mtg-sheet-title')||''));
      await p.keyboard.press('Escape');await p.waitForTimeout(350);
      await p.evaluate(()=>localStorage.removeItem('receipt_db_dutchpay_transfer_v1'));
      await p.click('[data-dpx="send"]');await p.waitForTimeout(1500);
      const tr=await p.evaluate(()=>{try{return JSON.parse(localStorage.getItem('receipt_db_dutchpay_transfer_v1')||'null');}catch(e){return null;}});
      ok(tag+'더치페이로 보내기 = 전송 데이터 생성',!!tr&&Array.isArray(tr.entries)&&tr.entries.length>=1);
      if(!(await cnt('.dpx-rc-receipt-wrap.dpx-open'))){await p.click('.dpx-rc-item-row');await p.waitForTimeout(120);}
      await p.click('.dpx-rc-receipt-wrap.dpx-open [data-dpx="open"]');await p.waitForTimeout(600);
      ok(tag+'영수증 열기 = 상세 이동',await p.evaluate(()=>typeof selectedId!=='undefined'&&/^rec_r/.test(selectedId||'')));
      await p.click('#navPersonBtn');await p.waitForTimeout(400);
      await p.evaluate(()=>_selectPerson('이영환'));await p.waitForTimeout(600);
      ok(tag+'다른 사람 = 전체·접힘으로 초기화',(await txt('.dpx-hmn-label'))==='전체 기록'&&await cnt('.dpx-rc-body.dpx-open')===0);
      ok(tag+'콘솔 오류 없음',errs.length===0,errs.slice(0,2).join(' | '));
      await ctx.close();
    }
  }finally{await browser.close();server.close();}
  if(fails.length){console.error('FAIL:\n - '+fails.join('\n - '));process.exit(1);}
  console.log('OK: 사람 탭 요약(더치페이 기록 보관함 모양) — 월 이동·범위 칩·카드/표 펼침·기존 창 연결·영수증 열기·전송·초기화 (1280·390)');
})().catch(e=>{console.error(e);process.exit(1);});
