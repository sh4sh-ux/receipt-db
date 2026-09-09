/* Prepaid balances are separate from receipts; only cash payments create expenses. */
let prepaidRecords=[];
let prepaidSelectedId=null;
const PP_PREFIX='prepaid:';
const PP_KINDS=['charge','use','refund','expire','opening','void'];
const PP_LABELS={charge:'충전',use:'사용',refund:'환불',expire:'만료 차감',opening:'기초 잔액',void:'입력 취소'};

function ppMoney(value){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0||n>1000000000000)throw new Error('금액은 0 이상의 정수로 입력해 주세요.');
  return n;
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
      return {key:r.key,id:r.id,type:r.type,name:r.name.trim(),category:String(r.category||'기타').slice(0,100),expiresOn:ppDate(r.expiresOn,true),updatedAt:String(r.updatedAt||''),createdAt:String(r.createdAt||'')};
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
  if(document.getElementById('viewPrepaid')?.classList.contains('on'))renderPrepaid();
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
    const last=totals.active.slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).pop();
    if(last?.id!==original.id)throw new Error('가장 최근 기록부터 취소해 주세요.');
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
  await ppLoad();await loadAll();renderDetail();renderPrepaid();
  void dbxSyncUpload();
}

function ppWallets(){return prepaidRecords.filter(r=>r.type==='wallet');}
function ppOpen(id){prepaidSelectedId=id;renderPrepaid();}
function renderPrepaid(){
  const root=document.getElementById('prepaidBody');if(!root)return;
  const wallets=ppWallets(),wallet=wallets.find(w=>w.id===prepaidSelectedId);
  const money=n=>fmtMoney(n)+'원',esc=escapeHtml;
  document.getElementById('prepaidTitle').textContent=wallet?wallet.name:'선불권·충전금';
  document.getElementById('prepaidNew').hidden=!!wallet;
  document.getElementById('prepaidBack').hidden=!wallet;
  if(!wallet){
    root.innerHTML=`<div class="pp-summary"><span>총 남은 잔액</span><strong>${money(wallets.reduce((s,w)=>s+ppTotals(prepaidRecords,w.id).balance,0))}</strong><small>${wallets.length}개 선불권</small></div><div class="pp-wallets">${wallets.map(w=>{
      const t=ppTotals(prepaidRecords,w.id),expired=w.expiresOn&&w.expiresOn<_todayYMD();
      return `<button class="pp-wallet" type="button" data-wallet="${esc(w.id)}">${getCatSvg(w.category)}<span><b>${esc(w.name)}</b><small>${expired?'유효기간 지남':w.expiresOn?'유효기간 '+esc(w.expiresOn):'유효기간 없음'}</small></span><strong>${money(t.balance)}</strong><span aria-hidden="true">›</span></button>`;
    }).join('')}</div>${!wallets.length?'<div class="empty-state">등록된 선불권이 없어요.</div>':''}`;
    root.querySelectorAll('[data-wallet]').forEach(b=>b.addEventListener('click',()=>ppOpen(b.dataset.wallet)));return;
  }
  const t=ppTotals(prepaidRecords,wallet.id),expired=wallet.expiresOn&&wallet.expiresOn<_todayYMD();
  const last=t.active.slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).pop();
  root.innerHTML=`<div class="pp-summary"><span>남은 잔액</span><strong>${money(t.balance)}</strong><small>${expired?'유효기간 지남 · ':''}${wallet.expiresOn?'유효기간 '+esc(wallet.expiresOn):'유효기간 없음'}</small></div>
    ${t.balance<0?'<p class="alert err">동기화된 사용 기록이 잔액을 초과했어요. 최근 기록을 확인해 주세요.</p>':''}
    <div class="pp-metrics"><span>실결제 누계 <b>${money(t.paid)}</b></span><span>사용 누계 <b>${money(t.used)}</b></span></div>
    <div class="pp-actions"><button class="primary-btn" data-kind="use">사용 기록</button><button class="ghost-btn" data-kind="charge">충전</button><button class="ghost-btn" data-kind="refund">환불</button><button class="ghost-btn" data-kind="expire">만료 차감</button><button class="ghost-btn" id="ppEdit">정보 수정</button></div>
    <h3 class="pp-section-title">충전·사용 내역 <span>${t.events.length}건</span></h3><div class="pp-events">${t.events.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).map(e=>{
      const cancelled=t.voided.has(e.id),positive=e.kind==='charge'||e.kind==='opening';
      return `<div class="pp-event${cancelled?' pp-voided':''}"><div><b>${PP_LABELS[e.kind]}${cancelled?' · 취소됨':''}</b><small>${esc(e.date)}${e.description?' · '+esc(e.description):''}</small>${e.paid?`<small>실결제 ${money(e.paid)}</small>`:''}</div><strong>${e.kind==='void'?'':positive?'+':'−'}${money(e.amount)}</strong><div class="pp-row-actions">${e.receiptId?`<button class="ghost-btn" data-receipt="${esc(e.receiptId)}">영수증</button>`:''}${e.id===last?.id?`<button class="ghost-btn" data-void="${esc(e.id)}">입력 취소</button>`:''}</div></div>`;
    }).join('')||'<div class="empty-state">충전 또는 사용 기록이 없어요.</div>'}</div>`;
  root.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>ppEventForm(b.dataset.kind)));
  root.querySelector('#ppEdit').addEventListener('click',()=>ppWalletForm(wallet));
  root.querySelectorAll('[data-receipt]').forEach(b=>b.addEventListener('click',()=>{
    if(!receipts.some(r=>r.id===b.dataset.receipt)){toast('연결된 영수증을 찾을 수 없어요.',{type:'warning'});return;}
    selectReceipt(b.dataset.receipt);
  }));
  root.querySelectorAll('[data-void]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('최근 입력을 취소할까요? 결제 기록이 있으면 반대 금액의 정정 영수증이 추가됩니다.'))return;
    b.disabled=true;
    try{await ppCommit(null,{walletId:wallet.id,kind:'void',reverses:b.dataset.void,date:_todayYMD(),amount:0,paid:0,createdAt:nowISO(),description:'입력 취소'});toast('입력을 취소했어요.');}
    catch(e){b.disabled=false;toast(e.message,{type:'error'});}
  }));
}

