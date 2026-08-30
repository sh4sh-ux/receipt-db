from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

pdf_script = '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>'
if 'pdf.min.js' not in text:
    if '</head>' not in text:
        raise SystemExit('HEAD_ANCHOR_NOT_FOUND')
    text = text.replace('</head>', pdf_script + '\n</head>', 1)

helper_anchor = """function _scanFileName(rec){\n  const d=String(rec.date||'').replace(/-/g,'').slice(2);           // 260809\n  const amt=Number(rec.total||0);\n  const money=amt?`(${amt.toLocaleString('ko-KR')})`:'';\n  const store=String(rec.store||'').replace(/[\\\\/:*?\"<>|]/g,'').trim();\n  return `${d}_영수증${money}${store?'_'+store:''}`.slice(0,180);\n}\n"""
if text.count(helper_anchor) != 1:
    raise SystemExit(f'SCAN_FILENAME_ANCHOR_COUNT={text.count(helper_anchor)}; expected 1')

helper_code = r'''

// PDF 스캔본의 첫 페이지를 JPG로 보관한다.
// 원본 PDF는 그대로 유지하고, 미리보기/보관용 JPG만 추가 생성한다.
async function _pdfFirstPageToJpegBlob(buf){
  if(!window.pdfjsLib)throw new Error('PDFJS_NOT_LOADED');
  const data=new Uint8Array(buf);
  const task=window.pdfjsLib.getDocument({data,disableWorker:true});
  const pdf=await task.promise;
  try{
    if(!pdf.numPages)throw new Error('PDF_NO_PAGES');
    const page=await pdf.getPage(1);
    const base=page.getViewport({scale:1});
    const longest=Math.max(base.width,base.height)||1;
    const scale=Math.min(2,2400/longest);
    const viewport=page.getViewport({scale:Math.max(.5,scale)});
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(viewport.width));
    canvas.height=Math.max(1,Math.round(viewport.height));
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('CANVAS_UNAVAILABLE');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport,background:'white'}).promise;
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(
      b=>b?resolve(b):reject(new Error('JPEG_ENCODE_FAILED')),'image/jpeg',.92));
    canvas.width=1;canvas.height=1;
    return blob;
  }finally{
    try{await pdf.destroy();}catch(e){}
  }
}

async function _dbxUploadBinary(path,blob,{overwrite=false}={}){
  const token=await _dbxToken();
  const resp=await fetch('https://content.dropboxapi.com/2/files/upload',{
    method:'POST',
    headers:{
      'Authorization':'Bearer '+token,
      'Dropbox-API-Arg':_dbxApiArg({path,mode:overwrite?'overwrite':'add',autorename:false,mute:true}),
      'Content-Type':'application/octet-stream',
    },
    body:blob,
  });
  if(resp.ok)return true;
  const txt=await resp.text();
  if(resp.status===409&&txt.includes('conflict'))return true;
  throw new Error(txt||('DROPBOX_UPLOAD_'+resp.status));
}

async function _dbxRenamePdfJpgCompanion(oldPdfPath,rec,token){
  if(!oldPdfPath||!oldPdfPath.toLowerCase().endsWith('.pdf'))return false;
  const oldName=oldPdfPath.slice(oldPdfPath.lastIndexOf('/')+1,-4);
  const from=_dbxScanDoneDir(true)+'/'+oldName+'.jpg';
  const to=_dbxScanDoneDir(true)+'/'+_scanFileName(rec)+'.jpg';
  if(from===to)return false;
  try{
    const r=await fetch('https://api.dropboxapi.com/2/files/move_v2',{
      method:'POST',
      headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({from_path:from,to_path:to,autorename:true}),
    });
    if(r.ok)return true;
    const txt=await r.text();
    if(txt.includes('from_lookup/not_found'))return false;
    console.warn('rename pdf jpg companion:',txt);
  }catch(e){console.warn('rename pdf jpg companion:',e.message||e);}
  return false;
}
'''
text = text.replace(helper_anchor, helper_anchor + helper_code, 1)

rename_old = """      if(r.ok){\n        rec.scanPath=(await r.json())?.metadata?.path_display||to;\n        return true;\n      }"""
rename_new = """      if(r.ok){\n        const oldPath=cur;\n        rec.scanPath=(await r.json())?.metadata?.path_display||to;\n        if(ext.toLowerCase()==='.pdf')await _dbxRenamePdfJpgCompanion(oldPath,rec,token);\n        return true;\n      }"""
if text.count(rename_old) != 1:
    raise SystemExit(f'RENAME_SUCCESS_ANCHOR_COUNT={text.count(rename_old)}; expected 1')
