// 더치페이 기록 보관함 카드와 사람 탭 카드를 같은 데이터로 그려 클래스별 계산 스타일(글꼴·크기·굵기·색·여백·선·높이)을 비교한다.
// 사용: DUTCH_DIR=<더치페이 최신 origin/main 체크아웃> node scripts/compare_dutchpay_card.cjs [폭=390]
// 글꼴 열(fontFamily)·색 등이 한 줄도 안 나와야 '똑같다'. 높이 1~2px 차이는 내용(글자) 차이라 허용. 눈으로 비교하지 말 것.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const mk=(root,port)=>http.createServer((q,r)=>{const f=path.join(root,q.url==='/'?'index.html':q.url.split('?')[0]);const t={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/json'};fs.readFile(f,(e,d)=>{if(e){r.writeHead(404).end();return;}r.writeHead(200,{'Content-Type':t[path.extname(f)]||'application/octet-stream'}).end(d);});}).listen(port);
const DUTCH=process.env.DUTCH_DIR||path.resolve(__dirname,'../../dutch-pay');const A=mk(DUTCH,4211),B=mk(path.resolve(__dirname,'..'),4212);
const PROPS=['fontSize','fontWeight','color','backgroundColor','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','marginLeft','borderTopWidth','borderBottomWidth','borderRadius','lineHeight','letterSpacing','display','gap','justifyContent','alignItems','textAlign','opacity','boxShadow','minWidth','fontFamily'];
const CLS='hist-month-nav hmn-header hmn-arr hmn-label hmn-all hmn-stat hmn-stat-3 hmn-stat-col hmn-stat-col-lbl hmn-stat-col-val hmn-stat-col-right hmn-pct hmn-spend-lbl hmn-treat hmn-total-col pm-seg-row pm-seg record-list record-card rc-hd rc-meta rc-date rc-name rc-people rc-right rc-amt-line rc-total rc-chevron rc-body rc-section-title rc-item-row rc-item-info rc-item-name-row rc-item-name rc-item-meta rc-payer-pill treat-badge pay-ic rc-chev rc-item-amt rc-txns rc-txn-row rc-txn-people rc-txn-amt rc-foot rc-saved-at rc-foot-btns rc-load-btn rc-edit-btn rc-receipt-wrap rc-receipt-tbl'.split(' ');
(async()=>{const b=await chromium.launch({executablePath:(process.env.CHROMIUM_PATH||'/usr/bin/chromium'),args:['--no-sandbox']});
const W=+process.argv[2]||390;
const grab=(pre,root)=>`(()=>{const out={};const props=${JSON.stringify(PROPS)};for(const c of ${JSON.stringify(CLS)}){const e=document.querySelector('${root} .'+'${pre}'+c);if(!e)continue;const cs=getComputedStyle(e);const o={};for(const p of props)o[p]=cs[p];const r=e.getBoundingClientRect();o._h=Math.round(r.height*10)/10;out[c]=o;}return out;})()`;
const c1=await b.newContext({viewport:{width:W,height:1400},serviceWorkers:'block'});const p1=await c1.newPage();await p1.goto('http://127.0.0.1:4211/');await p1.waitForTimeout(1500);
await p1.evaluate(()=>{_historySearch='신유철';_myName='조상현';_histView='list';_histMonthAllMode=true;_histSettleMode=false;
 const recs=[{id:'x1',dateStart:'2026-11-17',dateEnd:'2026-11-17',people:['신유철','조상현'],txns:[],total:192000,savedAt:new Date().toISOString(),items:[{id:'a',name:'조광',amount:108000,payer:'신유철',members:['신유철','조상현'],isTreat:true,receiptText:'조광 휘귀추천 2인 | 1 | 90000 | 90000'},{id:'b',name:'축제 노래연습장',amount:84000,payer:'조상현',members:['신유철','조상현'],isTreat:true}]},
 {id:'x2',dateStart:'2026-11-03',dateEnd:'2026-11-03',people:['신유철','조상현','이영환'],txns:[],total:70000,savedAt:new Date().toISOString(),items:[{id:'c',name:'전북상회',amount:70000,payer:'조상현',members:['신유철','조상현','이영환'],isTreat:false}]}];
 const d=document.createElement('div');d.id='cmp';d.style.cssText='position:fixed;inset:0;z-index:99999;background:#fafafa;padding:12px 16px;overflow:auto';d.innerHTML=_histDrListHtml(recs);document.body.appendChild(d);
 document.querySelector('#cmp .rc-body').classList.add('open');document.querySelector('#cmp .rc-item-row').click?.();});
await p1.mouse.move(0,0);await p1.waitForTimeout(300);
const dp=await p1.evaluate(grab('','#cmp'));
await p1.screenshot({path:'/tmp/full_dp_'+W+'.png'});
const c2=await b.newContext({viewport:{width:W,height:1400},serviceWorkers:'block'});const p2=await c2.newPage();await p2.goto('http://127.0.0.1:4212/');await p2.waitForFunction(()=>typeof _selectPerson==='function'&&typeof dbPut==='function');await p2.waitForTimeout(500);
await p2.evaluate(async()=>{setMyName('조상현');const R=[['a','2026-11-17','18:50','조광',108000,'신유철',['신유철','조상현'],true,'술집',[{name:'조광 휘귀추천 2인',quantity:1,unitPrice:90000,amount:90000}]],['b','2026-11-17','20:44','축제 노래연습장',84000,'조상현',['신유철','조상현'],true,'노래방',null],['c','2026-11-03','17:02','전북상회',70000,'조상현',['신유철','조상현','이영환'],false,'외식',null]];for(const [id,date,time,store,total,pb,pp,tr,cat,items] of R)await dbPut('receipts',{id:'rec_'+id,date,time,store,total,items:items||[{name:store,quantity:1,unitPrice:total,amount:total}],paidBy:pb,participants:pp,treat:tr,category:cat,createdAt:nowISO(),updatedAt:nowISO()});await loadAll();renderSide();});
await p2.click('#navPersonBtn');await p2.evaluate(()=>_selectPerson('신유철'));await p2.waitForTimeout(700);
await p2.click('.dpx-rc-hd');await p2.waitForTimeout(250);await p2.mouse.move(0,0);await p2.click('.dpx-rc-item-row');await p2.mouse.move(0,0);await p2.waitForTimeout(250);
const me=await p2.evaluate(grab('dpx-','#psnDpx'));
await p2.screenshot({path:'/tmp/full_me_'+W+'.png'});
let n=0;for(const c of Object.keys(dp)){if(!me[c]){console.log('MISSING in mine:',c);continue;}const d=[];for(const k of [...PROPS,'_h']){if(String(dp[c][k])!==String(me[c][k]))d.push(k+': DP='+dp[c][k]+' ME='+me[c][k]);}if(d.length){n++;console.log('['+c+'] '+d.join(' | '));}}
for(const c of CLS)if(!dp[c]&&me[c])console.log('only mine:',c);
console.log('classes compared',Object.keys(dp).length,'with diffs',n);
await b.close();A.close();B.close();})();
