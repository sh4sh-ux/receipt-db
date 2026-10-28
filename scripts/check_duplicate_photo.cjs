#!/usr/bin/env node
const {chromium}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const port=4177;
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return;}
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  });
});

(async()=>{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--disable-crash-reporter','--disable-crashpad','--noerrdialogs']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
      await new Promise(resolve=>setTimeout(resolve,80));
      await dbClear('receipts');await dbClear('images');
      const now=nowISO();
      const source={id:'rec_20261006_001_test',date:'2026-10-06',time:'22:13',store:'축제 노래연습장',category:'노래방',total:44000,items:[],imageId:'img_20261006_001_test',imageHash:'source-hash',scanPath:'/완료 JPG/2026-10/2026.10.06_44000_축제 노래연습장.jpg',participants:['신유철','조상현'],paidBy:'조상현',tags:[],notes:'',createdAt:now,updatedAt:now};
      await dbPut('receipts',source);
      await dbPut('images',{id:source.imageId,blob:new Blob(['source-photo'],{type:'image/jpeg'}),mime:'image/jpeg',contentHash:'source-hash'});
      await loadAll();selectedId=source.id;renderSide();renderDetail();
      let recoveryCalls=0;
      const originalDownload=_dbxDownloadImage,originalConnected=dbxIsConnected,originalSync=dbxSyncNow;
      _dbxDownloadImage=async()=>{recoveryCalls++;return 'blob:wrong-photo';};
      dbxIsConnected=()=>true;dbxSyncNow=()=>{};
      await _duplicateReceipt(source);
      const copy=receipts.find(r=>r.id!==source.id);
      const recovery=copy?await _ensureReceiptImgUrl(copy):'missing-copy';
      const storedSource=await dbGet('receipts',source.id);
      const sourceImage=await dbGet('images',source.imageId);
      _dbxDownloadImage=originalDownload;dbxIsConnected=originalConnected;dbxSyncNow=originalSync;
      return {
        copyExists:!!copy,
        copyImageId:copy?.imageId||'',
        copyImageHash:copy?.imageHash||'',
        copyScanPath:copy?.scanPath||'',
        copyDetached:copy?.photoDetached===true,
        recovery,
        recoveryCalls,
        sourceImageId:storedSource?.imageId||'',
        sourceImageExists:!!sourceImage,
      };
    });
    const expected={copyExists:true,copyImageId:'',copyImageHash:'',copyScanPath:'',copyDetached:true,recovery:null,recoveryCalls:0,sourceImageId:'img_20261006_001_test',sourceImageExists:true};
    for(const [key,value] of Object.entries(expected))if(result[key]!==value)throw new Error(`${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(result[key])}`);
    console.log('OK: 영수증 복사본은 사진·완료본 연결을 제외하고 원본 사진은 보존합니다');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error.stack||error);server.close();process.exit(1);});