text = text.replace(rename_old, rename_new, 1)

prep_old = """        const isImg=_SCAN_IMG_EXTS.includes(ext);\n        // 날짜: 파일명 → EXIF 촬영일 → Dropbox 업로드 시각"""
prep_new = """        const isImg=_SCAN_IMG_EXTS.includes(ext);\n        const isPdf=ext==='.pdf';\n        let pdfJpgBlob=null;\n        if(isPdf){\n          try{ pdfJpgBlob=await _pdfFirstPageToJpegBlob(buf); }\n          catch(pe){ console.warn('pdf→jpg render:',f.name,pe.message||pe); }\n        }\n        // 날짜: 파일명 → EXIF 촬영일 → Dropbox 업로드 시각"""
if text.count(prep_old) != 1:
    raise SystemExit(f'PDF_PREP_ANCHOR_COUNT={text.count(prep_old)}; expected 1')
text = text.replace(prep_old, prep_new, 1)

move_old = """        await _dbxMoveInto(f.path_display,doneDir,_scanFileName(recNow),ext);\n        if(_lastMovedPath){\n          const saved=receipts.find(x=>x.id===id);\n          if(saved){ saved.scanPath=_lastMovedPath; await dbPut('receipts',saved); }\n        }"""
move_new = """        await _dbxMoveInto(f.path_display,doneDir,_scanFileName(recNow),ext);\n        if(_lastMovedPath){\n          const saved=receipts.find(x=>x.id===id);\n          if(saved){ saved.scanPath=_lastMovedPath; await dbPut('receipts',saved); }\n\n          // PDF 원본은 완료 PDF에 그대로 두고, 첫 페이지 JPG를 완료 JPG에 같은 이름으로 추가한다.\n          if(isPdf&&pdfJpgBlob){\n            try{\n              await _dbxEnsureFolder(_dbxScanDoneDir(true));\n              const movedName=_lastMovedPath.slice(_lastMovedPath.lastIndexOf('/')+1);\n              const jpgBase=movedName.replace(/\\.pdf$/i,'');\n              await _dbxUploadBinary(_dbxScanDoneDir(true)+'/'+jpgBase+'.jpg',pdfJpgBlob);\n            }catch(je){\n              console.warn('pdf→jpg upload:',f.name,je.message||je);\n            }\n          }\n        }"""
if text.count(move_old) != 1:
    raise SystemExit(f'MOVE_ANCHOR_COUNT={text.count(move_old)}; expected 1')
text = text.replace(move_old, move_new, 1)

text = text.replace("완료 JPG/YYYY-MM/  — 등록된 사진(jpg·jpeg·png)이 날짜 이름으로 옮겨진다", "완료 JPG/         — 사진 및 PDF 첫 페이지 JPG가 날짜 이름으로 보관된다")
text = text.replace("완료 PDF/YYYY-MM/  — 등록된 PDF가 날짜 이름으로 옮겨진다", "완료 PDF/         — 등록된 원본 PDF가 날짜 이름으로 옮겨진다")
text = text.replace("⑤ 등록을 마친 파일은 확장자로 갈라 '완료 JPG/YYYY-MM/' 또는\n//     '완료 PDF/YYYY-MM/'으로 옮긴다 (맥 스크립트도 같은 규칙).", "⑤ 사진은 '완료 JPG/', PDF 원본은 '완료 PDF/'로 옮긴다. PDF는 첫 페이지 JPG도\n//     '완료 JPG/'에 같은 파일명으로 추가 보관한다.")

checks = [
    "const _SCAN_DOC_EXTS=['.pdf'];",
    "const _dbxScanDoneDir=isImg=>_DBX_DATA_DIR+(isImg?'/완료 JPG':'/완료 PDF');",
    "await _dbxMoveInto(f.path_display,doneDir,_scanFileName(recNow),ext);",
    "_pdfFirstPageToJpegBlob",
    "_dbxRenamePdfJpgCompanion",
    "pdfJpgBlob",
    "pdf.min.js",
    "function _scanFileName",
]
for needle in checks:
    if needle not in text:
        raise SystemExit(f'SAFETY_CHECK_FAILED: {needle}')

if text == original:
    raise SystemExit('NO_CHANGES')
path.write_text(text, encoding='utf-8')
print('patch complete')
