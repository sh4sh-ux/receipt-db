/* v4.32 — 대납: 다른 사람 대신 내가 결제한 돈을 돌려받는 기록. 영수증·사람에 붙는다(선불권과 모양은 비슷하지만 뜻은 반대).
   ⚠️ 할부 개월 · 실제 입금 횟수 · 입금액 · 입금일은 서로 묶지 않는다(24개월 ≠ 24번 입금, 예정일 없음). 완료 = 남은 금액 0원.
   입금은 수입이 아니다(영수증·통계에 넣지 않음). 원본 영수증은 통계에서 '내 부담' = 총액 − 받을 금액, 상대 부담 = 받을 금액(_splitShareMap).
   저장: settings store 'adv:' 기록 — type adv(receiptId·person·amount·months·note) / pay(advId·amount·date·memo). 둘 다 updatedAt 최신 우선, 지우기 = deleted. */
const ADV_PREFIX='adv:';
let advRecords=[];
let _advByReceipt=new Map(),_advSig='';
function advValidOne(r){
  if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(r.id)||r.key!==ADV_PREFIX+r.id)return null;
  try{
    const base={key:r.key,id:r.id,deleted:r.deleted===true,createdAt:String(r.createdAt||''),updatedAt:String(r.updatedAt||'')};
    if(r.type==='adv'){
      const person=String(r.person||'').trim().slice(0,100);if(!person)return null;
      const months=Math.max(0,Math.min(120,Math.trunc(Number(r.months)||0)));
      return {...base,type:'adv',receiptId:String(r.receiptId||'').slice(0,200),person,amount:ppMoney(r.amount),months,note:String(r.note||'').slice(0,500)};
    }
    if(r.type==='pay'&&typeof r.advId==='string'&&r.advId)return {...base,type:'pay',advId:r.advId,amount:ppMoney(r.amount),date:ppDate(r.date),memo:String(r.memo||'').slice(0,500)};
  }catch(_){}
  return null;
}
function advValidate(rows){return Array.isArray(rows)?rows.slice(0,50000).map(advValidOne).filter(Boolean):[];}
async function advExport(){return (await dbAll('settings')).filter(r=>typeof r.key==='string'&&r.key.startsWith(ADV_PREFIX));}
async function advLoad(){
  advRecords=advValidate(await advExport());
  _advByReceipt=new Map();
  for(const a of advRecords)if(a.type==='adv'&&!a.deleted&&a.receiptId)_advByReceipt.set(a.receiptId,a);
  let u='';for(const a of advRecords)if(a.updatedAt>u)u=a.updatedAt;
  _advSig=advRecords.length+':'+u;
}
async function advMerge(rows){
  const incoming=advValidate(rows);if(!incoming.length)return 0;
  const db=await openDB();
  const changed=await new Promise((resolve,reject)=>{
    const tx=db.transaction('settings','readwrite'),store=tx.objectStore('settings');let count=0;
    tx.oncomplete=()=>resolve(count);tx.onabort=()=>reject(tx.error||new Error('대납 병합 실패'));
    for(const row of incoming){const req=store.get(row.key);req.onsuccess=()=>{const local=req.result;if(!local||row.updatedAt>String(local.updatedAt||'')){store.put(row);count++;}};}
  });
  await advLoad();
  if(changed)advRefreshViews();
  return changed;
}
async function advPut(rows){
  const db=await openDB();
  await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('저장하지 못했어요.'));rows.forEach(r=>tx.objectStore('settings').put(r));});
  await advLoad();advRefreshViews();void dbxSyncUpload();
}
function advRefreshViews(){
  if(typeof _personIdxCache!=='undefined')_personIdxCache={sig:'',list:[]};
  if(typeof renderDetail==='function')renderDetail();
  if(typeof renderSide==='function')renderSide();
}
// ── 조회
function advForReceipt(id){return _advByReceipt.get(id)||null;}
function advAll(){return advRecords.filter(a=>a.type==='adv'&&!a.deleted);}
function advPays(advId){return advRecords.filter(p=>p.type==='pay'&&!p.deleted&&p.advId===advId).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
function advState(a){
  const pays=advPays(a.id),received=pays.reduce((s,p)=>s+p.amount,0),remaining=a.amount-received;
  let run=a.amount;const after=new Map();for(const p of pays){run-=p.amount;after.set(p.id,run);}
  return {pays,received,remaining:Math.max(0,remaining),over:Math.max(0,-remaining),done:remaining<=0,n:pays.length,after,pct:a.amount>0?Math.min(100,Math.round(received/a.amount*100)):100};
}
function advForPerson(name){const n=normalizeName(name);return advAll().filter(a=>normalizeName(a.person)===n);}
function advHasPerson(name){return advForPerson(name).length>0;}
function advOwedByPerson(){const m=new Map();for(const a of advAll()){const st=advState(a);if(st.remaining>0){const n=normalizeName(a.person);m.set(n,(m.get(n)||0)+st.remaining);}}return m;}
function advPersonNames(){return [...new Set(advAll().map(a=>normalizeName(a.person)).filter(Boolean))];}
function advTitle(a){const r=receipts.find(x=>x.id===a.receiptId);return r?(r.store||'영수증'):'원본 영수증 없음';}
function advReceipt(a){return receipts.find(x=>x.id===a.receiptId)||null;}
function advMonthsLabel(a){return a.months>0?`카드 ${a.months}개월 할부`:'일시불';}
function advMD(iso){if(!iso)return '';const [y,m,d]=iso.split('-').map(Number);return (y===new Date().getFullYear()?'':y+'년 ')+m+'월 '+d+'일';}
// 통계용 분담: 상대 = 받을 금액(총액 이하), 나머지는 결제자(비었으면 나)
function advShareMap(r,a){
  const m=new Map(),tot=r.total||0,amt=Math.max(0,Math.min(a.amount,tot)),who=normalizeName(a.person);
  const pb=normalizeName(r.paidBy)||normalizeName(getMyName());
  if(amt>0&&who)m.set(who,amt);
  if(tot-amt>0&&pb)m.set(pb,(m.get(pb)||0)+tot-amt);
  return m;
}
// ── 영수증 상세: 시작점 · 요약
function advDecorateReceipt(body,r){
  const host=body.querySelector('.detail-expense-block');if(!host)return;
  const a=advForReceipt(r.id),esc=escapeHtml,money=n=>fmtMoney(n)+'원';
  let html;
  if(!a){
    html=`<button type="button" class="advx-start" data-advnew="${esc(r.id)}"><span>+ 대신 결제로 기록</span><small>다른 사람 대신 결제했다면 받을 돈을 기록해요</small></button>`;
  }else{
    const st=advState(a);
    html=`<div class="advx-rc"><div class="advx-rc-hd"><b>${esc(a.person)} 대신 결제</b><span class="advx-tag${st.done?' done':''}">${st.done?'완료':'진행 중'}</span></div>`
      +`<div class="advx-rc-s">${st.done?(st.over?`${money(st.over)} 더 받음`:'다 받았어요'):`남은 금액 <b>${money(st.remaining)}</b>`} · 받은 ${money(st.received)} · 입금 ${st.n}번 · ${advMonthsLabel(a)}</div>`
      +(a.amount>(r.total||0)?`<div class="advx-rc-w">받을 금액 ${money(a.amount)}이 영수증 총액보다 커요 · [자세히] ▸ 정보 수정에서 고쳐 주세요</div>`:'') // v4.37
      +`<div class="advx-rc-n">통계: 내 부담 ${money(Math.max(0,(r.total||0)-Math.min(a.amount,r.total||0)))} · ${esc(a.person)} 부담 ${money(Math.min(a.amount,r.total||0))}</div>`
      +`<div class="advx-rc-b"><button type="button" class="ppx-btn" data-advopen="${esc(a.id)}">자세히</button><button type="button" class="ppx-btn primary" data-advpay="${esc(a.id)}">입금 확인</button></div></div>`;
  }
  host.insertAdjacentHTML('afterend',html);
}
// ── 사람 상세: 맨 위 '받을 돈'
function advPersonCardHtml(name){
  const list=advForPerson(name);if(!list.length)return '';
  const esc=escapeHtml,money=n=>fmtMoney(n)+'원';
  const rows=list.map(a=>({a,st:advState(a),r:advReceipt(a)})).sort((x,y)=>(x.st.done-y.st.done)||((y.r?.date||'').localeCompare(x.r?.date||'')));
  const open=rows.filter(x=>!x.st.done),done=rows.filter(x=>x.st.done);
  const rem=open.reduce((s,x)=>s+x.st.remaining,0),tot=open.reduce((s,x)=>s+x.a.amount,0),got=open.reduce((s,x)=>s+x.st.received,0);
  const row=x=>`<button type="button" class="advx-pr${x.st.done?' done':''}" data-advopen="${esc(x.a.id)}"><span class="advx-pr-l"><span class="advx-pr-n">${esc(advTitle(x.a))}</span>`
    +`<span class="advx-pr-m">${[x.r?advMD(x.r.date):'',advMonthsLabel(x.a),`입금 ${x.st.n}번`].filter(Boolean).join(' · ')}</span>`
    +`<span class="advx-bar"><i style="width:${x.st.pct}%"></i></span></span>`
    +`<span class="advx-pr-r"><b>${x.st.done?'완료':money(x.st.remaining)}</b><small>${money(x.a.amount)} 중</small></span></button>`;
  return `<section class="psn-card advx-pc" aria-label="받을 돈"><div class="advx-pc-hd"><span class="psn-hero-title">받을 돈</span><span class="advx-pc-c">${open.length?`${open.length}건`:''}</span></div>`
    +(open.length?`<div class="advx-pc-big">${money(rem)}</div><div class="advx-pc-sub">총 ${money(tot)} 중 ${money(got)} 받음</div>`:`<div class="advx-pc-sub">다 받았어요</div>`)
    +`<div class="advx-pc-list">${open.map(row).join('')}</div>`
    +(done.length?`<button type="button" class="advx-pc-more" data-advmore>완료 ${done.length}건 보기</button><div class="advx-pc-done" hidden>${done.map(row).join('')}</div>`:'')
    +`</section>`;
}
// 전역 클릭(영수증 상세 · 사람 상세 어디서 그려져도)
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-advopen],[data-advpay],[data-advnew],[data-advmore]');if(!t)return;
  if(t.closest('.mtg-sheet'))return; // 창 안 버튼은 창이 직접 처리
  e.preventDefault();
  if(t.dataset.advmore!==undefined){const d=t.nextElementSibling;if(d){d.hidden=!d.hidden;t.textContent=d.hidden?t.textContent.replace('접기','보기'):t.textContent.replace('보기','접기');}return;}
  if(t.dataset.advopen)return advSheet({advId:t.dataset.advopen});
  if(t.dataset.advpay)return advSheet({advId:t.dataset.advpay,mode:'pay'});
  if(t.dataset.advnew)return advSheet({receiptId:t.dataset.advnew,mode:'edit'});
});
// ── 대납 창(.mtg-sheet 틀): 보기 · 입금(새로/수정) · 정보(새로/수정) · 삭제 확인을 한 창에서 바꿔 그린다
function advSheet({advId=null,receiptId=null,mode='view',payId=null}){
  if(typeof _mtgSheetOpen!=='function')return;
  const {card,close}=_mtgSheetOpen();card.classList.add('ppx-rs','advx-sheet');
  const esc=escapeHtml,money=n=>fmtMoney(n)+'원',today=_todayYMD();
  let curPay=payId,shareBlob=null;
  const hd=t=>`<div class="mtg-sheet-hd"><div class="mtg-sheet-title">${t}</div><button class="mtg-sheet-x" type="button" aria-label="닫기">×</button></div>`;
  const moneyInput=inp=>inp.addEventListener('input',()=>{const raw=inp.value.replace(/[^0-9]/g,'');inp.value=raw?Number(raw).toLocaleString('ko-KR'):'';});
  const paint=()=>{
    card.classList.remove('advx-v');card.scrollTop=0;
    const a=advId?advAll().find(x=>x.id===advId):null;
    if(advId&&!a){close();return;}
    const r=a?advReceipt(a):receipts.find(x=>x.id===receiptId);
    if(mode==='edit'){
      const people=(typeof _personIndex==='function'?_personIndex().slice().sort((x,y)=>y.together-x.together).map(p=>p.name):[]);
      card.innerHTML=hd(a?'대신 결제 정보 수정':'대신 결제로 기록')
        +(r?`<div class="ppx-rs-sub">${esc(r.store||'영수증')} · ${advMD(r.date)} · ${money(r.total||0)}</div>`:'')
        +`<form class="ppx-rs-form" novalidate><label><span>누구 대신</span><input name="person" list="advPeople" autocomplete="off" required maxlength="100" value="${esc(a?.person||'')}" placeholder="이름"></label><datalist id="advPeople">${people.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`
        +`<label><span>받을 금액</span><input name="amount" type="text" inputmode="numeric" value="${fmtMoney(a?a.amount:(r?.total||0))}"></label>`
        +`<label><span>카드 할부</span><span class="advx-mo"><input name="months" type="text" inputmode="numeric" value="${a&&a.months?a.months:''}" placeholder="일시불"><em>개월</em></span></label>`
        +`<label><span>메모</span><input name="note" type="text" maxlength="500" value="${esc(a?.note||'')}" placeholder="선택" style="font-weight:500"></label>`
        +`<p class="ppx-rs-note">할부 개월은 적어 두는 정보예요. 입금 횟수·금액·날짜와 묶지 않아요. 통계에서 이 영수증은 내 부담 0원(받을 금액만큼 상대 부담)으로 봐요.</p>`
        +`<p class="pp-error" role="alert"></p><div class="ppx-rs-btns"><button type="button" class="ppx-btn advx-cancel">취소</button><button type="submit" class="ppx-btn primary">저장</button></div></form>`;
      const f=card.querySelector('form'),err=f.querySelector('.pp-error');
      moneyInput(f.querySelector('[name=amount]'));
      f.querySelector('[name=months]').addEventListener('input',e=>{e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,3);});
      f.querySelector('.advx-cancel').onclick=()=>{if(a){mode='view';paint();}else close();};
      f.addEventListener('submit',async ev=>{
        ev.preventDefault();const btn=f.querySelector('[type=submit]');if(btn.disabled)return;btn.disabled=true;err.textContent='';
        try{
          const person=normalizeName(f.person.value);if(!person)throw new Error('누구 대신 결제했는지 입력해 주세요.');
          if(person===normalizeName(getMyName()))throw new Error('내 이름 말고 대신 결제해 준 사람을 입력해 주세요.');
          const amount=ppMoney(f.amount.value||'0');if(amount<=0)throw new Error('받을 금액을 입력해 주세요.');
          const months=Math.trunc(Number(f.months.value||0));if(months<0||months>120)throw new Error('할부 개월을 확인해 주세요.');
          const now=nowISO(),id=a?.id||'adv_'+crypto.randomUUID();
          const row={key:ADV_PREFIX+id,id,type:'adv',receiptId:a?a.receiptId:receiptId,person,amount,months,note:String(f.note.value||'').trim(),deleted:false,createdAt:a?.createdAt||now,updatedAt:now};
          if(!advValidOne(row))throw new Error('입력을 확인해 주세요.');
          if(!a&&advForReceipt(receiptId))throw new Error('이미 대신 결제로 기록된 영수증이에요.');
          await advPut([row]);advId=id;mode='view';paint();toast(a?'수정했어요.':'대신 결제로 기록했어요.',{type:'success'});
        }catch(x){err.textContent=x.message;btn.disabled=false;}
      });
    }else if(mode==='pay'){
      const st=advState(a),p=curPay?st.pays.find(x=>x.id===curPay):null;
      const idx=p?st.pays.indexOf(p)+1:st.n+1;
      const before=a.amount-(st.received-(p?p.amount:0));
      card.innerHTML=hd(`${idx}번째 입금${p?' 수정':''}`)+`<div class="ppx-rs-sub">${esc(advTitle(a))} · ${esc(a.person)}</div>`
        +`<form class="ppx-rs-form" novalidate><label><span>입금액</span><input name="amount" type="text" inputmode="numeric" value="${p?fmtMoney(p.amount):''}" placeholder="받은 금액"></label>`
        +`<label><span>입금일</span><input name="date" type="date" value="${esc(p?p.date:today)}" required></label>`
        +`<label><span>메모</span><input name="memo" type="text" maxlength="500" value="${esc(p?.memo||'')}" placeholder="선택" style="font-weight:500"></label>`
        +`<div class="advx-after"></div><p class="pp-error" role="alert"></p>`
        +`<div class="ppx-rs-btns"><button type="button" class="ppx-btn advx-cancel">취소</button><button type="submit" class="ppx-btn primary">저장</button></div>`
        +(p?`<button type="button" class="advx-del-pay">이 입금 기록 삭제</button>`:'')+`</form>`;
      const f=card.querySelector('form'),err=f.querySelector('.pp-error'),aft=f.querySelector('.advx-after'),amt=f.querySelector('[name=amount]');
      const upd=()=>{const v=Number(amt.value.replace(/[^0-9]/g,''))||0,next=before-v;
        aft.innerHTML=`입금 후 남은 금액 <b>${money(Math.max(0,before))} → ${next>=0?money(next):'0원'}</b>`+(next<0?`<br><span class="advx-over">${money(-next)} 더 받게 돼요</span>`:next===0&&v?'<br><span class="advx-ok">다 받아요 · 완료</span>':'')
          +`<br><small>받은 돈 ${money(st.received-(p?p.amount:0)+v)} · 입금 ${p?st.n:st.n+(v?1:0)}번 · ${advMonthsLabel(a)}</small>`;};
      moneyInput(amt);amt.addEventListener('input',upd);upd();
      f.querySelector('.advx-cancel').onclick=()=>{curPay=null;mode='view';paint();};
      f.addEventListener('submit',async ev=>{
        ev.preventDefault();const btn=f.querySelector('[type=submit]');if(btn.disabled)return;btn.disabled=true;err.textContent='';
        try{
          const amount=ppMoney(amt.value||'0');if(amount<=0)throw new Error('입금액을 입력해 주세요.');
          const date=ppDate(f.date.value);if(date>today)throw new Error('아직 오지 않은 날짜예요. 실제로 받은 날을 넣어 주세요.');
          const now=nowISO(),id=p?.id||'pay_'+crypto.randomUUID();
          await advPut([{key:ADV_PREFIX+id,id,type:'pay',advId:a.id,amount,date,memo:String(f.memo.value||'').trim(),deleted:false,createdAt:p?.createdAt||now,updatedAt:now}]);
          const st2=advState(advAll().find(x=>x.id===a.id));curPay=null;mode='view';paint();
          toast(st2.done?'다 받았어요 · 완료':`${p?'수정했어요':'입금을 기록했어요'} · 남은 금액 ${money(st2.remaining)}`,{type:'success'});
        }catch(x){err.textContent=x.message;btn.disabled=false;}
      });
      f.querySelector('.advx-del-pay')?.addEventListener('click',async e=>{
        e.currentTarget.disabled=true;
        try{await advPut([{...p,deleted:true,updatedAt:nowISO()}]);curPay=null;mode='view';paint();toast('입금 기록을 삭제했어요.');}catch(x){err.textContent=x.message;}
      });
    }else if(mode==='share'){
      // 공유 창이 열리지 않는 기기(PC 일부 브라우저 등): 미리보기 + 저장 / 다시 공유
      const url=URL.createObjectURL(shareBlob.blob);
      let canRetry=false;try{canRetry=!!(navigator.share&&(!navigator.canShare||navigator.canShare({files:[shareBlob.file]})));}catch(_){}
      card.innerHTML=hd('공유 이미지')+`<div class="ppx-rs-sub">공유 창이 열리지 않으면 이미지를 저장해서 보내 주세요.</div><img class="advx-share-img" alt="대신 결제 공유 이미지 미리보기" src="${url}">`
        +`<div class="ppx-rs-btns${canRetry?'':' advx-one'}"><a class="ppx-btn advx-dl" download="${esc(shareBlob.name)}" href="${url}">이미지 저장</a>${canRetry?'<button type="button" class="ppx-btn primary advx-retry">다시 공유</button>':''}</div>`
        +`<button type="button" class="advx-del-pay advx-back">돌아가기</button>`;
      card.querySelector('.advx-dl').addEventListener('click',()=>setTimeout(()=>toast('이미지를 저장했어요.',{type:'success'}),0));
      card.querySelector('.advx-retry')?.addEventListener('click',async()=>{try{await navigator.share({files:[shareBlob.file]});}catch(_){}});
      card.querySelector('.advx-back').onclick=()=>{URL.revokeObjectURL(url);mode='view';paint();};
    }else if(mode==='del'){
      const st=advState(a);
      card.innerHTML=hd('대신 결제 기록 삭제')+`<div class="ppx-rs-warn">${esc(a.person)} 대신 결제 기록을 지울까요?<br>입금 기록 ${st.n}건도 함께 지워져요. 원본 영수증은 그대로 남고, 통계는 원래대로(내 부담 전액) 돌아가요.</div>`
        +`<div class="ppx-rs-btns"><button type="button" class="ppx-btn advx-cancel">취소</button><button type="button" class="ppx-btn danger-solid advx-do">삭제하기</button></div>`;
      card.querySelector('.advx-cancel').onclick=()=>{mode='view';paint();};
      card.querySelector('.advx-do').onclick=async()=>{const now=nowISO();await advPut([{...a,deleted:true,updatedAt:now},...st.pays.map(p=>({...p,deleted:true,updatedAt:now}))]);close(()=>toast('대신 결제 기록을 삭제했어요.'));};
    }else{
      card.classList.add('advx-v');
      const st=advState(a);
      // v4.33 — 입금 줄은 만남 창(.mtl-row) 글자와 같게: 회차 12/500 회색 · 날짜 14/600 · 메모 12 회색 · 금액 13.5/600
      const rows=st.pays.slice().reverse().map(p=>`<button type="button" class="advx-pay" data-pay="${esc(p.id)}"><span class="advx-pay-l"><span class="advx-pay-n">${st.pays.indexOf(p)+1}번째</span><span class="advx-pay-d">${ppDayLabel(p.date)}</span>${p.memo?`<span class="advx-pay-m">${esc(p.memo)}</span>`:''}</span><span class="advx-pay-r"><b>+${money(p.amount)}</b><small>남은 금액 ${money(Math.max(0,st.after.get(p.id)))}</small></span></button>`).join('');
      const top=st.done?(st.over?`${money(st.over)} 더 받음`:'완료'):'남은 금액';
      card.innerHTML=hd(esc(advTitle(a)))
        +`<div class="ppx-rs-sub">${esc(a.person)} 대신 결제${r?` · ${advMD(r.date)} · <button type="button" class="advx-link" data-advrc>원본 영수증 ›</button>`:' · 원본 영수증 없음'}</div>`
        +`<div class="advx-card${st.done?' done':''}"><div class="advx-card-t"><span>${top}</span><span>${advMonthsLabel(a)}</span></div><div class="advx-card-v">${fmtMoney(st.remaining)}<small>원</small></div>`
        +`<div class="advx-card-bar"><i style="width:${st.pct}%"></i></div><div class="advx-card-f"><span>총 ${money(a.amount)} 중 ${st.pct}% 받음</span><span>입금 ${st.n}번</span></div></div>`
        +`<div class="advx-stats"><div><small>받을 돈</small><b>${money(a.amount)}</b></div><div><small>받은 돈</small><b>${money(st.received)}</b></div><div><small>실제 입금</small><b>${st.n}번</b></div></div>`
        +(a.note?`<div class="advx-note">${esc(a.note)}</div>`:'')
        +`<div class="advx-acts"><button type="button" class="ppx-btn advx-sharebtn">공유</button><button type="button" class="ppx-btn primary advx-paybtn">입금 확인</button></div>`
        +`<div class="advx-hh">입금 기록<span>${st.n?'최신순 · 누르면 수정·삭제':''}</span></div><div class="advx-list">${rows||'<div class="advx-empty">아직 받은 돈이 없어요. 돈을 받으면 [입금 확인]을 눌러 주세요.</div>'}</div>`
        +`<div class="advx-foot"><button type="button" class="advx-link" data-advedit>정보 수정</button><button type="button" class="advx-link danger" data-advdel>기록 삭제</button></div>`;
      card.querySelector('.advx-paybtn').onclick=()=>{curPay=null;mode='pay';paint();};
      card.querySelector('.advx-sharebtn').onclick=async e=>{const b=e.currentTarget;if(b.disabled)return;b.disabled=true;try{await advShareImage(a,(blob,file,name)=>{shareBlob={blob,file,name};mode='share';paint();});}finally{b.disabled=false;}};
      card.querySelectorAll('.advx-pay').forEach(b=>b.onclick=()=>{curPay=b.dataset.pay;mode='pay';paint();});
      card.querySelector('[data-advedit]').onclick=()=>{mode='edit';paint();};
      card.querySelector('[data-advdel]').onclick=()=>{mode='del';paint();};
      card.querySelector('[data-advrc]')?.addEventListener('click',()=>close(()=>selectReceipt(a.receiptId)));
    }
    card.querySelector('.mtg-sheet-x').onclick=()=>close();
  };
  paint();
}
// ── 공유 이미지(v4.34) — Dutch Pay '상세내역' 이미지(generateFullDetailCanvases, v6.23~)와 같은 모양·글자:
//   파란 눈썹(앱 이름·버전 17/800) · 제목 34/800 + 오른쪽 금액 29/800 · 회색 날짜 16/500 · 선 #dedee3,
//   연파랑 카드(#f3f5ff, 이름 22/750 + 회색 알약 + 오른쪽 금액 22/800, 아래 15/500 #777) · 표 머리 15/400 #9a9aa1 · 줄 17/500(금액 17/700) · 합계 19/800.
//   Dutch Pay처럼 모든 글자는 적힌 값보다 2px 작게 그린다. 색은 토큰 없이 직접(이미지는 흰 바탕).
function advShareCanvas(a){
  // v4.38 — 가로 720(Dutch Pay는 1080). 폰은 이미지를 화면 폭에 맞춰 줄여 보여 주므로, 같은 글자 크기로 폭만 줄이면 화면에서 1.5배 크게 보인다(사용자: 모바일에서 글자가 너무 작다).
  //   글자 크기·굵기·색·간격은 Dutch Pay 상세내역 그대로, 가로 위치만 720에 맞췄다. 2배로 그려 1440px 이미지.
  const st=advState(a),r=advReceipt(a),items=((r&&r.items)||[]).filter(i=>i&&String(i.name||'').trim());
  const W=720,SCALE=2,HEADER=154,FOOTER=58,ROW=48,CARD=104,GAP=14,fmt=n=>fmtMoney(n);
  const BL=28,BR=W-28,TL=46,TR=W-46,IL=44,IR=W-44; // 상자·선 / 머리 글 / 카드·표 안쪽 글
  const secH=rows=>CARD+GAP+44+Math.max(1,rows)*ROW+72+22;
  const H=Math.max(620,HEADER+secH(items.length)+secH(st.n)+FOOTER);
  const canvas=document.createElement('canvas');canvas.width=W*SCALE;canvas.height=H*SCALE;
  const ctx=canvas.getContext('2d');ctx.scale(SCALE,SCALE);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  const font=(size,weight=400)=>ctx.font=`${weight} ${Math.max(1,size-2)}px -apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',Arial,sans-serif`;
  const fit=(t,max)=>{t=String(t||'');if(ctx.measureText(t).width<=max)return t;while(t&&ctx.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…';};
  const rr=(x,y,w,h,rad)=>{ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,rad);else ctx.rect(x,y,w,h);};
  const hline=(y,c,w)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(BL,y);ctx.lineTo(BR,y);ctx.stroke();};
  const ymd=d=>String(d||'').replace(/-/g,'.');
  // 머리
  ctx.fillStyle='#4355e8';font(17,700);ctx.textAlign='left';ctx.fillText('RECEIPT DB '+(typeof APP_VERSION==='string'?APP_VERSION:''),TL,42);
  ctx.textAlign='right';font(29,700);const amtTxt=fmt(a.amount)+'원',amtW=ctx.measureText(amtTxt).width;ctx.fillStyle='#111';ctx.fillText(amtTxt,TR,90);
  ctx.textAlign='left';font(34,700);ctx.fillText(fit('대신 결제',TR-TL-amtW-20),TL,90);
  ctx.fillStyle='#777';font(16,500);ctx.textAlign='right';const mo=advMonthsLabel(a),moW=ctx.measureText(mo).width;ctx.fillText(mo,TR,126);
  ctx.textAlign='left';ctx.fillText(fit([r?ymd(r.date):'',`${a.person} 대신`].filter(Boolean).join(' · '),TR-TL-moW-20),TL,126);
  hline(142,'#dedee3',2);
  let y=HEADER;
  // 연파랑 카드: 이름 + 회색 알약 + 오른쪽 금액 / 아래 회색 글 + 오른쪽 상태
  const card=(name,pill,amt,sub,stTxt,stCol)=>{
    ctx.fillStyle='#f3f5ff';rr(BL,y,BR-BL,CARD,14);ctx.fill();
    font(22,700);const aw=ctx.measureText(amt).width;
    font(14,500);const pillW=pill?Math.min(150,ctx.measureText(pill).width+22):0;
    font(22,650);ctx.fillStyle='#111';ctx.textAlign='left';const nm=fit(name,IR-IL-aw-pillW-34);ctx.fillText(nm,IL,y+45);
    if(pill){const px=IL+ctx.measureText(nm).width+10;ctx.fillStyle='#e9e9ec';rr(px,y+25,pillW,26,13);ctx.fill();ctx.fillStyle='#666';font(14,500);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(fit(pill,pillW-16),px+pillW/2,y+38);ctx.textBaseline='alphabetic';}
    ctx.textAlign='right';ctx.fillStyle='#111';font(22,700);ctx.fillText(amt,IR,y+45);
    font(15,500);ctx.textAlign='right';ctx.fillStyle=stCol;ctx.fillText(stTxt,IR,y+79);const sw=ctx.measureText(stTxt).width;
    ctx.fillStyle='#777';ctx.textAlign='left';ctx.fillText(fit(sub,IR-IL-sw-16),IL,y+79);y+=CARD+GAP;
  };
  // 표: 머리 15/400 회색 + 선, 줄 17/500(굵은 칸 17/700) + 옅은 선, 합계 19/800
  const table=(cols,rows,empty,sumLbl,badge,badgeCol,sumAmt)=>{
    ctx.fillStyle='#9a9aa1';font(15,400);for(const c of cols){ctx.textAlign=c.al;ctx.fillText(c.t,c.x,y+29);}hline(y+44,'#dedee3',1);y+=44;
    if(!rows.length){ctx.fillStyle='#8e8e93';font(17,400);ctx.textAlign='left';ctx.fillText(empty,IL,y+31);hline(y+ROW,'#ececf0',1);y+=ROW;}
    for(const row of rows){row.forEach((v,i)=>{const c=cols[i];font(17,c.bold?600:400);ctx.fillStyle=v&&v.c||'#222';ctx.textAlign=c.al;const t=v&&typeof v==='object'?v.t:v;ctx.fillText(c.max?fit(t,c.max):String(t??''),c.x,y+31);});hline(y+ROW,'#ececf0',1);y+=ROW;}
    ctx.fillStyle='#111';font(19,700);ctx.textAlign='left';ctx.fillText(sumLbl,IL,y+35);const lw=ctx.measureText(sumLbl).width;
    if(badge){ctx.fillStyle=badgeCol;font(15,700);ctx.fillText(badge,IL+lw+16,y+35);}
    ctx.fillStyle='#111';font(20,700);ctx.textAlign='right';ctx.fillText(sumAmt,IR,y+35);y+=72+22;
  };
  // ① 원본 영수증
  const linked=!!(r&&(r.imageId||r.scanPath));
  card(r?(r.store||'영수증'):'원본 영수증 없음',r?`${(r.paidBy||getMyName()||'').trim()||'나'} 결제`:'',fmt((r&&r.total)||0)+'원',
    r?[ymd(r.date)+(r.time?' '+r.time:''),r.paymentDetail||''].filter(Boolean).join(' · '):'',linked?'영수증 연결됨':'영수증 없음',linked?'#16843b':'#8e8e93');
  const neg=n=>Number(n)<0?'#d92d20':null,num=v=>{const n=Number(v);return v===''||v==null||!Number.isFinite(n)?'':fmt(n);};
  table([{t:'품목명',x:IL,al:'left',max:300},{t:'수량',x:410,al:'right'},{t:'단가',x:540,al:'right'},{t:'금액',x:IR,al:'right',bold:true}],
    items.map(i=>[{t:i.name,c:neg(i.amount)},{t:i.quantity??'',c:neg(i.amount)},{t:num(i.unitPrice),c:neg(i.amount)},{t:num(i.amount),c:neg(i.amount)}]),
    '상세 품목 없음','합계','','#777',fmt((r&&r.total)||0)+'원');
  // ② 입금 기록
  card('입금 기록',`입금 ${st.n}번`,fmt(st.remaining)+'원',`받을 돈 ${fmt(a.amount)}원 · 받은 돈 ${fmt(st.received)}원${a.note?' · '+a.note:''}`,
    st.done?(st.over?`완료 · ${fmt(st.over)}원 더 받음`:'완료'):'남은 금액',st.done?'#16843b':'#4355e8');
  table([{t:'회차',x:IL,al:'left'},{t:'입금일',x:112,al:'left'},{t:'메모',x:222,al:'left',max:170},{t:'입금액',x:530,al:'right',bold:true},{t:'남은 금액',x:IR,al:'right'}],
    st.pays.map((p,i)=>[{t:`${i+1}번째`,c:'#8e8e93'},ymd(p.date),{t:p.memo||'',c:'#777'},'+'+fmt(p.amount),fmt(Math.max(0,st.after.get(p.id)))]),
    '아직 받은 돈이 없어요','받은 돈',st.done?'✓ 다 받음':`남은 금액 ${fmt(st.remaining)}원`,st.done?'#16843b':'#777',fmt(st.received)+'원');
  ctx.fillStyle='#a0a0a6';font(14,500);ctx.textAlign='center';ctx.fillText(`대신 결제 내역 · ${ymd(_todayYMD())} 기준 · ${typeof APP_VERSION==='string'?APP_VERSION:''}`,W/2,H-22);
  return canvas;
}
async function advShareImage(a,onFallback){
  const r=advReceipt(a),safe=s=>String(s||'').replace(/[\\/:*?"<>|]/g,'_').slice(0,40);
  const blob=await new Promise(res=>advShareCanvas(a).toBlob(res,'image/png'));
  if(!blob){toast('공유 이미지를 만들지 못했어요.',{type:'error'});return;}
  const filename=`대신결제_${(r?.date||'').replace(/-/g,'')}_${safe(a.person)}_${safe(r?.store||'영수증')}.png`;
  const file=new File([blob],filename,{type:'image/png'});
  let can=false;try{can=!!(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})));}catch(_){}
  if(can){try{await navigator.share({files:[file]});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  onFallback(blob,file,filename);
}
// ── 추가 화면 '결제자 ▸ 대신 결제…'(v4.35): 영수증 저장 직후 받을 금액 = 영수증 총액, 일시불로 기록. 할부·금액·메모는 대신 결제 창에서 고친다.
async function advCreateFor(rec,person){
  person=normalizeName(person);
  if(!person||!rec||!rec.id)return null;
  if(advForReceipt(rec.id))return null;
  const now=nowISO(),id='adv_'+crypto.randomUUID();
  const row={key:ADV_PREFIX+id,id,type:'adv',receiptId:rec.id,person,amount:Math.round(Number(rec.total)||0),months:0,note:'',deleted:false,createdAt:now,updatedAt:now};
  if(!advValidOne(row))throw new Error('대신 결제 기록이 올바르지 않아요.');
  await advPut([row]);
  return row;
}
// v4.37 — 영수증 상세에서 총액을 고치면: 받을 금액이 원래 총액과 같았으면(따로 정한 적 없음) 새 총액을 따라간다.
//   따로 정한 금액이면 그대로 두고, 총액보다 크면 상세 대신 결제 칸에 알림이 뜬다(advDecorateReceipt). 바꿨으면 알림에 덧붙일 글을 돌려준다.
async function advFollowTotal(rec,oldTotal){
  const a=advForReceipt(rec.id),nt=Math.round(Number(rec.total)||0);
  if(!a||!(nt>0)||nt===oldTotal||a.amount!==oldTotal)return '';
  await advPut([{...a,amount:nt,updatedAt:nowISO()}]);
  return ` · 받을 금액도 ${fmtMoney(nt)}원으로 바꿨어요`;
}
