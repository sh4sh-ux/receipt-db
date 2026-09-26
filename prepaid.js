/* Prepaid balances are separate from receipts; only cash payments create expenses. */
let prepaidRecords=[];
let prepaidSelectedId=null;
let ppHistTab='use';   // v3.31 — 상세 내역 탭(use=사용 내역 / charge=충전 내역), 표시 전용
let ppHistSort='recent'; // v3.31 — 상세 내역 정렬(recent=최신순 / old=오래된순), 표시 전용(원본·계산 불변)
let ppListSort='balance'; // v3.91 — 좌측 목록 정렬(balance/recent/name), 표시 전용
let ppLastSel=null;       // v3.91 — 데스크탑에서 선불권 탭으로 돌아오면 마지막으로 본 선불권을 다시 연다
const PP_PREFIX='prepaid:';
const PP_KINDS=['charge','use','refund','expire','opening','void'];
const PP_LABELS={charge:'충전',use:'사용',refund:'환불',expire:'만료 차감',opening:'기초 잔액',void:'삭제'};

function ppMoney(value){
  const raw=typeof value==='string'?value.replace(/,/g,'').trim():value;
  const n=Number(raw);
  if(!Number.isSafeInteger(n)||n<0||n>1000000000000)throw new Error('금액은 0 이상의 정수로 입력해 주세요.');
  return n;
}
function ppDiscountRate(value){
  const n=Number(value||0);
  if(!Number.isFinite(n)||n<0||n>100)throw new Error('할인율은 0부터 100 사이로 입력해 주세요.');
  return Math.round(n*10)/10;
}
function ppDiscountedAmount(regularPrice,discountRate){
  return Math.round(ppMoney(regularPrice)*(100-ppDiscountRate(discountRate))/100);
}
function ppDate(value,optional=false){
  if(optional&&!value)return '';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('날짜를 확인해 주세요.');
  return value;
}
function ppValidateRecords(rows){
  if(rows==null)return [];
  if(!Array.isArray(rows)||rows.length>50000)throw new Error('선불권 데이터 형식이 올바르지 않아요.');
  return rows.map(r=>{
    if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(r.id)||r.key!==PP_PREFIX+r.id)throw new Error('선불권 기록 ID가 올바르지 않아요.');
    if(r.type==='wallet'){
      if(typeof r.name!=='string'||!r.name.trim()||r.name.length>200)throw new Error('선불권 매장명을 확인해 주세요.');
      return {key:r.key,id:r.id,type:r.type,name:r.name.trim(),category:String(r.category||'기타').slice(0,100),expiresOn:ppDate(r.expiresOn,true),regularPrice:ppMoney(r.regularPrice||0),discountRate:ppDiscountRate(r.discountRate||0),defaultUseAmount:ppMoney(r.defaultUseAmount||0),updatedAt:String(r.updatedAt||''),createdAt:String(r.createdAt||'')};
    }
    if(r.type!=='event'||!PP_KINDS.includes(r.kind)||typeof r.walletId!=='string')throw new Error('선불권 거래 형식이 올바르지 않아요.');
    if(r.kind==='void'&&(typeof r.reverses!=='string'||r.id!=='void_'+r.reverses))throw new Error('취소 기록을 확인해 주세요.');
    return {key:r.key,id:r.id,type:r.type,walletId:r.walletId,kind:r.kind,amount:ppMoney(r.amount),paid:ppMoney(r.paid),date:ppDate(r.date),description:String(r.description||'').slice(0,1000),receiptId:String(r.receiptId||'').slice(0,200),reverses:String(r.reverses||''),createdAt:String(r.createdAt||'')};
  });
}
function ppTotals(records,walletId){
  const events=records.filter(r=>r.type==='event'&&r.walletId===walletId);
  const voided=new Set(events.filter(e=>e.kind==='void').map(e=>e.reverses));
  const active=events.filter(e=>e.kind!=='void'&&!voided.has(e.id));
  let balance=0,paid=0,used=0;
  for(const e of active){
    balance+=(e.kind==='charge'||e.kind==='opening'?1:-1)*e.amount;
    paid+=e.kind==='charge'?e.paid:e.kind==='refund'?-e.paid:0;
    if(e.kind==='use')used+=e.amount;
  }
  return {balance,paid,used,events,active,voided};
}
async function ppExport(){return (await dbAll('settings')).filter(r=>r.key.startsWith(PP_PREFIX));}
async function ppLoad(){prepaidRecords=ppValidateRecords(await ppExport());}
async function ppMerge(rows){
  const incoming=ppValidateRecords(rows);
  if(!incoming.length)return 0;
  const db=await openDB();
  const changed=await new Promise((resolve,reject)=>{
    const tx=db.transaction('settings','readwrite'),store=tx.objectStore('settings');let count=0;
    tx.oncomplete=()=>resolve(count);tx.onabort=()=>reject(tx.error||new Error('선불권 병합 실패'));
    for(const row of incoming){
      const req=store.get(row.key);
      req.onsuccess=()=>{
        const local=req.result;
        if(!local||(row.type==='wallet'&&row.updatedAt>local.updatedAt)){store.put(row);count++;}
      };
    }
  });
  await ppLoad();
  if(document.getElementById('viewPrepaid')?.classList.contains('on')){renderPrepaid();if(typeof renderSide==='function')renderSide();}
  return changed;
}
function ppBuildEvent(rows,wallet,values,receipt){
  const totals=ppTotals(rows,wallet.id),kind=values.kind;
  if(!PP_KINDS.includes(kind))throw new Error('거래 종류를 확인해 주세요.');
  const date=ppDate(values.date),amount=ppMoney(values.amount),paid=ppMoney(values.paid||0);
  if(amount<=0&&kind!=='void')throw new Error('충전 또는 차감액을 입력해 주세요.');
  if(kind==='use'&&wallet.expiresOn&&date>wallet.expiresOn)throw new Error('유효기간이 지났어요. 매장 확인 후 유효기간을 수정해 주세요.');
  let original=null;
  if(kind==='void'){
    original=totals.active.find(e=>e.id===values.reverses);
    if(!original)throw new Error('이미 취소되었거나 찾을 수 없는 기록이에요.');
    const restored=totals.balance-(original.kind==='charge'||original.kind==='opening'?original.amount:-original.amount);
    if(restored<0)throw new Error('이미 사용한 잔액이 있어 취소할 수 없어요.');
  }else if(['use','refund','expire'].includes(kind)&&amount>totals.balance)throw new Error('차감액이 남은 잔액보다 커요.');
  if(kind==='refund'&&paid>totals.paid)throw new Error('환불액이 누적 실결제 잔액보다 커요.');
  if(kind==='charge'&&values.receiptId){
    if(!receipt||receipt.total!==paid||paid<=0)throw new Error('연결 영수증의 결제액과 실제 결제액이 같아야 해요.');
    const linked=rows.some(e=>e.type==='event'&&e.kind==='charge'&&e.receiptId===receipt.id);
    if(linked)throw new Error('이미 선불권에 연결된 영수증이에요.');
  }
  const id=original?'void_'+original.id:values.id;
  const event={key:PP_PREFIX+id,id,type:'event',walletId:wallet.id,kind,date,amount:original?original.amount:amount,paid:original?original.paid:paid,description:values.description||'',receiptId:values.receiptId||'',reverses:original?.id||'',createdAt:values.createdAt};
  let cash=kind==='charge'?paid:kind==='refund'?-paid:0;
  if(original)cash=original.kind==='charge'?-original.paid:original.kind==='refund'?original.paid:0;
  if(kind==='charge'&&values.receiptId)cash=0;
  return {event,cash};
}

