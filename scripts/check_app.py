#!/usr/bin/env python3
"""Dependency-free release checks for the Receipt DB static app."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    errors: list[str] = []
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    worker = (ROOT / "sw.js").read_text(encoding="utf-8")

    version_match = re.search(r"const APP_VERSION='(v[0-9.]+)'", index)
    version = version_match.group(1) if version_match else ""
    if not version:
        errors.append("APP_VERSION을 찾지 못했습니다")
    if version and f"· {version}" not in readme:
        errors.append("README 버전이 APP_VERSION과 다릅니다")
    if version and f"CACHE_NAME=CACHE_PREFIX+'{version}'" not in worker:
        errors.append("서비스 워커 캐시 버전이 APP_VERSION과 다릅니다")

    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    for icon in manifest.get("icons", []):
        path = ROOT / str(icon.get("src", "")).removeprefix("./")
        if not path.is_file():
            errors.append(f"manifest 아이콘이 없습니다: {path.relative_to(ROOT)}")

    shell_match = re.search(r"const SHELL=\[(.*?)\];", worker, re.S)
    shell_paths = re.findall(r"'\./([^']*)'", shell_match.group(1) if shell_match else "")
    for relative in shell_paths:
        if relative and not (ROOT / relative).is_file():
            errors.append(f"오프라인 셸 파일이 없습니다: {relative}")

    category_assets = re.findall(r"'[^']+':'(icons/categories/[^']+\.svg)'", index)
    if len(set(category_assets)) != 16:
        errors.append(f"카테고리 SVG가 16종이 아닙니다: {len(set(category_assets))}종")
    for relative in set(category_assets):
        if not (ROOT / relative).is_file():
            errors.append(f"카테고리 SVG가 없습니다: {relative}")
    old_category_pngs = sorted((ROOT / "icons/categories").glob("*.png"))
    if old_category_pngs:
        errors.append("대체된 카테고리 PNG가 남아 있습니다: " + ", ".join(path.name for path in old_category_pngs))
    expected_order = "['외식','카페','술집','노래방','쇼핑','영화','교통','여행','숙박','골프','스파','운동','케이크','경조사','병원·약국','기타']"
    if f"const BASE_CATEGORIES={expected_order}" not in index:
        errors.append("카테고리 4×4 표시 순서가 디자인 순서와 다릅니다")
    expected_labels = "{'케이크':'기념','영화':'문화','병원·약국':'의료','경조사':'경조','스파':'뷰티'}"
    if f"const CATEGORY_LABELS={expected_labels}" not in index:
        errors.append("카테고리 표시 이름이 디자인 명칭과 다릅니다")

    if index.count('<circle cx="12" cy="13" r="3.5"/>') != 3:
        errors.append("사진 없음 렌즈 아이콘 세 위치가 서로 다릅니다")
    if '<circle cx="12" cy="14" r="4"/>' in index:
        errors.append("이전 사진 없음 렌즈 좌표가 남아 있습니다")

    # v4.86 — 빈 사진 안내 아이콘의 여백이 중첩된 제거 버튼 SVG까지 번지면 X가 위로 밀린다.
    if ".photo-zone svg{margin:0 auto 6px;}" in index:
        errors.append("사진 안내 SVG 여백은 직계 자식에만 적용해야 합니다(제거 버튼 X 정렬 보호)")
    if ".photo-zone>svg{margin:0 auto 6px;}" not in index or ".photo-remove svg{display:block;margin:0;}" not in index:
        errors.append("사진 제거 버튼 SVG 중앙 정렬 보호 규칙이 없습니다")

    # v4.95 — PC·모바일 모두 같은 앱 24시간 선택기를 사용한다.
    if "const _desktopPickerMq=window.matchMedia('(hover:hover) and (pointer:fine)')" not in index or "const _desktopTimeMq=_desktopPickerMq;" not in index or "function _timeOpen(inp)" not in index:
        errors.append("데스크톱 시간 선택기가 없습니다")
    if "closest('.kv-time-inp,.kv-date-inp')" in index or "dtEl.addEventListener('focus',openPicker)" in index:
        errors.append("날짜·시간 선택기에 중복 showPicker 호출이 남아 있습니다")
    if '.kv-time-inp[type="time"]{pointer-events:none;}' not in index or ".time-pop.mobile{position:fixed" not in index or "backdrop.className='time-pop-backdrop'" not in index:
        errors.append("모바일 시간이 단일 앱 24시간 선택기 모달이 아닙니다")
    if "if(_timePicker&&_timePicker.inp===inp){_timeClose(true);return;}" not in index:
        errors.append("같은 시간 입력 재클릭 닫기 동작이 없습니다")
    if '<select class="time-pop-select"' in index or 'class="time-pop-option' not in index:
        errors.append("시간 시·분이 앱 내부 목록으로 통일되지 않았습니다")
    if "hourSel.addEventListener('change',commit)" in index or "minuteSel.addEventListener('change',commit)" in index:
        errors.append("시간이 완료 전에 원본 입력에 반영됩니다")
    if "if(focus&&!mobile)try{inp.focus({preventScroll:true});}" not in index:
        errors.append("모바일 모달 종료 후 네이티브 날짜·시간 입력 포커스 방지가 없습니다")
    if "e.target.closest('.date-pop,.time-pop')" not in index:
        errors.append("날짜·시간 팝업 내부 클릭 충돌 방지가 없습니다")
    if "-webkit-overflow-scrolling:touch" not in index or "touch-action:pan-y" not in index:
        errors.append("모바일 시간 목록의 관성·세로 터치 스크롤 규칙이 없습니다")
    if "function _pickerLockPage()" not in index or "function _pickerUnlockPage()" not in index:
        errors.append("모바일 선택기 배경 페이지 스크롤 잠금이 없습니다")
    if "document.body.classList.contains('picker-modal-open')" not in index or ".date-pop-backdrop,.time-pop-backdrop,.date-pop.mobile,.time-pop.mobile" not in index:
        errors.append("모바일 날짜·시간 선택기에서 당겨서 새로고침 차단이 없습니다")
    if "select(kind,kind==='hour'?btn.dataset.timeHour:btn.dataset.timeMinute,{focus:!mobile})" not in index:
        errors.append("모바일 시간 선택 시 강제 포커스·재정렬 방지가 없습니다")
    if "try{input.showPicker();}" in index:
        errors.append("날짜 입력에 브라우저 네이티브 showPicker 경로가 남아 있습니다")

    # v4.90 — PC 날짜·시간은 결제수단과 같은 필드 너비이며, 네 종류의 선택창은 서로 겹치지 않는다.
    if "function _dateOpen(inp)" not in index or ".date-pop{position:absolute" not in index:
        errors.append("데스크톱 앱 내부 날짜 선택기가 없습니다")
    if 'input[type="date"]{pointer-events:none;}' not in index or ".date-pop.mobile{position:fixed" not in index or "backdrop.className='date-pop-backdrop'" not in index:
        errors.append("모바일 날짜 선택기가 더치페이와 같은 단일 앱 달력 모달이 아닙니다")
    if "if(_datePicker&&_datePicker.inp===inp){_dateClose(true);return;}" not in index:
        errors.append("같은 날짜 입력 재클릭 닫기 동작이 없습니다")
    if ".time-pop{position:absolute;z-index:46;top:calc(100% + 8px);left:-1px;right:-1px;" not in index or "width:248px" in index:
        errors.append("시간 선택기 너비가 결제수단 필드 너비와 같지 않습니다")
    if "_kvsClose();_timeClose();_dateClose();_closeCategoryPicker();" not in index or "_timeClose();_dateClose();_kvsClose();_closeAnyCategoryPicker();" not in index:
        errors.append("결제수단·카테고리·날짜·시간 선택창 상호 닫힘 규칙이 없습니다")

    # v4.89 — 더치페이 전송은 즉시 피드백하고, 평소 Dropbox 폴더 확인 왕복과 작은 JPEG 재압축을 피한다.
    if "let _dutchPaySending=false;" not in index or "send.textContent=_dutchPaySending?'보내는 중…':'더치페이로 보내기';" not in index:
        errors.append("더치페이 전송 중 표시·중복 전송 방지가 없습니다")
    if "let resp=await upload();\n    if(resp.status===409)" not in index:
        errors.append("더치페이 Dropbox 전송이 upload-first/folder-fallback 방식이 아닙니다")
    if "async function _prepareDutchReceiptImage(srcUrl)" not in index or "srcUrl.length<1500000" not in index:
        errors.append("제한 이내 JPEG의 재압축 생략 경로가 없습니다")
    if "const imgUrl=(r.imageId||_receiptRecoveryImageId(r))?await _ensureReceiptImgUrl(r):null;" not in index:
        errors.append("사진 없는 영수증의 더치페이 전송이 Dropbox 사진 복구 조회를 건너뛰지 않습니다")

    for stale in ("_dbxCollectSyncImages", "_reRenderDetailItems", "consolidateReceiptFolders", "importFromAppFolder"):
        if re.search(rf"\b{re.escape(stale)}\b", index):
            errors.append(f"정리 대상 함수가 남아 있습니다: {stale}")
    if (ROOT / "receipt-db").exists() and any((ROOT / "receipt-db").iterdir()):
        errors.append("오래된 receipt-db/ 중복 폴더가 남아 있습니다")
    if re.search(r'data-id="\$\{(?:r\.id|it\.receiptId)\}"', index):
        errors.append("이스케이프하지 않은 영수증 ID 속성이 남아 있습니다")

    # v4.10 — Dropbox 파일 안전 규칙. 앱은 Dropbox 파일을 지우지 않는다('지우기' = 정리 보관함으로 옮기기, _dbxTrash).
    #   v4.04 '중복 정리'가 완료 JPG 수십 개를 잘못 지운 사고(v4.09 복구) 뒤 세운 규칙이라, 새 코드가 어기면 릴리스를 막는다.
    app_js = index + "\n" + (ROOT / "prepaid.js").read_text(encoding="utf-8") + "\n" + (ROOT / "advance.js").read_text(encoding="utf-8") + "\n" + worker
    for banned in ("files/delete_batch", "files/permanently_delete", "files/delete\"", "files/delete'"):
        if banned in app_js:
            errors.append(f"Dropbox 삭제 API를 쓰면 안 됩니다(정리 보관함 _dbxTrash 사용): {banned}")
    delete_calls = [m.start() for m in re.finditer(r"'https://api\.dropboxapi\.com/2/files/delete_v2'", app_js)]
    snap = re.search(r"async function _dbxDeleteAutoSnapshot\(token,path\)\{.*?\n\}", index, re.S)
    if len(delete_calls) != 1 or not snap or "files/delete_v2" not in snap.group(0):
        errors.append(f"files/delete_v2는 _dbxDeleteAutoSnapshot 한 곳에서만 쓸 수 있습니다(현재 {len(delete_calls)}곳) — 파일은 _dbxTrash로 정리 보관함에 옮길 것")
    elif "receipt-db_auto_" not in snap.group(0) or "_dbxBackupDir()" not in snap.group(0):
        errors.append("_dbxDeleteAutoSnapshot이 자동 백업 경로만 지우도록 제한되어 있지 않습니다")
    lines = index.splitlines()
    for no, line in enumerate(lines, 1):
        if "mode:'overwrite'" in line and "_dbxImagesDir()" not in line:
            errors.append(f"index.html:{no} 덮어쓰기(mode:'overwrite')는 images/ 사진 백업에만 허용됩니다")
        if "autorename:true" in line and not line.lstrip().startswith("//"):
            window = "\n".join(lines[max(0, no - 5):no])
            if not any(k in window for k in ("_dbxBackupDir()", "_dbxTrashDir()", "_dbxScanDir()")):
                errors.append(f"index.html:{no} autorename:true는 백업·정리 보관함·스캔함에만 허용됩니다(완료 폴더에 '(1)' 사본이 생김)")

    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print(f"OK: Receipt DB {version} release checks passed ({len(shell_paths)} offline shell files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
