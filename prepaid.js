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
async function ppLoad(){prepaidRecords=ppValidateRecords(await ppExport());if(typeof sbLoad==='function')await sbLoad();} // v4.29 — 구독도 함께
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
  prepaidSelectedId=id;ppHistTab='use';ppHistSort='recent';
  if(id){if(String(id).startsWith('sub_')){sbLastSel=id;sbSetSeg('sub');}else{ppLastSel=id;sbSetSeg('pp');}} // v4.29 — 구독·선불권 한 선택값, 연 쪽으로 [구독|선불권] 전환
  renderPrepaid();if(typeof renderSide==='function')renderSide();
  if(typeof _syncMobileSurface==='function')_syncMobileSurface();
  const b=document.getElementById('prepaidBody');if(b)b.scrollTop=0;
}
// v4.29 — 등록 창 저장 뒤 여는 것은 비동기라 클릭 기록(_captureNavigation)이 못 잡는다 → 같은 방식으로 이동을 직접 기록(‹ 멤버십 = 목록으로).
function ppOpenRecorded(id){
  if(typeof _navigationSnapshot!=='function'){ppOpen(id);return;}
  const before=_navigationSnapshot();ppOpen(id);
  setTimeout(()=>{
    const after=_navigationSnapshot();if(JSON.stringify(before.route)===JSON.stringify(after.route))return;
    const index=history.state?.receiptNavigation?.index||0;
    history.replaceState({...history.state,receiptNavigation:{index,...before}},'');
    history.pushState({receiptNavigation:{index:index+1,...after}},'');
  },0);
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
  const all=ppWallets(),seg=sbCurSeg();
  // v4.29 — [구독 | 선불권] 전환(범위 행). 선불권 총 잔액은 목록 머리(ltInfo)로 옮겼다.
  document.querySelectorAll('#ppSeg [data-seg]').forEach(b=>{const on=b.dataset.seg===seg;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));});
  const sn=document.getElementById('sbSegN');if(sn)sn.textContent=sbSubs().filter(x=>!(x.endedOn&&x.endedOn<=_todayYMD())).length;
  const pn=document.getElementById('ppSegN');if(pn)pn.textContent=all.length;
  document.querySelector('.side')?.classList.toggle('sb-mode',seg==='sub');
  if(seg!=='sub')document.querySelector('.side')?.classList.remove('sb-empty');
  if(seg==='sub'){sbRenderSide();return;}
  const totalBal=all.reduce((s,w)=>s+ppTotals(prepaidRecords,w.id).balance,0);
  const ss=document.getElementById('ppSortSel2');if(ss&&ss.value!==ppListSort)ss.value=ppListSort;
  const view=ppListView();
  const lt=document.getElementById('ltInfo');
  if(lt)lt.innerHTML=(typeof _ppListQ==='string'&&_ppListQ.trim())?`검색 결과 <b>${view.length}개</b>`:all.length?`남은 잔액 <b>${money(totalBal)}</b>`:'';
  if(!view.length){
    listEl.innerHTML=`<div class="empty-state"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg><div>${all.length?'검색 결과가 없어요':'등록된 선불권이 없어요<br/>위의 ‘등록’으로 추가하세요'}</div></div>`;
    return;
  }
  listEl.innerHTML='<div class="list-group">'+view.map(x=>{
    const sel=x.w.id===prepaidSelectedId;
    // v3.91 — 내역 목록(.r-card)과 같은 형태: 매장명 / 메타(카테고리 · 최근 사용일 YYYY.MM.DD) … 금액. 막대 없음(행 높이 동일).
    const meta=[getCategoryLabel(x.w.category),x.expired?'유효기간 지남':x.last?'최근 '+x.last.replace(/-/g,'.'):'사용 기록 없음'].filter(Boolean).join(' · ');
    return `<div class="r-card ppw-row${sel?' sel':''}" data-wallet="${esc(x.w.id)}" role="button" tabindex="0"${sel?' aria-current="true"':''}>`
      +`<div class="r-card-info"><div class="r-card-store-row"><span class="r-card-store">${esc(x.w.name)}</span></div>`
      +`<div class="r-card-meta${x.expired?' danger':''}">${esc(meta)}</div></div>`
      +`<div class="r-card-amt">${money(x.t.balance)}</div></div>`;
  }).join('')+'</div>';
  listEl.querySelectorAll('.ppw-row').forEach(el=>{
    const go=()=>ppOpen(el.dataset.wallet);
    el.addEventListener('click',go);
    el.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();go();});
  });
}
function ppLatestUse(totals){return totals.active.filter(e=>e.kind==='use').sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id))[0]||null;}
function ppSuggestedUseAmount(wallet,totals){return wallet.defaultUseAmount||ppLatestUse(totals)?.amount||0;}
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
  const wallets=ppWallets(),subs=sbSubs(),seg=sbCurSeg();
  // v3.91 — 데스크탑은 목록이 왼쪽에 있으므로 오른쪽은 항상 하나(마지막으로 본 것 → 목록 첫 번째). 모바일은 목록부터.
  // v4.29 — 선택값 하나로 구독(sub_…)·선불권을 함께 다룬다. 데스크탑 자동 선택은 지금 보고 있는 쪽([구독|선불권])에서.
  if(!wallets.some(w=>w.id===prepaidSelectedId)&&!subs.some(x=>x.id===prepaidSelectedId))prepaidSelectedId=null;
  if(!prepaidSelectedId&&!(typeof _isMobileLayout==='function'&&_isMobileLayout())){
    if(seg==='sub'){if(subs.length)prepaidSelectedId=subs.some(x=>x.id===sbLastSel)?sbLastSel:sbOrdered()[0].s.id;}
    else if(wallets.length)prepaidSelectedId=wallets.some(w=>w.id===ppLastSel)?ppLastSel:(ppListView()[0]||{w:wallets[0]}).w.id;
  }
  const sub=subs.find(x=>x.id===prepaidSelectedId);
  if(sub)sbLastSel=sub.id;else if(prepaidSelectedId)ppLastSel=prepaidSelectedId;
  const wallet=wallets.find(w=>w.id===prepaidSelectedId);
  const money=n=>fmtMoney(n)+'원',esc=escapeHtml;
  document.getElementById('viewPrepaid').classList.toggle('pp-detail-view',!!(wallet||sub));
  // v3.52 — 상세 헤더를 영수증 상세와 동일한 Responsive Detail Header grammar로 통일(데스크탑·모바일 공통):
  //   breadcrumb(← 선불권) + 제목(매장명, 한 줄 ellipsis) + meta(남은 잔액). 정보구조·계산·본문 액션은 불변.
  const _ppEb=document.getElementById('prepaidEyebrow');
  const _ppEyeRow=document.getElementById('prepaidEyeRow');
  const _ppVer=_ppEyeRow?_ppEyeRow.querySelector('.js-app-version'):null;
  const _ppMeta=document.getElementById('prepaidMeta');
  if(wallet||sub){
    // breadcrumb (목록 복귀) — 영수증 상세의 .back-to-summary와 같은 결
    // v3.91 — 데스크탑: 눈썹 'Receipt DB'(목록이 왼쪽에 있어 breadcrumb 불필요) / 모바일: '‹ 선불권' breadcrumb(목록 복귀).
    _ppEb.innerHTML='<span class="pp-eb-d">Receipt DB</span><button class="back-to-summary pp-eb-m" id="prepaidBreadcrumb" type="button"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>멤버십</button>';
    const _crumb=document.getElementById('prepaidBreadcrumb');
    if(_crumb)_crumb.addEventListener('click',()=>{if(history.state?.receiptNavigation?.index>0&&history.state.receiptNavigation.route?.tab==='prepaid')history.back();else ppOpen(null);});
    if(_ppVer)_ppVer.hidden=false;
    document.getElementById('prepaidTitle').textContent=(wallet||sub).name;
    const _exp=!!(wallet&&wallet.expiresOn&&wallet.expiresOn<_todayYMD());
    if(_ppMeta){_ppMeta.hidden=false;_ppMeta.textContent=sub?['구독',getCategoryLabel(sub.category),sub.endedOn&&sub.endedOn<=_todayYMD()?'해지함':''].filter(Boolean).join(' · '):[getCategoryLabel(wallet.category),_exp?'유효기간 지남':wallet.expiresOn?'유효기간 '+wallet.expiresOn.replace(/-/g,'.'):'유효기간 없음'].filter(Boolean).join(' · ');}
    _ppMeta&&_ppMeta.classList.toggle('pp-meta-danger',_exp);
  }else{
    _ppEb.textContent='Receipt DB';
    if(_ppVer)_ppVer.hidden=false;
    document.getElementById('prepaidTitle').textContent='멤버십';
    if(_ppMeta){_ppMeta.hidden=true;_ppMeta.textContent='';}
  }
  document.getElementById('prepaidNew').hidden=true; // v3.91 — 등록은 좌측 범위 행(#ppSideNew)
  document.getElementById('prepaidBack').hidden=true; // v3.30 — 화면 내 뒤로가기 화살표 UI 제거(목록 복귀는 breadcrumb)
  // 파생값(전부 기존 계산 함수만 사용)
  const derive=w=>{const t=ppTotals(prepaidRecords,w.id);const uses=t.active.filter(e=>e.kind==='use').length;const charged=t.active.filter(e=>e.kind==='charge'||e.kind==='opening').reduce((s,e)=>s+e.amount,0);const suggested=ppSuggestedUseAmount(w,t);return {t,uses,charged,pct:charged>0?Math.round(t.used/charged*100):null,avg:uses>0?Math.round(t.used/uses):0,latestUse:ppLatestUse(t),suggested,remaining:suggested?Math.floor(t.balance/suggested):null,expired:w.expiresOn&&w.expiresOn<_todayYMD()};};
  if(sub){sbRenderDetail(root,sub);return;}
  if(!wallet&&seg==='sub'){
    root.innerHTML=subs.length?'<div class="empty-state" style="padding:56px 12px;"><div>목록에서 구독을 선택하세요</div></div>':sbGuideHtml('sbEmptyNew2');
    root.querySelector('#sbEmptyNew2')?.addEventListener('click',()=>sbForm());return;
  }
  if(!wallet){
    // v3.91 — 목록은 좌측 패널. 오른쪽은 선불권이 없을 때만 안내(모바일 목록 화면에선 오른쪽이 안 보임).
    root.innerHTML=`<div class="empty-state" style="padding:56px 12px;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg><div>${wallets.length?'목록에서 선불권을 선택하세요':'등록된 선불권이 없어요'}</div>${wallets.length?'':'<button class="sbx-cta" type="button" id="ppEmptyNew">'+PP_ICO.charge+'선불권 등록</button>'}</div>`;
    root.querySelector('#ppEmptyNew')?.addEventListener('click',()=>ppWalletForm());return;
  }
  const d=derive(wallet),t=d.t;
  const priceInfo=wallet.regularPrice?`정가 ${money(wallet.regularPrice)}${wallet.discountRate?` · ${wallet.discountRate}% 할인`:''}`:'';
  // v4.25 — 월렛 카드 · 아이콘 버튼 · 잔액·화살표 없는 내역(월별) · 줄을 누르면 기록 창(보기 → 수정 / 삭제 확인). 계산은 기존 ppTotals 그대로.
  const asc=t.active.slice().sort(ppEventOrder);
  const grpOf=e=>e.kind==='use'?'use':'charge'; // 사용 내역 vs 충전 내역(충전·기초·환불·만료 포함) — 표시 분류만
  const useCount=t.active.filter(e=>e.kind==='use').length,allCount=t.active.length,chargeCount=allCount-useCount;
  let curTab=ppHistTab; if(curTab==='use'&&useCount===0&&chargeCount>0)curTab='charge'; if(curTab==='charge'&&chargeCount===0&&useCount>0)curTab='use';
  const shown=(ppHistSort==='old'?asc:asc.slice().reverse()).filter(e=>grpOf(e)===curTab);
  const thisYear=new Date().getFullYear();
  const mLbl=k=>{const [y,m]=k.split('-');return (+y===thisYear?'':y+'년 ')+(+m)+'월';};
  let histHtml='',lastM='';
  for(const e of shown){
    const k=e.date.slice(0,7);if(k!==lastM){histHtml+=`<div class="ppx-mh">${mLbl(k)}</div>`;lastM=k;}
    const p=ppIsPlus(e);
    histHtml+=`<button type="button" class="ppx-row" data-ev="${esc(e.id)}"><span class="ppx-row-l"><span class="ppx-row-d">${ppDayLabel(e.date)}${e.kind!=='use'&&e.description?' · '+PP_LABELS[e.kind]:''}</span><span class="ppx-row-n">${esc(ppEventDesc(e))}</span></span><span class="ppx-row-a${p?' pos':''}">${p?'+':'−'}${money(e.amount)}</span></button>`;
  }
  const emptyHist='<div class="empty-state">충전 또는 사용 기록이 없어요.</div>';
  const remainPct=d.charged>0?Math.max(0,Math.min(100,Math.round(t.balance/d.charged*100))):null;
  const expTxt=d.expired?'유효기간 지남':wallet.expiresOn?'유효기간 '+wallet.expiresOn.replace(/-/g,'.'):'유효기간 없음';
  const subTxt=d.remaining!==null&&d.remaining>=0&&t.balance>0?`약 ${d.remaining}회 더 이용할 수 있어요`:priceInfo;
  const cardHtml=`<div class="ppx-wal${d.expired?' expired':''}"><div class="ppx-wal-top"><span>남은 잔액</span><span>${esc(expTxt)}</span></div>`
    +`<div class="ppx-wal-bal">${fmtMoney(t.balance)}<small>원</small></div>${subTxt?`<div class="ppx-wal-sub">${esc(subTxt)}</div>`:''}`
    +(remainPct!==null?`<div class="ppx-wal-bar" role="img" aria-label="${remainPct}% 남음"><i style="width:${remainPct}%"></i></div><div class="ppx-wal-foot"><span>총 ${money(d.charged)} 중 ${remainPct}% 남음</span>${d.suggested?`<span>1회 ${money(d.suggested)}</span>`:''}</div>`:'')
    +`</div>`;
  const tile=(attrs,ico,label,cls)=>`<button type="button" class="ppx-tile${cls||''}" ${attrs}><i>${ico}</i><span>${label}</span></button>`;
  const actionsHtml=`<div class="ppx-tiles">${tile('data-kind="use"',PP_ICO.use,'1회 사용',' primary')}${tile('data-kind="charge"',PP_ICO.charge,'충전')}${tile('data-kind="refund"',PP_ICO.refund,'환불')}`
    +`${tile('data-kind="expire"',PP_ICO.expire,'만료 차감',' deskonly')}${tile('data-ppedit="1"',PP_ICO.edit,'정보 수정',' deskonly js-pp-edit')}`
    +`<div class="ppx-morewrap mobonly"><button type="button" class="ppx-tile" id="ppMore" aria-haspopup="menu"><i>${PP_ICO.more}</i><span>더보기</span></button><div class="pp-menu" id="ppMoreMenu" hidden><button type="button" data-kind="expire">${PP_ICO.expire}<span>만료 차감 처리</span></button><button type="button" class="js-pp-edit">${PP_ICO.edit}<span>정보 수정</span></button></div></div></div>`;
  root.innerHTML=`<div class="pp-detail ppx">${cardHtml}
    ${t.balance<0?'<p class="alert err">동기화된 사용 기록이 잔액을 초과했어요. 최근 기록을 확인해 주세요.</p>':''}
    ${actionsHtml}
    <div class="ppx-hist">
      <div class="pp-hist-head"><div class="pp-tabs" role="tablist"><button type="button" data-htab="use" class="${curTab==='use'?'on':''}">사용 내역 <span>${useCount}</span></button><button type="button" data-htab="charge" class="${curTab==='charge'?'on':''}">충전 내역 <span>${chargeCount}</span></button></div><label class="pp-sort"><select id="ppSortSel" aria-label="정렬"><option value="recent"${ppHistSort==='recent'?' selected':''}>최신순</option><option value="old"${ppHistSort==='old'?' selected':''}>오래된순</option></select></label></div>
      ${allCount?(histHtml||'<div class="empty-state">이 탭에는 기록이 없어요.</div>'):emptyHist}
    </div>
  </div>`;
  root.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>ppEventForm(b.dataset.kind)));
  root.querySelectorAll('.js-pp-edit').forEach(b=>b.addEventListener('click',()=>ppWalletForm(wallet)));
  // 탭 — 월 제목이 탭마다 달라 다시 그린다(표시 전용)
  root.querySelectorAll('[data-htab]').forEach(b=>b.addEventListener('click',()=>{ppHistTab=b.dataset.htab;renderPrepaid();}));
  const sortSel=root.querySelector('#ppSortSel');if(sortSel)sortSel.addEventListener('change',()=>{ppHistSort=sortSel.value;renderPrepaid();});
  root.querySelectorAll('#ppMore').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const menu=btn.parentElement.querySelector('.pp-menu');if(!menu)return;const willOpen=menu.hidden;ppCloseMenus();menu.hidden=!willOpen;}));
  root.querySelectorAll('.ppx-row[data-ev]').forEach(b=>b.addEventListener('click',()=>ppRecordSheet(wallet.id,b.dataset.ev)));
}
// v4.25 — 선불권 기록 표시 헬퍼(표시 전용)
function ppEventOrder(a,b){return a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id);}
function ppIsPlus(e){return e.kind==='charge'||e.kind==='opening';}
function ppEventDesc(e){return e.description||(e.kind==='use'?'사용':PP_LABELS[e.kind]);}
const PP_WD=['일','월','화','수','목','금','토'];
function ppDayLabel(iso){const x=new Date(iso+'T00:00:00');return `${x.getMonth()+1}월 ${x.getDate()}일 ${PP_WD[x.getDay()]}`;}
function ppDayFull(iso){const x=new Date(iso+'T00:00:00');return `${x.getFullYear()}년 ${x.getMonth()+1}월 ${x.getDate()}일 ${PP_WD[x.getDay()]}요일`;}
// v4.25 — 기록 수정 = 원래 기록 취소(void) + 고친 기록 추가를 한 트랜잭션으로(둘 다 되거나 둘 다 안 됨). 결제 영수증이 연결된 기록은 수정하지 않는다.
async function ppCommitEdit(walletId,origId,values){
  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['settings'],'readwrite'),settings=tx.objectStore('settings');let failure=null;
    tx.oncomplete=resolve;tx.onabort=()=>reject(failure||tx.error||new Error('저장하지 못했어요.'));
    const req=settings.getAll();
    req.onsuccess=()=>{
      try{
        const rows=ppValidateRecords(req.result.filter(r=>r.key.startsWith(PP_PREFIX)));
        const wallet=rows.find(r=>r.type==='wallet'&&r.id===walletId);if(!wallet)throw new Error('선불권을 찾을 수 없어요.');
        const orig=ppTotals(rows,walletId).active.find(e=>e.id===origId);
        if(!orig)throw new Error('이미 취소되었거나 찾을 수 없는 기록이에요.');
        if(orig.paid||orig.receiptId)throw new Error('결제 영수증이 연결된 기록은 수정할 수 없어요. 삭제한 뒤 다시 등록해 주세요.');
        const now=nowISO();
        const voidEv={key:PP_PREFIX+'void_'+orig.id,id:'void_'+orig.id,type:'event',walletId,kind:'void',date:_todayYMD(),amount:orig.amount,paid:0,description:'수정',receiptId:'',reverses:orig.id,createdAt:now};
        ppValidateRecords([voidEv]);
        const rows2=rows.concat([voidEv]);
        const {event,cash}=ppBuildEvent(rows2,wallet,{id:'event_'+crypto.randomUUID(),kind:orig.kind,date:values.date,amount:values.amount,paid:0,description:String(values.description||'').trim(),receiptId:'',createdAt:orig.createdAt||now},null);
        if(cash)throw new Error('수정할 수 없는 기록이에요.');
        if(ppTotals(rows2.concat([event]),walletId).balance<0)throw new Error('이미 사용한 잔액이 있어 이 금액으로 바꿀 수 없어요.');
        ppValidateRecords([event]);
        settings.add(voidEv);settings.add(event);
      }catch(e){failure=e;tx.abort();}
    };
  });
  await ppLoad();await loadAll();renderDetail();renderPrepaid();if(typeof renderSide==='function'&&document.getElementById('viewPrepaid')?.classList.contains('on'))renderSide();
  void dbxSyncUpload();
}
// v4.25 — 기록 창: 줄을 누르면 열린다. 보기 → [수정](같은 창이 입력칸 + [취소][저장]) / [삭제](같은 창에서 잔액 변화 확인 + [취소][삭제하기]).
function ppRecordSheet(walletId,evId){
  if(typeof _mtgSheetOpen!=='function')return;
  const {card,close}=_mtgSheetOpen();card.classList.add('ppx-rs');
  const esc=escapeHtml,money=n=>fmtMoney(n)+'원';
  let mode='view';
  const paint=()=>{
    const t=ppTotals(prepaidRecords,walletId),e=t.active.find(x=>x.id===evId);
    if(!e){close();return;}
    const p=ppIsPlus(e),sign=p?'+':'−';
    let run=0,after=0;for(const x of t.active.slice().sort(ppEventOrder)){run+=(ppIsPlus(x)?1:-1)*x.amount;if(x.id===e.id){after=run;break;}}
    const editable=!e.paid&&!e.receiptId;
    const title=mode==='edit'?'기록 수정':mode==='del'?'기록 삭제':`<span class="ppx-kind${p?' k-plus':''}">${PP_LABELS[e.kind]}</span>`;
    const hd=`<div class="mtg-sheet-hd"><div class="mtg-sheet-title">${title}</div><button class="mtg-sheet-x" id="ppRsX" type="button" aria-label="닫기">×</button></div>`;
    if(mode==='view'){
      card.innerHTML=hd+`<div class="ppx-rs-amt${p?' pos':''}">${sign}${money(e.amount)}</div>`
        +`<div class="ppx-rs-rows"><div><span>날짜</span><b>${ppDayFull(e.date)}</b></div><div><span>내용</span><b>${esc(ppEventDesc(e))}</b></div>`
        +(e.paid?`<div><span>${e.kind==='refund'?'실제 환불액':'실제 결제액'}</span><b>${money(e.paid)}</b></div>`:'')
        +`<div><span>${p?'충전 후 잔액':'이후 잔액'}</span><b>${money(after)}</b></div></div>`
        +(e.receiptId?`<button type="button" class="ppx-rs-link" id="ppRsRcpt">연결된 영수증 보기</button>`:'')
        +(editable?'':`<p class="ppx-rs-note">결제 영수증이 연결된 기록은 수정할 수 없어요. 삭제한 뒤 다시 등록해 주세요.</p>`)
        +`<div class="ppx-rs-btns"><button type="button" class="ppx-btn" id="ppRsEdit"${editable?'':' disabled'}>수정</button><button type="button" class="ppx-btn danger" id="ppRsDel">삭제</button></div>`;
      card.querySelector('#ppRsEdit').onclick=()=>{mode='edit';paint();};
      card.querySelector('#ppRsDel').onclick=()=>{mode='del';paint();};
      const rc=card.querySelector('#ppRsRcpt');
      if(rc)rc.onclick=()=>{if(!receipts.some(r=>r.id===e.receiptId)){toast('연결된 영수증을 찾을 수 없어요.',{type:'warning'});return;}close(()=>selectReceipt(e.receiptId));};
    }else if(mode==='edit'){
      card.innerHTML=hd+`<form class="ppx-rs-form" id="ppRsForm" novalidate>`
        +`<label><span>날짜</span><input name="date" type="date" value="${esc(e.date)}" required></label>`
        +`<label><span>내용</span><input name="description" type="text" maxlength="200" value="${esc(e.description||'')}" placeholder="${e.kind==='use'?'예: 커트':esc(PP_LABELS[e.kind])}"></label>`
        +`<label><span>금액</span><input name="amount" type="text" inputmode="numeric" value="${fmtMoney(e.amount)}" required></label>`
        +`<p class="pp-error" role="alert"></p><div class="ppx-rs-btns"><button type="button" class="ppx-btn" id="ppRsCancel">취소</button><button type="submit" class="ppx-btn primary">저장</button></div></form>`;
      const f=card.querySelector('#ppRsForm'),amt=f.querySelector('[name=amount]'),err=f.querySelector('.pp-error');
      amt.addEventListener('input',()=>{const raw=amt.value.replace(/[^0-9]/g,'');amt.value=raw?Number(raw).toLocaleString('ko-KR'):'';});
      card.querySelector('#ppRsCancel').onclick=()=>{mode='view';paint();};
      f.addEventListener('submit',async ev=>{
        ev.preventDefault();const btn=f.querySelector('[type=submit]');if(btn.disabled)return;btn.disabled=true;err.textContent='';
        try{
          const amount=ppMoney(amt.value||'0');if(amount<=0)throw new Error('금액을 입력해 주세요.');
          await ppCommitEdit(walletId,e.id,{date:f.querySelector('[name=date]').value,description:f.querySelector('[name=description]').value,amount});
          close(()=>toast('수정했어요.',{type:'success'}));
        }catch(x){err.textContent=x.message;btn.disabled=false;}
      });
    }else{
      const nb=t.balance-(p?e.amount:-e.amount);
      card.innerHTML=hd+`<div class="ppx-rs-amt${p?' pos':''}">${sign}${money(e.amount)}</div><div class="ppx-rs-sub">${ppDayLabel(e.date)} · ${esc(ppEventDesc(e))}</div>`
        +`<div class="ppx-rs-warn">이 기록을 삭제할까요?<br>잔액이 <b>${money(t.balance)} → ${money(nb)}</b>${nb<t.balance?'으로 줄어요':'으로 돌아가요'}.${e.paid?'<br>결제 기록이 있어 반대 금액의 정정 영수증이 추가돼요.':''}</div>`
        +`<p class="pp-error" role="alert">${nb<0?'이미 사용한 잔액이 있어 삭제할 수 없어요.':''}</p>`
        +`<div class="ppx-rs-btns"><button type="button" class="ppx-btn" id="ppRsCancel">취소</button><button type="button" class="ppx-btn danger-solid" id="ppRsDo"${nb<0?' disabled':''}>삭제하기</button></div>`;
      card.querySelector('#ppRsCancel').onclick=()=>{mode='view';paint();};
      card.querySelector('#ppRsDo').onclick=async()=>{
        const btn=card.querySelector('#ppRsDo'),err=card.querySelector('.pp-error');if(btn.disabled)return;btn.disabled=true;
        try{await ppCommit(null,{walletId,kind:'void',reverses:e.id,date:_todayYMD(),amount:0,paid:0,createdAt:nowISO(),description:'삭제'});close(()=>toast('기록을 삭제했어요.'));}
        catch(x){err.textContent=x.message;btn.disabled=false;}
      };
    }
    card.querySelector('#ppRsX').onclick=close;
  };
  paint();
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
    ppOpenRecorded(id); // v4.29 — 등록 뒤 ‹ 멤버십이 이전 탭으로 가지 않게
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

/* ═══ v4.29 — 멤버십: 구독(매달·매년 결제) ═══
   선불권과 같은 탭([구독 | 선불권]). 구독 정보는 settings store의 'sub:' 기록(type sub = 구독, skip = 건너뛴 결제),
   실제 지출은 결제일이 지나면 사용자가 확인해 등록하는 영수증이다(subId·subPeriod). 영수증 ID는 구독·기간으로 정해져
   (rec_sub_<구독>_<기간>) 두 기기가 같은 결제를 등록해도 동기화 때 한 건으로 합쳐진다. 저절로 등록하지 않는다
   (요금이 바뀌거나 해지·쉬는 달에 틀린 영수증이 생기므로). */
const SB_PREFIX='sub:';
const SB_PAY=[['card','카드'],['cash','현금'],['transfer','계좌이체'],['other','기타']];
const SB_DEFAULT_CAT='영화'; // 화면 이름 '문화'(사용자 지정)
let subRecords=[];
let sbLastSel=null;
let ppSeg=(()=>{try{return localStorage.getItem('ppSeg')||'';}catch(_){return '';}})();
function sbSetSeg(s){ppSeg=s;try{localStorage.setItem('ppSeg',s);}catch(_){}}
function sbSubs(){return subRecords.filter(r=>r.type==='sub'&&!r.deleted);}
function sbCurSeg(){if(ppSeg==='sub'||ppSeg==='pp')return ppSeg;return (sbSubs().length||!ppWallets().length)?'sub':'pp';}
function sbValidOne(r){
  if(!r||typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(r.id)||r.key!==SB_PREFIX+r.id)return null;
  try{
    if(r.type==='sub'){
      const name=String(r.name||'').trim().slice(0,200);if(!name)return null;
      return {key:r.key,id:r.id,type:'sub',name,amount:ppMoney(r.amount),cycle:r.cycle==='year'?'year':'month',startOn:ppDate(r.startOn),endedOn:ppDate(r.endedOn||'',true),
        category:String(r.category||SB_DEFAULT_CAT).slice(0,100),payMethod:SB_PAY.some(p=>p[0]===r.payMethod)?r.payMethod:'card',payDetail:String(r.payDetail||'').slice(0,100),
        deleted:r.deleted===true,createdAt:String(r.createdAt||''),updatedAt:String(r.updatedAt||'')};
    }
    if(r.type==='skip'&&typeof r.subId==='string'&&/^\d{4}(-\d{2})?$/.test(String(r.period||'')))return {key:r.key,id:r.id,type:'skip',subId:r.subId,period:r.period,createdAt:String(r.createdAt||'')};
  }catch(_){}
  return null;
}
// 한 줄이 잘못돼도 나머지는 살린다(동기화·복원이 통째로 멈추지 않게).
function sbValidate(rows){return Array.isArray(rows)?rows.slice(0,20000).map(sbValidOne).filter(Boolean):[];}
async function sbExport(){return (await dbAll('settings')).filter(r=>typeof r.key==='string'&&r.key.startsWith(SB_PREFIX));}
async function sbLoad(){subRecords=sbValidate(await sbExport());}
async function sbMerge(rows){
  const incoming=sbValidate(rows);if(!incoming.length)return 0;
  const db=await openDB();
  const changed=await new Promise((resolve,reject)=>{
    const tx=db.transaction('settings','readwrite'),store=tx.objectStore('settings');let count=0;
    tx.oncomplete=()=>resolve(count);tx.onabort=()=>reject(tx.error||new Error('구독 병합 실패'));
    for(const row of incoming){
      const req=store.get(row.key);
      req.onsuccess=()=>{const local=req.result;if(!local||(row.type==='sub'&&row.updatedAt>String(local.updatedAt||''))){store.put(row);count++;}};
    }
  });
  await sbLoad();
  if(changed&&document.getElementById('viewPrepaid')?.classList.contains('on')){renderPrepaid();if(typeof renderSide==='function')renderSide();}
  return changed;
}
async function sbPut(rows){
  const db=await openDB();
  await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('저장하지 못했어요.'));rows.forEach(r=>tx.objectStore('settings').put(r));});
  await sbLoad();
}
async function sbAfterChange(){
  await loadAll();renderDetail();renderPrepaid();
  if(typeof renderSide==='function'&&document.getElementById('viewPrepaid')?.classList.contains('on'))renderSide();
  void dbxSyncUpload();
}
// ── 결제일 계산(표시·집계 규칙, 저장하지 않음). 결제일은 첫 결제일(startOn)의 '일'(매년이면 월·일). 31일은 짧은 달의 말일.
function sbDim(y,m){return new Date(y,m,0).getDate();}
function sbYmd(y,m,d){return y+'-'+String(m).padStart(2,'0')+'-'+String(Math.min(d,sbDim(y,m))).padStart(2,'0');}
function sbPeriodOf(s,iso){return s.cycle==='year'?iso.slice(0,4):iso.slice(0,7);}
function sbBillDate(s,p){const d=+s.startOn.slice(8,10);if(s.cycle==='year')return sbYmd(+p,+s.startOn.slice(5,7),d);const [y,m]=p.split('-').map(Number);return sbYmd(y,m,d);}
function sbNextPeriod(s,p){if(s.cycle==='year')return String(+p+1);let [y,m]=p.split('-').map(Number);if(++m>12){m=1;y++;}return y+'-'+String(m).padStart(2,'0');}
function sbCycleLabel(s){const d=+s.startOn.slice(8,10);return s.cycle==='year'?`매년 ${+s.startOn.slice(5,7)}월 ${d}일`:`매달 ${d}일`;}
function sbPayLabel(s){return s.payDetail||(SB_PAY.find(p=>p[0]===s.payMethod)||['',''])[1];}
function sbPeriodKey(p){return p.replace('-','');}
function sbBaseRid(s,p){return 'rec_sub_'+s.id.replace(/^sub_/,'')+'_'+sbPeriodKey(p);}
function sbDeletedIds(){try{return new Set(JSON.parse(_ls(_K.DELETED_IDS)||'[]'));}catch(_){return new Set();}}
function sbCtx(){
  const rec=new Map();for(const r of receipts)if(r.subId&&r.subPeriod)rec.set(r.subId+'|'+r.subPeriod,r);
  const skips=new Set(subRecords.filter(r=>r.type==='skip').map(r=>r.subId+'|'+r.period));
  return {rec,skips,del:sbDeletedIds(),today:_todayYMD()};
}
// '9월 15일'(올해) / '2025년 11월 2일'(다른 해)
function sbDayShort(iso){const [y,m,d]=iso.split('-').map(Number);return (y===new Date().getFullYear()?'':y+'년 ')+m+'월 '+d+'일';}
function sbDaysTo(iso,today){return Math.round((Date.parse(iso)-Date.parse(today))/86400000);}
// 구독 한 개의 상태: 기간별 결제(paid 등록됨 · skip 건너뜀 · deleted 영수증 지움 · due 확인 대기) + 다음 결제일
function sbState(s,ctx){
  const ended=!!(s.endedOn&&s.endedOn<=ctx.today);
  const upto=s.endedOn&&s.endedOn<ctx.today?s.endedOn:ctx.today;
  const list=[];let p=sbPeriodOf(s,s.startOn);
  for(let i=0;i<600;i++){
    const date=sbBillDate(s,p);if(date>upto)break;
    const k=s.id+'|'+p,r=ctx.rec.get(k)||null;
    list.push({period:p,date,r,st:r?'paid':ctx.skips.has(k)?'skip':ctx.del.has(sbBaseRid(s,p))?'deleted':'due'});
    p=sbNextPeriod(s,p);
  }
  const next=ended?null:{period:p,date:sbBillDate(s,p)};
  if(next&&ctx.rec.has(s.id+'|'+next.period))next.r=ctx.rec.get(s.id+'|'+next.period);
  const pending=list.filter(x=>x.st==='due');
  const year=ctx.today.slice(0,4),paidAll=list.filter(x=>x.r).concat(next&&next.r?[next]:[]);
  const paidYear=paidAll.filter(x=>x.r.date.slice(0,4)===year);
  return {list,next,pending,ended,paidYear:paidYear.reduce((a,x)=>a+(Number(x.r.total)||0),0),paidYearN:paidYear.length,paidN:paidAll.length,
    dday:next?sbDaysTo(next.date,ctx.today):null};
}
function sbYearly(s){return s.cycle==='year'?s.amount:s.amount*12;}
function sbOrdered(ctx=sbCtx()){
  return sbSubs().map(s=>({s,st:sbState(s,ctx)})).sort((a,b)=>(a.st.ended-b.st.ended)||((a.st.next?.date||'9')<(b.st.next?.date||'9')?-1:(a.st.next?.date||'9')>(b.st.next?.date||'9')?1:0)||a.s.name.localeCompare(b.s.name,'ko'));
}
// ── 등록·건너뛰기
async function sbRegister(s,period,amount){
  if(receipts.some(r=>r.subId===s.id&&r.subPeriod===period))throw new Error('이미 영수증으로 등록한 결제예요.');
  const amt=ppMoney(amount??s.amount);if(amt<=0)throw new Error('금액을 입력해 주세요.');
  const base=sbBaseRid(s,period);
  const id=(sbDeletedIds().has(base)||receipts.some(r=>r.id===base))?base+'_'+Math.random().toString(36).slice(2,6):base;
  const now=nowISO(),label=s.cycle==='year'?'연간 구독':'월 구독';
  await dbPut('receipts',{id,date:sbBillDate(s,period),time:'',store:s.name,category:s.category,total:amt,items:[{name:`${s.name} ${label}`,quantity:1,unitPrice:amt,amount:amt}],imageId:'',paymentMethod:s.payMethod,paymentDetail:s.payDetail,paidBy:getMyName(),participants:[],tags:['구독'],notes:'',subId:s.id,subPeriod:period,createdAt:now,updatedAt:now});
  await sbAfterChange();
}
async function sbSkip(s,period){
  const id='skip_'+s.id.replace(/^sub_/,'')+'_'+sbPeriodKey(period);
  await sbPut([{key:SB_PREFIX+id,id,type:'skip',subId:s.id,period,createdAt:nowISO()}]);
  await sbAfterChange();
}
async function sbSaveSub(s,patch){
  const row={...s,...patch,updatedAt:nowISO()};delete row.st;
  if(!sbValidOne(row))throw new Error('구독 정보를 확인해 주세요.');
  await sbPut([row]);await sbAfterChange();
}
// ── 좌측 목록(구독)
function sbAskHtml(x,more){
  const s=x.s,p=x.p;
  return `<div class="sbx-ask" data-sub="${escapeHtml(s.id)}" data-period="${escapeHtml(p.period)}"><div class="sbx-ask-q"><b>${escapeHtml(s.name)} ${fmtMoney(s.amount)}원</b>이 ${sbDayShort(p.date)}에 결제됐나요?</div>`
    +`<div class="sbx-ask-s">등록하면 영수증으로 저장돼 통계에 들어가요${more?` · 확인할 결제 ${more+1}건`:''}</div>`
    +`<div class="sbx-ask-b"><button type="button" class="sbx-ask-skip">건너뛰기</button><button type="button" class="sbx-ask-reg">영수증 등록</button></div></div>`;
}
function sbRowHtml(x,sel){
  const s=x.s,st=x.st,esc=escapeHtml;
  const right=st.ended?`<div class="sbx-row-dd">해지함</div>`:st.pending.length?`<div class="sbx-row-dd due">확인 대기</div>`:st.next?`<div class="sbx-row-dd${st.dday<=7?' soon':''}">${+st.next.date.slice(5,7)}월 ${+st.next.date.slice(8,10)}일 · ${st.dday===0?'오늘':'D-'+st.dday}</div>`:''; // v4.31 — 목록은 연도 없이(D-N이 거리를 알려 준다, 연도까지 넣으면 이름·메타가 밀렸다)
  return `<div class="r-card ppw-row sbx-row${sel?' sel':''}${st.ended?' ended':''}" data-sub="${esc(s.id)}" role="button" tabindex="0"${sel?' aria-current="true"':''}>`
    +`<div class="r-card-info"><div class="r-card-store-row"><span class="r-card-store">${esc(s.name)}</span>${s.cycle==='year'?'<span class="sbx-tag">연간</span>':''}</div><div class="r-card-meta">${esc(sbCycleLabel(s))} · ${esc(sbPayLabel(s))}</div></div>`
    +`<div class="sbx-row-r"><div class="r-card-amt">${fmtMoney(s.amount)}원</div>${right}</div></div>`;
}
function sbRenderSide(){
  const listEl=document.getElementById('sideList');if(!listEl)return;
  const ctx=sbCtx(),all=sbOrdered(ctx);
  const q=(typeof _ppListQ==='string'?_ppListQ:'').trim();
  let view=all;
  if(q){if(typeof _isChoQuery==='function'&&_isChoQuery(q)){const cq=_normChoQuery(q);view=all.filter(x=>_toCho(x.s.name).includes(cq));}else{const qL=q.toLowerCase();view=all.filter(x=>x.s.name.toLowerCase().includes(qL));}}
  const live=all.filter(x=>!x.st.ended),month=live.filter(x=>x.s.cycle==='month').reduce((a,x)=>a+x.s.amount,0),year=live.reduce((a,x)=>a+sbYearly(x.s),0);
  const lt=document.getElementById('ltInfo');
  if(lt)lt.innerHTML=q?`검색 결과 <b>${view.length}개</b>`:live.length?`${month?`매달 <b>${fmtMoney(month)}원</b> · `:''}1년 <b>${fmtMoney(year)}원</b>`:'';
  document.querySelector('.side')?.classList.toggle('sb-empty',!all.length);
  if(!all.length){
    listEl.innerHTML=`<div class="empty-state sbx-deskonly">등록된 구독이 없어요<br/>위의 ‘등록’ 또는 오른쪽 안내에서 추가하세요</div>${sbGuideHtml('sbEmptyNew','sbx-mobonly')}`;
    listEl.querySelector('#sbEmptyNew')?.addEventListener('click',()=>sbForm());return;
  }
  if(!view.length){listEl.innerHTML='<div class="empty-state"><div>검색 결과가 없어요</div></div>';return;}
  const pend=q?[]:all.flatMap(x=>x.st.pending.map(p=>({s:x.s,p}))).sort((a,b)=>a.p.date.localeCompare(b.p.date));
  let html=pend.length?sbAskHtml(pend[0],pend.length-1):'';
  html+='<div class="list-group">';let endedHd=false;
  for(const x of view){
    if(x.st.ended&&!endedHd){html+='</div><div class="sbx-lh">해지한 구독</div><div class="list-group">';endedHd=true;}
    html+=sbRowHtml(x,x.s.id===prepaidSelectedId);
  }
  listEl.innerHTML=html+'</div>';
  listEl.querySelectorAll('.sbx-row').forEach(el=>{const go=()=>ppOpen(el.dataset.sub);el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();go();});});
  const ask=listEl.querySelector('.sbx-ask');
  if(ask){
    const s=sbSubs().find(v=>v.id===ask.dataset.sub),period=ask.dataset.period;
    const run=async(btn,fn,msg)=>{if(btn.disabled)return;ask.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();toast(msg,{type:'success'});}catch(e){toast(e.message,{type:'error'});ask.querySelectorAll('button').forEach(b=>b.disabled=false);}};
    ask.querySelector('.sbx-ask-reg').addEventListener('click',e=>run(e.currentTarget,()=>sbRegister(s,period),'영수증으로 등록했어요.'));
    ask.querySelector('.sbx-ask-skip').addEventListener('click',e=>run(e.currentTarget,()=>sbSkip(s,period),'이번 결제는 건너뛰었어요.'));
  }
}
// v4.30 — 구독이 없을 때 안내(PC 오른쪽 · 폰 목록). 버튼은 하나만(PC 왼쪽은 짧은 글만).
function sbGuideHtml(btnId,cls=''){
  return `<div class="sbx-guide ${cls}"><div class="sbx-guide-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14h3"/></svg></div>`
    +`<h3>구독을 등록해 보세요</h3><p>넷플릭스·유튜브처럼 매달·매년 나가는 돈을 한 번 등록하면 <br/>결제일마다 ‘결제됐나요?’로 물어보고, 누르면 영수증으로 남겨요.</p>`
    +`<div class="sbx-steps"><span>① 이름·금액·결제일</span><span>② 결제일에 확인</span><span>③ 통계에 반영</span></div>`
    +`<button class="sbx-cta" type="button" id="${btnId}">${PP_ICO.charge}구독 등록</button></div>`;
}
// ── 오른쪽 상세(구독)
const SB_ICO={
  reg:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 9h6M12 6v6"/></svg>',
  stop:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></svg>',
  play:'<svg class="pp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>'
};
function sbRenderDetail(root,s){
  const esc=escapeHtml,money=n=>fmtMoney(n)+'원',ctx=sbCtx(),st=sbState(s,ctx);
  const [sy,sm]=s.startOn.split('-');
  const nextTxt=st.ended?`해지함 · ${ppDayFull(s.endedOn).replace(/요일$/,'')}`:st.pending.length?`<b class="due">확인할 결제 ${st.pending.length}건</b>`:st.next?`다음 결제 <b>${sbDayShort(st.next.date)} · ${st.dday===0?'오늘':'D-'+st.dday}</b>`:'';
  const card=`<div class="sbx-card${st.ended?' ended':''}"><div class="sbx-card-top"><span>${esc(sbCycleLabel(s))} · ${esc(sbPayLabel(s))}</span><span>${sy}년 ${+sm}월부터</span></div>`
    +`<div class="sbx-card-amt">${fmtMoney(s.amount)}<small>원</small></div><div class="sbx-card-next">${nextTxt}</div>`
    +`<div class="sbx-card-foot"><span>올해 낸 돈 ${money(st.paidYear)} · ${st.paidYearN}번</span><span>${s.cycle==='year'?'한 달에 약 '+money(Math.round(s.amount/12)):'1년이면 '+money(s.amount*12)}</span></div></div>`;
  const tile=(attrs,ico,label,cls)=>`<button type="button" class="ppx-tile${cls||''}" ${attrs}><i>${ico}</i><span>${label}</span></button>`;
  const tiles=`<div class="ppx-tiles">${tile('data-sbact="reg"',SB_ICO.reg,'결제 등록',st.ended&&!st.pending.length?'':' primary')}${tile('data-sbact="edit"',PP_ICO.edit,'정보 수정')}`
    +`${st.ended||s.endedOn?tile('data-sbact="resume"',SB_ICO.play,'다시 구독'):tile('data-sbact="end"',SB_ICO.stop,'해지')}${tile('data-sbact="del"',PP_ICO.trash,'삭제')}</div>`;
  const rows=st.list.slice().reverse();
  if(st.next&&!st.ended)rows.unshift({...st.next,st:st.next.r?'paid':'next'});
  let hist='',lastY='';
  const stTxt={paid:'영수증 등록됨',skip:'건너뜀',deleted:'영수증 지움',due:'확인 대기',next:'결제 예정'};
  for(const x of rows){
    const y=x.date.slice(0,4);if(y!==lastY){hist+=`<div class="ppx-mh">${y}년</div>`;lastY=y;}
    const amt=x.r?money(Number(x.r.total)||0):x.st==='skip'||x.st==='deleted'?'—':money(s.amount);
    hist+=`<button type="button" class="ppx-row sbx-hrow st-${x.st}" data-sbp="${esc(x.period)}"><span class="ppx-row-l"><span class="ppx-row-n">${ppDayLabel(x.date)}</span><span class="ppx-row-d sbx-st">${stTxt[x.st]}</span></span><span class="ppx-row-a">${amt}</span></button>`;
  }
  root.innerHTML=`<div class="pp-detail ppx sbx">${card}${tiles}<div class="ppx-hist"><div class="sbx-hh">결제 기록<span>${st.paidN}번 등록</span></div>${hist||'<div class="empty-state">아직 결제일이 오지 않았어요.</div>'}</div></div>`;
  root.querySelectorAll('[data-sbact]').forEach(b=>b.addEventListener('click',async()=>{
    const a=b.dataset.sbact;
    if(a==='edit')return sbForm(s);
    if(a==='reg'){const p=st.pending[0]||(st.next&&!st.next.r?st.next:null);if(!p){toast('등록할 결제가 없어요.');return;}return sbAskSheet(s,p.period);}
    if(a==='end'){if(await sbConfirm(`${s.name} 해지`,`오늘(${ppDayLabel(_todayYMD())})부터 결제 확인을 멈춰요.<br>지금까지 등록한 영수증은 그대로 남아요.`,'해지하기')){await sbSaveSub(s,{endedOn:_todayYMD()});toast('해지했어요.');}return;}
    if(a==='resume'){await sbSaveSub(s,{endedOn:''});toast('다시 구독으로 바꿨어요.');return;}
    if(a==='del'){if(await sbConfirm(`${s.name} 삭제`,'구독 정보를 지워요.<br>이미 등록한 영수증은 내역에 그대로 남아요.','삭제하기',true)){await sbSaveSub(s,{deleted:true});prepaidSelectedId=null;sbLastSel=null;renderPrepaid();if(typeof renderSide==='function')renderSide();if(typeof _syncMobileSurface==='function')_syncMobileSurface();toast('구독을 삭제했어요.');}}
  }));
  root.querySelectorAll('.sbx-hrow').forEach(b=>b.addEventListener('click',()=>{
    const p=b.dataset.sbp,r=receipts.find(x=>x.subId===s.id&&x.subPeriod===p);
    if(r)selectReceipt(r.id);else sbAskSheet(s,p);
  }));
}
// 결제 확인 창(.mtg-sheet 틀): 금액은 이번 결제만 바꿀 수 있다(요금이 오른 달 등).
function sbAskSheet(s,period){
  if(typeof _mtgSheetOpen!=='function')return;
  const {card,close}=_mtgSheetOpen();card.classList.add('ppx-rs');
  const date=sbBillDate(s,period),today=_todayYMD(),ctx=sbCtx(),k=s.id+'|'+period;
  const skipped=ctx.skips.has(k)||ctx.del.has(sbBaseRid(s,period));
  card.innerHTML=`<div class="mtg-sheet-hd"><div class="mtg-sheet-title">${escapeHtml(s.name)}</div><button class="mtg-sheet-x" type="button" aria-label="닫기">×</button></div>`
    +`<div class="ppx-rs-sub">${ppDayFull(date)} 결제${date>today?' 예정':''}</div>`
    +`<form class="ppx-rs-form" novalidate><label><span>금액</span><input name="amount" type="text" inputmode="numeric" value="${fmtMoney(s.amount)}"></label>`
    +`<p class="ppx-rs-note">${date>today?'아직 결제일 전이에요. 미리 등록할 수 있어요.':skipped?'건너뛴 결제예요. 등록하면 영수증으로 저장돼요.':'등록하면 영수증으로 저장돼 통계에 들어가요.'} 금액은 이번 결제에만 적용돼요.</p>`
    +`<p class="pp-error" role="alert"></p><div class="ppx-rs-btns"><button type="button" class="ppx-btn sbx-skip">${skipped||date>today?'닫기':'건너뛰기'}</button><button type="submit" class="ppx-btn primary">영수증 등록</button></div></form>`;
  const f=card.querySelector('form'),amt=f.querySelector('[name=amount]'),err=f.querySelector('.pp-error');
  amt.addEventListener('input',()=>{const raw=amt.value.replace(/[^0-9]/g,'');amt.value=raw?Number(raw).toLocaleString('ko-KR'):'';});
  card.querySelector('.mtg-sheet-x').onclick=close;
  f.querySelector('.sbx-skip').onclick=async e=>{
    if(skipped||date>today){close();return;}
    e.currentTarget.disabled=true;try{await sbSkip(s,period);close(()=>toast('이번 결제는 건너뛰었어요.'));}catch(x){err.textContent=x.message;e.currentTarget.disabled=false;}
  };
  f.addEventListener('submit',async ev=>{
    ev.preventDefault();const btn=f.querySelector('[type=submit]');if(btn.disabled)return;btn.disabled=true;err.textContent='';
    try{await sbRegister(s,period,amt.value||'0');close(()=>toast('영수증으로 등록했어요.',{type:'success'}));}catch(x){err.textContent=x.message;btn.disabled=false;}
  });
}
function sbConfirm(title,msg,ok,danger){
  return new Promise(res=>{
    if(typeof _mtgSheetOpen!=='function'){res(false);return;}
    let done=false;const fin=v=>{if(done)return;done=true;res(v);};
    const {bd,card,close}=_mtgSheetOpen();card.classList.add('ppx-rs');
    card.innerHTML=`<div class="mtg-sheet-hd"><div class="mtg-sheet-title">${escapeHtml(title)}</div><button class="mtg-sheet-x" type="button" aria-label="닫기">×</button></div><div class="ppx-rs-warn${danger?'':' sbx-info'}">${msg}</div><div class="ppx-rs-btns"><button type="button" class="ppx-btn sbx-no">취소</button><button type="button" class="ppx-btn ${danger?'danger-solid':'primary'} sbx-yes">${escapeHtml(ok)}</button></div>`;
    card.querySelector('.mtg-sheet-x').onclick=()=>{fin(false);close();};
    card.querySelector('.sbx-no').onclick=()=>{fin(false);close();};
    card.querySelector('.sbx-yes').onclick=()=>{fin(true);close();};
    new MutationObserver(()=>{if(!bd.isConnected)fin(false);}).observe(document.body,{childList:true});
  });
}
// 구독 등록·수정 창. 결제일 하나로 주기의 날짜(매달 N일 / 매년 M월 N일)와 기록 시작을 함께 정한다.
function sbForm(sub=null){
  const esc=escapeHtml,today=_todayYMD();
  const dialog=ppDialog(sub?'구독 정보 수정':'구독 등록',
    `<label>이름<input name="name" required maxlength="200" value="${esc(sub?.name||'')}" placeholder="예: 넷플릭스"></label>`
    +`<div class="pp-price-grid"><label>금액<input name="amount" type="text" inputmode="numeric" data-money required value="${sub?.amount||''}" placeholder="예: 17,000"></label><label>주기<select name="cycle"><option value="month"${sub?.cycle!=='year'?' selected':''}>매달</option><option value="year"${sub?.cycle==='year'?' selected':''}>매년</option></select></label></div>`
    +`<label>결제일 (가장 최근 결제일 또는 첫 결제일)<input name="startOn" type="date" required value="${esc(sub?.startOn||today)}"></label><p class="pp-calc sbx-calc" aria-live="polite"></p>`
    +`<label>카테고리<select name="category">${BASE_CATEGORIES.map(c=>`<option value="${esc(c)}"${c===(sub?.category||SB_DEFAULT_CAT)?' selected':''}>${esc(getCategoryLabel(c))}</option>`).join('')}</select></label>`
    +`<div class="pp-price-grid sbx-pay"><label>결제수단<select name="payMethod">${SB_PAY.map(([v,l])=>`<option value="${v}"${v===(sub?.payMethod||'card')?' selected':''}>${l}</option>`).join('')}</select></label><label>카드·계좌 이름 (선택)<input name="payDetail" maxlength="100" value="${esc(sub?.payDetail||'')}" placeholder="예: 현대카드"></label></div>`,
    async form=>{
      const now=nowISO(),id=sub?.id||'sub_'+crypto.randomUUID();
      const row={key:SB_PREFIX+id,id,type:'sub',name:String(form.get('name')||'').trim(),amount:ppMoney(form.get('amount')||0),cycle:form.get('cycle')==='year'?'year':'month',startOn:ppDate(form.get('startOn')),
        endedOn:sub?.endedOn||'',category:String(form.get('category')||SB_DEFAULT_CAT),payMethod:String(form.get('payMethod')||'card'),payDetail:String(form.get('payDetail')||'').trim(),deleted:false,createdAt:sub?.createdAt||now,updatedAt:now};
      if(!row.name)throw new Error('이름을 입력해 주세요.');
      if(row.amount<=0)throw new Error('금액을 입력해 주세요.');
      if(!sbValidOne(row))throw new Error('구독 정보를 확인해 주세요.');
      await sbPut([row]);sbSetSeg('sub');await sbAfterChange();
      ppOpenRecorded(id);
    });
  const cyc=dialog.querySelector('[name=cycle]'),so=dialog.querySelector('[name=startOn]'),calc=dialog.querySelector('.sbx-calc');
  const upd=()=>{
    const v=so.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){calc.textContent='';return;}
    const tmp={startOn:v,cycle:cyc.value};
    calc.textContent=`${sbCycleLabel(tmp)} 결제 · ${v<=today?`${sbDayShort(v)} 결제부터 영수증 등록을 물어봐요`:`${sbDayShort(v)}에 첫 결제`}`;
  };
  cyc.addEventListener('change',upd);so.addEventListener('input',upd);so.addEventListener('change',upd);upd();
}