async function ppCommit(walletInput,values){
  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['settings','receipts'],'readwrite'),settings=tx.objectStore('settings'),recs=tx.objectStore('receipts');let failure=null;
    tx.oncomplete=resolve;tx.onabort=()=>reject(failure||tx.error||new Error('저장하지 못했어요.'));
    const req=settings.getAll();
    req.onsuccess=()=>{
      try{
        const rows=ppValidateRecords(req.result.filter(r=>r.key.startsWith(PP_PREFIX)));
        const wallet=walletInput||rows.find(r=>r.type==='wallet'&&r.id===values.walletId);
        if(!wallet)throw new Error('선불권을 먼저 선택해 주세요.');
        if(walletInput){ppValidateRecords([walletInput]);settings.put(walletInput);}
        if(!values)return;
        const save=receipt=>{
          try{
            const {event,cash}=ppBuildEvent(rows,wallet,values,receipt);
            if(cash){
              const id='rec_pp_'+event.id;
              event.receiptId=id;
              recs.add({id,date:event.date,time:'',store:wallet.name,category:wallet.category,total:cash,items:[],imageId:'',paymentMethod:values.paymentMethod||'기타',paidBy:getMyName(),participants:[],tags:['선불권'],notes:PP_LABELS[event.kind]+' · '+(event.description||wallet.name),prepaidEventId:event.id,createdAt:event.createdAt,updatedAt:event.createdAt});
            }
            ppValidateRecords([event]);settings.add(event);
          }catch(e){failure=e;tx.abort();}
        };
        if(values.receiptId){const link=recs.get(values.receiptId);link.onsuccess=()=>save(link.result);}else save(null);
      }catch(e){failure=e;tx.abort();}
    };
  });
  await ppLoad();await loadAll();renderDetail();renderPrepaid();if(typeof renderSide==='function'&&document.getElementById('viewPrepaid')?.classList.contains('on'))renderSide(); // v3.91 — 좌측 잔액도 갱신
  void dbxSyncUpload();
}