function ppDialog(title,html,onSave){
  const dialog=document.createElement('dialog');dialog.className='pp-dialog';
  dialog.innerHTML=`<form><div class="pp-dialog-head"><h2>${escapeHtml(title)}</h2><button type="button" class="icon-btn" aria-label="닫기">×</button></div>${html}<p class="pp-error" role="alert"></p><div class="pp-dialog-actions"><button type="button" class="ghost-btn pp-cancel">취소</button><button type="submit" class="primary-btn">저장</button></div></form>`;
  document.body.append(dialog);
  dialog.querySelector('.icon-btn').onclick=()=>dialog.close();dialog.querySelector('.pp-cancel').onclick=()=>dialog.close();
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
  ppDialog(wallet?'선불권 정보 수정':'선불권 등록',`<label>매장명<input name="name" required maxlength="200" value="${esc(wallet?.name||'')}" placeholder="예: 단골 미용실"></label><label>카테고리<select name="category">${BASE_CATEGORIES.map(c=>`<option value="${esc(c)}"${c===(wallet?.category||'스파')?' selected':''}>${esc(getCategoryLabel(c))}</option>`).join('')}</select></label><label>유효기간 (선택)<input name="expiresOn" type="date" value="${esc(wallet?.expiresOn||'')}"></label>${wallet?'':'<label>기존 남은 잔액 (지출 제외)<input name="opening" type="number" min="0" step="1" value="0" required inputmode="numeric"></label>'}`,async form=>{
    const now=nowISO(),id=wallet?.id||'wallet_'+crypto.randomUUID();
    const row={key:PP_PREFIX+id,id,type:'wallet',name:String(form.get('name')).trim(),category:form.get('category'),expiresOn:form.get('expiresOn'),createdAt:wallet?.createdAt||now,updatedAt:now};
    const amount=wallet?0:ppMoney(form.get('opening'));
    await ppCommit(row,amount?{id:'event_'+crypto.randomUUID(),kind:'opening',date:_todayYMD(),amount,paid:0,createdAt:now,description:'등록 시 잔액'}:null);
    ppOpen(id);
  });
}
function ppEventForm(kind){
  const wallet=ppWallets().find(w=>w.id===prepaidSelectedId);if(!wallet)return;
  const t=ppTotals(prepaidRecords,wallet.id),esc=escapeHtml;
  const linked=new Set(prepaidRecords.filter(e=>e.type==='event'&&e.kind==='charge').map(e=>e.receiptId));
  const options=receipts.filter(r=>r.total>0&&!linked.has(r.id)&&!r.prepaidEventId);
  const cash=kind==='charge'||kind==='refund';
  const dialog=ppDialog(PP_LABELS[kind],`<label>날짜<input name="date" type="date" value="${_todayYMD()}" required></label><label>${kind==='charge'?'충전액 (보너스 포함)':'잔액 차감액'}<input name="amount" type="number" min="1" step="1" ${kind!=='charge'?`max="${Math.max(0,t.balance)}"`:''} value="${kind==='expire'?Math.max(0,t.balance):''}" required inputmode="numeric"></label>${cash?`<label>${kind==='charge'?'실제 결제액 (지출 반영)':'실제 환불액 (지출 차감)'}<input name="paid" type="number" min="0" step="1" required inputmode="numeric"></label><label>결제수단<select name="paymentMethod"><option>카드</option><option>현금</option><option>계좌이체</option><option>기타</option></select></label>`:''}${kind==='charge'?`<label>결제 기록<select name="receiptId"><option value="">새 영수증 등록</option>${options.map(r=>`<option value="${esc(r.id)}">기존 연결 · ${esc(r.date)} · ${esc(r.store)} · ${fmtMoney(r.total)}원</option>`).join('')}</select></label>`:''}<label>${kind==='use'?'시술명·사용 내용':'메모'}<input name="description" maxlength="1000" ${kind==='use'?'required':''} placeholder="${kind==='use'?'예: 커트, 염색':''}"></label>`,async form=>{
    await ppCommit(null,{walletId:wallet.id,id:'event_'+crypto.randomUUID(),kind,date:form.get('date'),amount:ppMoney(form.get('amount')),paid:cash?ppMoney(form.get('paid')):0,paymentMethod:form.get('paymentMethod'),receiptId:form.get('receiptId')||'',description:form.get('description'),createdAt:nowISO()});
  });
  dialog.querySelector('[name=receiptId]')?.addEventListener('change',e=>{
    const rec=receipts.find(r=>r.id===e.target.value);if(!rec)return;
    dialog.querySelector('[name=paid]').value=rec.total;
    dialog.querySelector('[name=date]').value=rec.date;
  });
}