function ppWallets(){return prepaidRecords.filter(r=>r.type==='wallet');}
function ppOpen(id){
  prepaidSelectedId=id;if(id)ppLastSel=id;ppHistTab='use';ppHistSort='recent';
  renderPrepaid();if(typeof renderSide==='function')renderSide();
  if(typeof _syncMobileSurface==='function')_syncMobileSurface();
  const b=document.getElementById('prepaidBody');if(b)b.scrollTop=0;
}
// v3.91 — 좌측 패널(영수증·사람 목록과 같은 grammar) 선불권 목록. 값은 기존 ppTotals·ppLatestUse만 사용(계산 불변).
function ppListView(){
  const q=(typeof _ppListQ==='string'?_ppListQ:'').trim();
  let list=ppWallets().map(w=>{const t=ppTotals(prepaidRecords,w.id);const charged=t.active.filter(e=>e.kind==='charge'||e.kind==='opening').reduce((s,e)=>s+e.amount,0);
    return {w,t,charged,pct:charged>0?Math.round(t.used/charged*100):null,last:ppLatestUse(t)?.date||'',expired:!!(w.expiresOn&&w.expiresOn<_todayYMD())};});
  if(q){
    if(typeof _isChoQuery==='function'&&_isChoQuery(q)){const cq=_normChoQuery(q);list=list.filter(x=>_toCho(x.w.name).includes(cq));}
    else{const qL=q.toLowerCase();list=list.filter(x=>x.w.name.toLowerCase().includes(qL));}
  }
  const byName=(a,b)=>a.w.name.localeCompare(b.w.name,'ko');
  if(ppListSort==='name')list.sort(byName);
  else if(ppListSort==='recent')list.sort((a,b)=>b.last.localeCompare(a.last)||byName(a,b));
  else list.sort((a,b)=>b.t.balance-a.t.balance||byName(a,b));
  return list;
}
function renderPrepaidSide(){
  const listEl=document.getElementById('sideList');if(!listEl)return;
  const esc=escapeHtml,money=n=>fmtMoney(n)+'원';
  if(typeof _updatePhotoFilterUi==='function')_updatePhotoFilterUi();
  const all=ppWallets();
  const tot=document.getElementById('ppScopeTotal');if(tot)tot.textContent=money(all.reduce((s,w)=>s+ppTotals(prepaidRecords,w.id).balance,0));
  const ss=document.getElementById('ppSortSel2');if(ss&&ss.value!==ppListSort)ss.value=ppListSort;
  const view=ppListView();
  const lt=document.getElementById('ltInfo');
  if(lt)lt.innerHTML=`${(typeof _ppListQ==='string'&&_ppListQ.trim())?'검색 결과':'선불권'} <b>${view.length}개</b>`;
  if(!view.length){
    listEl.innerHTML=`<div class="empty-state"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg><div>${all.length?'검색 결과가 없어요':'등록된 선불권이 없어요<br/>위의 ‘선불권 등록’으로 추가하세요'}</div></div>`;
    return;
  }
  listEl.innerHTML='<div class="list-group">'+view.map(x=>{
    const sel=x.w.id===prepaidSelectedId;
    const meta=[getCategoryLabel(x.w.category),x.expired?'유효기간 지남':x.last?'최근 '+(typeof _psnMD==='function'?_psnMD(x.last):x.last):'사용 기록 없음'].filter(Boolean).join(' · ');
    return `<div class="r-card pp-row${sel?' sel':''}" data-wallet="${esc(x.w.id)}" role="button" tabindex="0"${sel?' aria-current="true"':''}>`
      +`<div class="r-card-info"><div class="r-card-store-row"><span class="r-card-store">${esc(x.w.name)}</span></div>`
      +`<div class="pl-meta${x.expired?' danger':''}">${esc(meta)}</div>`
      +(x.pct!==null?`<div class="pp-row-bar" aria-hidden="true"><span style="width:${Math.max(0,Math.min(100,x.pct))}%"></span></div>`:'')
      +`</div><div class="r-card-amt">${money(x.t.balance)}</div></div>`;
  }).join('')+'</div>';
  listEl.querySelectorAll('.pp-row').forEach(el=>{
    const go=()=>ppOpen(el.dataset.wallet);
    el.addEventListener('click',go);
    el.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();go();});
  });
}
function ppLatestUse(totals){return totals.active.filter(e=>e.kind==='use').sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id))[0]||null;}
function ppSuggestedUseAmount(wallet,totals){return wallet.defaultUseAmount||ppLatestUse(totals)?.amount||0;}
function ppDisplayDate(date){return String(date||'').replace(/-/g,'. ') +(date?'\.':'');}
function ppRelDay(date){if(!date)return '';const d=Math.round((Date.parse(_todayYMD())-Date.parse(date))/86400000);return d<=0?'오늘':d===1?'어제':d+'일 전';}
// v3.31 — 선불권 화면 전용 인라인 아이콘(외부 의존성 없음)
const PP_ICO={
  use:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
  charge:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  refund:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-2"/></svg>',
  expire:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16h6"/></svg>',
  edit:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  more:'<svg class="pp-ico" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
  trash:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
  rcpt:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6"/></svg>'
};
function renderPrepaid(){
  const root=document.getElementById('prepaidBody');if(!root)return;
  const wallets=ppWallets();
  // v3.91 — 데스크탑은 목록이 왼쪽에 있으므로 오른쪽은 항상 선불권 하나(마지막으로 본 것 → 목록 첫 번째). 모바일은 목록부터.
  if(!wallets.some(w=>w.id===prepaidSelectedId))prepaidSelectedId=null;
  if(!prepaidSelectedId&&wallets.length&&!(typeof _isMobileLayout==='function'&&_isMobileLayout())){
    prepaidSelectedId=wallets.some(w=>w.id===ppLastSel)?ppLastSel:(ppListView()[0]||{w:wallets[0]}).w.id;
  }
  if(prepaidSelectedId)ppLastSel=prepaidSelectedId;
  const wallet=wallets.find(w=>w.id===prepaidSelectedId);
  const money=n=>fmtMoney(n)+'원',esc=escapeHtml;
  document.getElementById('viewPrepaid').classList.toggle('pp-detail-view',!!wallet);
  // v3.52 — 상세 헤더를 영수증 상세와 동일한 Responsive Detail Header grammar로 통일(데스크탑·모바일 공통):
  //   breadcrumb(← 선불권) + 제목(매장명, 한 줄 ellipsis) + meta(남은 잔액). 정보구조·계산·본문 액션은 불변.
  const _ppEb=document.getElementById('prepaidEyebrow');
  const _ppEyeRow=document.getElementById('prepaidEyeRow');
  const _ppVer=_ppEyeRow?_ppEyeRow.querySelector('.js-app-version'):null;
  const _ppMeta=document.getElementById('prepaidMeta');
  if(wallet){
    // breadcrumb (목록 복귀) — 영수증 상세의 .back-to-summary와 같은 결
    _ppEb.classList.remove('pp-eyebrow--crumb'); // v3.91 — 데스크탑 눈썹은 다른 탭과 같은 대문자 'RECEIPT DB'(모바일 crumb만 .pp-eb-m에서 해제)
    // v3.91 — 데스크탑: 눈썹 'Receipt DB'(목록이 왼쪽에 있어 breadcrumb 불필요) / 모바일: '‹ 선불권' breadcrumb(목록 복귀).
    _ppEb.innerHTML='<span class="pp-eb-d">Receipt DB</span><button class="back-to-summary pp-eb-m" id="prepaidBreadcrumb" type="button"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>선불권</button>';
    const _crumb=document.getElementById('prepaidBreadcrumb');
    if(_crumb)_crumb.addEventListener('click',()=>{if(history.state?.receiptNavigation?.index>0&&history.state.receiptNavigation.route?.tab==='prepaid')history.back();else ppOpen(null);});
    if(_ppVer)_ppVer.hidden=false;
    document.getElementById('prepaidTitle').textContent=wallet.name;
    const _exp=wallet.expiresOn&&wallet.expiresOn<_todayYMD();
    if(_ppMeta){_ppMeta.hidden=false;_ppMeta.textContent=[getCategoryLabel(wallet.category),_exp?'유효기간 지남':wallet.expiresOn?'유효기간 '+wallet.expiresOn.replace(/-/g,'.'):'유효기간 없음'].filter(Boolean).join(' · ');}
    _ppMeta&&_ppMeta.classList.toggle('pp-meta-danger',!!_exp);
  }else{
    _ppEb.classList.remove('pp-eyebrow--crumb');
    _ppEb.textContent='Receipt DB';
    if(_ppVer)_ppVer.hidden=false;
    document.getElementById('prepaidTitle').textContent='선불권';
    if(_ppMeta){_ppMeta.hidden=true;_ppMeta.textContent='';}
  }
  document.getElementById('prepaidNew').hidden=true; // v3.91 — 등록은 좌측 범위 행(#ppSideNew)
  document.getElementById('prepaidBack').hidden=true; // v3.30 — 화면 내 뒤로가기 화살표 UI 제거(목록 복귀는 breadcrumb)
  // 진행바 조각: 총 충전(=충전+기초 잔액 합)이 양수일 때만. 계산은 기존 active 이벤트만 사용(저장/계산 로직 불변).
  const barHtml=(charged,used,pct)=>charged>0?`<div class="pp-bar" role="img" aria-label="사용 ${pct}%"><span style="width:${Math.max(0,Math.min(100,pct))}%"></span></div><div class="pp-bar-legend"><span>사용 ${money(used)} (${pct}%)</span><span>총 ${money(charged)}</span></div>`:'';
  // 파생값(전부 기존 계산 함수만 사용)
  const derive=w=>{const t=ppTotals(prepaidRecords,w.id);const uses=t.active.filter(e=>e.kind==='use').length;const charged=t.active.filter(e=>e.kind==='charge'||e.kind==='opening').reduce((s,e)=>s+e.amount,0);const suggested=ppSuggestedUseAmount(w,t);return {t,uses,charged,pct:charged>0?Math.round(t.used/charged*100):null,avg:uses>0?Math.round(t.used/uses):0,latestUse:ppLatestUse(t),suggested,remaining:suggested?Math.floor(t.balance/suggested):null,expired:w.expiresOn&&w.expiresOn<_todayYMD()};};
  const idRow=(w,expired,clickable)=>`<div class="pp-id"><div class="pp-id-text"><b class="pp-id-name"><span class="pp-id-nm">${esc(w.name)}</span>${clickable?'<span class="pp-id-chev" aria-hidden="true">›</span>':''}</b><small>${esc(getCategoryLabel(w.category))}</small></div><span class="pp-id-expiry${expired?' danger':''}">${expired?'유효기간 지남':w.expiresOn?esc(w.expiresOn):'유효기간 없음'}</span></div>`;
  const statBoxes=d=>`<div class="pp-sbox"><small>사용 횟수</small><b>${d.uses}회</b>${d.remaining!==null?`<i>약 ${d.remaining}회 남음</i>`:''}</div>${d.latestUse?`<div class="pp-sbox"><small>최근 방문</small><b>${esc(ppDisplayDate(d.latestUse.date))}</b><i>${ppRelDay(d.latestUse.date)}</i></div>`:''}${d.uses>0?`<div class="pp-sbox"><small>1회 평균 사용</small><b>${money(d.avg)}</b><i>총 ${d.uses}회 기준</i></div>`:''}`;
  if(!wallet){
    // v3.91 — 목록은 좌측 패널. 오른쪽은 선불권이 없을 때만 안내(모바일 목록 화면에선 오른쪽이 안 보임).
    root.innerHTML=`<div class="empty-state" style="padding:56px 12px;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg><div>${wallets.length?'목록에서 선불권을 선택하세요':'등록된 선불권이 없어요'}</div>${wallets.length?'':'<button class="primary-btn" type="button" id="ppEmptyNew" style="margin-top:14px;width:auto;padding:0 18px">선불권 등록</button>'}</div>`;
    root.querySelector('#ppEmptyNew')?.addEventListener('click',()=>ppWalletForm());return;
  }
  const d=derive(wallet),t=d.t;
  const priceInfo=wallet.regularPrice?`정가 ${money(wallet.regularPrice)}${wallet.discountRate?` · ${wallet.discountRate}% 할인`:''}`:'';
  // 실행 잔액(표시용): 오래된 순으로 누적. 저장 데이터·계산 함수는 변경하지 않음.
  const asc=t.active.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const runMap={};let run=0;for(const e of asc){run+=(e.kind==='charge'||e.kind==='opening'?1:-1)*e.amount;runMap[e.id]=run;}
  const desc=asc.slice().reverse();
  const grpOf=e=>e.kind==='use'?'use':'charge'; // 사용 내역 vs 충전 내역(충전·기초·환불·만료 포함) — 표시 분류만
  const useCount=t.active.filter(e=>e.kind==='use').length,allCount=t.active.length,chargeCount=allCount-useCount;
  let curTab=ppHistTab; if(curTab==='use'&&useCount===0&&chargeCount>0)curTab='charge'; if(curTab==='charge'&&chargeCount===0&&useCount>0)curTab='use';
  const rows=ppHistSort==='old'?asc:desc;
  const contentOf=e=>e.kind==='use'?`${esc(wallet.name)}${e.description?' ('+esc(e.description)+')':''}`:(e.description?esc(e.description):PP_LABELS[e.kind]);
  const chip=e=>`<span class="pp-chip pp-chip-${grpOf(e)}">${PP_LABELS[e.kind]}</span>`;
  const rowMenu=e=>`<div class="pp-rowmenu"><button type="button" class="pp-dots" aria-haspopup="menu" aria-label="관리"><span class="pp-dots-more">${PP_ICO.more}</span><span class="pp-dots-chev" aria-hidden="true">›</span></button><div class="pp-menu" hidden>${e.receiptId?`<button type="button" data-receipt="${esc(e.receiptId)}">${PP_ICO.rcpt}<span>영수증 보기</span></button>`:''}<button type="button" class="danger" data-void="${esc(e.id)}">${PP_ICO.trash}<span>기록 삭제</span></button></div></div>`;
  const tableRows=rows.map(e=>{const p=e.kind==='charge'||e.kind==='opening';return `<tr data-grp="${grpOf(e)}"><td class="pp-td-date">${esc(ppDisplayDate(e.date))}</td><td>${chip(e)}</td><td class="pp-td-desc">${contentOf(e)}</td><td class="num ${p?'pos':'neg'}">${p?'+':'−'}${money(e.amount)}</td><td class="num pp-td-bal">${money(runMap[e.id])}</td><td class="pp-td-act">${rowMenu(e)}</td></tr>`;}).join('');
  const listRows=rows.map(e=>{const p=e.kind==='charge'||e.kind==='opening';return `<div class="pp-mrow" data-grp="${grpOf(e)}"><div class="pp-mrow-main"><small class="pp-mrow-meta">${esc(ppDisplayDate(e.date))}</small><b class="pp-mrow-desc">${contentOf(e)}</b></div><div class="pp-mrow-amt"><strong class="${p?'pos':'neg'}">${p?'+':'−'}${money(e.amount)}</strong><small class="pp-mrow-bal">잔액 ${money(runMap[e.id])}</small></div><div class="pp-mrow-act">${rowMenu(e)}</div></div>`;}).join('');
  const emptyHist='<div class="empty-state">충전 또는 사용 기록이 없어요.</div>';
  const actionsHtml=`<div class="pp-actions">
    <button class="primary-btn" data-kind="use">${PP_ICO.use}<span>1회 사용<span class="pp-amt">${d.suggested?' · '+money(d.suggested):''}</span></span></button>
    <button class="ghost-btn" data-kind="charge">${PP_ICO.charge}<span>충전</span></button>
    <button class="ghost-btn" data-kind="refund">${PP_ICO.refund}<span>환불</span></button>
    <button class="ghost-btn pp-a-deskonly" data-kind="expire">${PP_ICO.expire}<span>만료 차감</span></button>
    <button class="ghost-btn pp-a-deskonly js-pp-edit" type="button">${PP_ICO.edit}<span>정보 수정</span></button>
    <div class="pp-morewrap pp-a-mobonly"><button class="ghost-btn" id="ppMore" type="button" aria-haspopup="menu">${PP_ICO.more}<span>더보기</span></button><div class="pp-menu" id="ppMoreMenu" hidden><button type="button" data-kind="expire">${PP_ICO.expire}<span>만료 차감 처리</span></button><button type="button" class="js-pp-edit">${PP_ICO.edit}<span>정보 수정</span></button></div></div>
  </div>`;
  root.innerHTML=`<div class="pp-detail">
    <div class="pp-card pp-card--detail">
      <div class="pp-core"><div class="pp-core-bal"><span class="pp-bc-label">남은 잔액</span><strong class="pp-bc-value">${money(t.balance)}</strong>${priceInfo?`<span class="pp-bc-meta">${priceInfo}</span>`:''}${barHtml(d.charged,t.used,d.pct)}</div><div class="pp-core-stats">${statBoxes(d)}</div></div>
      ${t.balance<0?'<p class="alert err">동기화된 사용 기록이 잔액을 초과했어요. 최근 기록을 확인해 주세요.</p>':''}
      ${actionsHtml}
    </div>
    <div class="pp-hist tab-${curTab}">
      <div class="pp-hist-head"><div class="pp-tabs" role="tablist"><button type="button" data-htab="use" class="${curTab==='use'?'on':''}">사용 내역 <span>${useCount}</span></button><button type="button" data-htab="charge" class="${curTab==='charge'?'on':''}">충전 내역 <span>${chargeCount}</span></button></div><label class="pp-sort"><select id="ppSortSel" aria-label="정렬"><option value="recent"${ppHistSort==='recent'?' selected':''}>최신순</option><option value="old"${ppHistSort==='old'?' selected':''}>오래된순</option></select></label></div>
      ${allCount?`<table class="pp-table"><thead><tr><th>날짜</th><th>구분</th><th>내용</th><th class="num">금액</th><th class="num">잔액</th><th aria-label="관리"></th></tr></thead><tbody>${tableRows}</tbody></table><div class="pp-mlist">${listRows}</div>`:emptyHist}
    </div>
  </div>`;
  root.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>ppEventForm(b.dataset.kind)));
  root.querySelectorAll('.js-pp-edit').forEach(b=>b.addEventListener('click',()=>ppWalletForm(wallet)));
  // 탭(표시 전용 — 원본·계산 불변)
  root.querySelectorAll('[data-htab]').forEach(b=>b.addEventListener('click',()=>{ppHistTab=b.dataset.htab;const h=root.querySelector('.pp-hist');if(h){h.classList.remove('tab-use','tab-charge');h.classList.add('tab-'+ppHistTab);}root.querySelectorAll('[data-htab]').forEach(x=>x.classList.toggle('on',x===b));}));
  // 정렬(표시 전용 — 재렌더로 표시만 재정렬)
  const sortSel=root.querySelector('#ppSortSel');if(sortSel)sortSel.addEventListener('change',()=>{ppHistSort=sortSel.value;renderPrepaid();});
  // ••• / 더보기 메뉴 토글(다른 메뉴는 닫음)
  root.querySelectorAll('.pp-dots,#ppMore').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const menu=btn.parentElement.querySelector('.pp-menu');if(!menu)return;const willOpen=menu.hidden;ppCloseMenus();menu.hidden=!willOpen;}));
  root.querySelectorAll('[data-receipt]').forEach(b=>b.addEventListener('click',()=>{
    if(!receipts.some(r=>r.id===b.dataset.receipt)){toast('연결된 영수증을 찾을 수 없어요.',{type:'warning'});return;}
    selectReceipt(b.dataset.receipt);
  }));
  root.querySelectorAll('[data-void]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('이 기록을 삭제할까요? 결제 기록이 있으면 반대 금액의 정정 영수증이 추가됩니다.'))return;
    b.disabled=true;
    try{await ppCommit(null,{walletId:wallet.id,kind:'void',reverses:b.dataset.void,date:_todayYMD(),amount:0,paid:0,createdAt:nowISO(),description:'삭제'});toast('기록을 삭제했어요.');}
    catch(e){b.disabled=false;toast(e.message,{type:'error'});}
  }));
}
// v3.31 — 행/더보기 메뉴 바깥 클릭·ESC 닫기(1회 등록)
function ppCloseMenus(except){document.querySelectorAll('#viewPrepaid .pp-menu').forEach(m=>{if(m!==except)m.hidden=true;});}
document.addEventListener('click',()=>ppCloseMenus());
document.addEventListener('keydown',e=>{if(e.key==='Escape')ppCloseMenus();});

function ppDialog(title,html,onSave){
  const dialog=document.createElement('dialog');dialog.className='pp-dialog';
  dialog.innerHTML=`<form><div class="pp-dialog-head"><h2>${escapeHtml(title)}</h2><button type="button" class="icon-btn" aria-label="닫기">×</button></div>${html}<p class="pp-error" role="alert"></p><div class="pp-dialog-actions"><button type="button" class="ghost-btn pp-cancel">취소</button><button type="submit" class="primary-btn">저장</button></div></form>`;
  document.body.append(dialog);
  dialog.querySelector('.icon-btn').onclick=()=>dialog.close();dialog.querySelector('.pp-cancel').onclick=()=>dialog.close();
  dialog.querySelectorAll('[data-money]').forEach(input=>{
    const format=()=>{const raw=input.value.replace(/[^0-9]/g,'');input.value=raw?Number(raw).toLocaleString('ko-KR'):'';};
    input.addEventListener('input',format);format();
  });
  dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('form').addEventListener('submit',async e=>{
    e.preventDefault();const submit=dialog.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;
    try{await onSave(new FormData(e.target));dialog.close();toast('저장했어요.',{type:'success'});}
    catch(err){dialog.querySelector('.pp-error').textContent=err.message;submit.disabled=false;}
  });
  dialog.showModal();return dialog;
}
function ppWalletForm(wallet=null){
  const esc=escapeHtml;
  const dialog=ppDialog(wallet?'선불권 정보 수정':'선불권 등록',`<label>매장명<input name="name" required maxlength="200" value="${esc(wallet?.name||'')}" placeholder="예: 단골 미용실"></label><label>카테고리<select name="category">${BASE_CATEGORIES.map(c=>`<option value="${esc(c)}"${c===(wallet?.category||'스파')?' selected':''}>${esc(getCategoryLabel(c))}</option>`).join('')}</select></label><label>유효기간 (선택)<input name="expiresOn" type="date" value="${esc(wallet?.expiresOn||'')}"></label><div class="pp-price-grid"><label>서비스 정가 (선택)<input name="regularPrice" type="text" inputmode="numeric" data-money value="${wallet?.regularPrice||''}" placeholder="예: 23,000"></label><label>할인율 (%)<input name="discountRate" type="number" min="0" max="100" step="0.1" value="${wallet?.discountRate||0}"></label></div><label>실제 1회 차감액 (선택)<input name="defaultUseAmount" type="text" inputmode="numeric" data-money value="${wallet?.defaultUseAmount||''}" placeholder="정가와 할인율로 자동 계산"></label><p class="pp-calc" aria-live="polite"></p>${wallet?'':'<label>기존 남은 잔액 (지출 제외)<input name="opening" type="text" inputmode="numeric" data-money value="0" required></label>'}`,async form=>{
    const now=nowISO(),id=wallet?.id||'wallet_'+crypto.randomUUID();
    const row={key:PP_PREFIX+id,id,type:'wallet',name:String(form.get('name')).trim(),category:form.get('category'),expiresOn:form.get('expiresOn'),regularPrice:ppMoney(form.get('regularPrice')||0),discountRate:ppDiscountRate(form.get('discountRate')),defaultUseAmount:ppMoney(form.get('defaultUseAmount')||0),createdAt:wallet?.createdAt||now,updatedAt:now};
    const amount=wallet?0:ppMoney(form.get('opening'));
    await ppCommit(row,amount?{id:'event_'+crypto.randomUUID(),kind:'opening',date:_todayYMD(),amount,paid:0,createdAt:now,description:'등록 시 잔액'}:null);
    ppOpen(id);
  });
  const regular=dialog.querySelector('[name=regularPrice]'),rate=dialog.querySelector('[name=discountRate]'),amount=dialog.querySelector('[name=defaultUseAmount]'),calc=dialog.querySelector('.pp-calc');
  const updatePrice=()=>{
    const price=Number(regular.value.replace(/,/g,'')),discount=Number(rate.value||0);
    if(!price||!Number.isFinite(discount)||discount<0||discount>100){calc.textContent='';return;}
    const discounted=Math.round(price*(100-discount)/100);
    amount.value=fmtMoney(discounted);
    calc.textContent=`${fmtMoney(price)}원에서 ${discount}% 할인 · 1회 ${fmtMoney(discounted)}원 차감`;
  };
  regular.addEventListener('input',updatePrice);rate.addEventListener('input',updatePrice);updatePrice();
}
function ppEventForm(kind){
  const wallet=ppWallets().find(w=>w.id===prepaidSelectedId);if(!wallet)return;
  const t=ppTotals(prepaidRecords,wallet.id),esc=escapeHtml;
  const linked=new Set(prepaidRecords.filter(e=>e.type==='event'&&e.kind==='charge').map(e=>e.receiptId));
  const options=receipts.filter(r=>r.total>0&&!linked.has(r.id)&&!r.prepaidEventId);
  const cash=kind==='charge'||kind==='refund';
  const initialAmount=kind==='expire'?Math.max(0,t.balance):kind==='use'?(ppSuggestedUseAmount(wallet,t)||''):'';
  const dialog=ppDialog(PP_LABELS[kind],`<label>날짜<input name="date" type="date" value="${_todayYMD()}" required></label><label>${kind==='charge'?'충전액 (보너스 포함)':'잔액 차감액'}<input name="amount" type="text" inputmode="numeric" data-money value="${initialAmount}" required></label>${cash?`<label>${kind==='charge'?'실제 결제액 (지출 반영)':'실제 환불액 (지출 차감)'}<input name="paid" type="text" inputmode="numeric" data-money required></label><label>결제수단<select name="paymentMethod"><option>카드</option><option>현금</option><option>계좌이체</option><option>기타</option></select></label>`:''}${kind==='charge'?`<label>결제 기록<select name="receiptId"><option value="">새 영수증 등록</option>${options.map(r=>`<option value="${esc(r.id)}">기존 연결 · ${esc(r.date)} · ${esc(r.store)} · ${fmtMoney(r.total)}원</option>`).join('')}</select></label>`:''}<label>${kind==='use'?'시술명·사용 내용':'메모'}<input name="description" maxlength="1000" ${kind==='use'?'required':''} placeholder="${kind==='use'?'예: 커트, 염색':''}"></label>`,async form=>{
    await ppCommit(null,{walletId:wallet.id,id:'event_'+crypto.randomUUID(),kind,date:form.get('date'),amount:ppMoney(form.get('amount')),paid:cash?ppMoney(form.get('paid')):0,paymentMethod:form.get('paymentMethod'),receiptId:form.get('receiptId')||'',description:form.get('description'),createdAt:nowISO()});
  });
  dialog.querySelector('[name=receiptId]')?.addEventListener('change',e=>{
    const rec=receipts.find(r=>r.id===e.target.value);if(!rec)return;
    dialog.querySelector('[name=paid]').value=fmtMoney(rec.total);
    dialog.querySelector('[name=date]').value=rec.date;
  });
}
