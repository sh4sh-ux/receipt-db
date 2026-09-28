# Receipt DB — 영수증 관리 앱

## 프로젝트 개요
단일 HTML 파일로 동작하는 영수증 보관·검색 앱. dutch-pay의 자매 앱으로,
디자인 톤·코드 스타일을 dutchpay.html과 일치시킴.

- 사용자: 한국어 사용자, 비개발자, 혼자 + 가끔 가족 공유
- 처리량: 하루 10장 이하 (저용량, 영구 보존이 최우선)
- OCR·외부 API 사용 금지 — ChatGPT/Claude/Gemini 무료 버전으로
  사용자가 직접 사진 → 텍스트 변환 후 앱에 붙여넣기
- 외부 의존성 없음 — 순수 HTML + CSS + Vanilla JS. 아이콘은 인라인 SVG 위주 + 로컬 PNG 소수 (CDN·외부 폰트 없음)

## 현재 파일
- `index.html` — 앱 전체 (HTML/CSS/JS 통합, 약 1MB·1만4천 줄)
- `prepaid.js` · `prepaid.css` — **멤버십 탭**(v4.29 — 구독 + 선불권, 아래 「멤버십」) · 선불권 화면(계산·저장·화면). v4.25 상세 = 월렛 카드 · 아이콘 버튼 · 월별 내역(잔액·화살표 없음) · 줄을 누르면 기록 창(`ppRecordSheet`: 보기 → 수정/삭제 확인). **수정은 `ppCommitEdit`로 void + 새 기록을 한 트랜잭션**(원본 기록을 고쳐 쓰지 말 것 — 선불권 기록은 추가만 한다), 결제 영수증이 연결된 기록은 수정 불가. 새 클래스는 `ppx-` 접두어(기존 `.pp-*`·`.ppw-*`와 겹치지 않게)
- `sw.js` — 서비스 워커. 모든 셸 파일 network-first(오프라인일 때만 캐시)
- `manifest.webmanifest` — PWA 설치 정보
- `README.md` — GitHub repo 첫 페이지용 한글 설명(첫 줄에 버전)
- `CLAUDE.md` — 이 파일(규칙·함정·현재 상태). **변경 이력은 `CHANGELOG.md`**
- `icons/` — PWA 아이콘(`icon-192/512.png`, `apple-touch-icon.png`) + 카테고리 `icons/categories/*.svg` 16종
- `scripts/check_app.py` — 릴리스 검사(버전·README·`CACHE_NAME` 일치, 오프라인 파일·아이콘, **Dropbox 삭제·덮어쓰기 금지 규칙**). **push 전에 실행**
- `scripts/check_prepaid.cjs` — 선불권 계산 검사
- `scripts/receipt_png_to_receipt_db.py` — PNG/JPG 영수증 스크린샷 자동 등록 (맥에서 실행)
- `scripts/extract_category_svgs.py` — 이전 Illustrator SVG 정리 도구. 확인 적용된 숙박 자산은 덮어쓰지 않도록 제외
- `.github/workflows/*.yml` — v2.51·v2.92·v2.93 때 한 번 쓴 자동 패치(지금은 앵커가 없어 실행해도 실패로 끝남 — 정리 대상)

## 버전 관리
- 단일 상수 `APP_VERSION` (JS 상단)이 진실의 원천. DOM(각 탭 헤더 칩·설정 앱 정보)에 init 시 주입
- 형식: `v메이저.패치2자리` (예: `v1.02`, `v1.10` … `v1.99` 후 `v2.00`)
- **릴리스마다 함께 바꾸는 곳**: `APP_VERSION` · index.html 상단 changelog 코멘트 한 줄 · **`CHANGELOG.md` 맨 위 항목** ·
  `sw.js`의 `CACHE_NAME` · `README.md` 첫 줄 버전 → `python3 scripts/check_app.py`로 확인
- ⚠️ **`sw.js`의 `CACHE_NAME`을 안 올리면 폰이 새 서비스 워커를 설치하지 않는다**(v3.06~v3.96 동안 안 올려 아이폰이 옛 선불권 파일을 계속 썼다 — v3.97).
  폰은 배포 후 **앱을 두 번 열어야** 새 버전이 보인다(첫 번째에 새 SW 설치).
- JSON 백업 파일에도 `appVersion` 필드로 포함 — 어떤 버전에서 만든 백업인지 추적
- IndexedDB 스키마 버전(`DB_VER=2`)과 JSON 백업 포맷 버전(`version:2`)은 앱 버전과 **독립적**. 세 가지 모두 다른 의미라 헷갈리지 말 것.

## ⚠️ 작업 규칙 — CSS/레이아웃 변경 시 필수
**데스크탑과 모바일 두 뷰포트를 실제로 띄워 확인한 뒤에만 push할 것.**
한쪽만 보고 올려서 v2.19~v2.23까지 다섯 번 연속 재수정한 이력이 있음.

- 데스크탑 검증은 뷰포트 폭을 **명시적으로 1280px로 지정**해서 할 것.
  브라우저 창이 780px 이하면 모바일 미디어쿼리가 걸려 데스크탑을 본 게 아님 (실제로 이 착각으로 오판했음).
- 모바일은 375px에서 **스크롤을 끝까지 내려** 마지막 필드(메모)까지 도달하는지 확인.
- **텍스트를 실제로 붙여넣은 뒤(=키보드를 쓴 뒤) 저장 버튼이 보이는지 확인할 것.** 빈 폼만 보면 v2.30 버그를 놓친다.
- 확인 항목: 액션바 위치, 하단으로 새는 내용 유무, 사이드바 구분선과 액션바 구분선 정렬.

### 레이아웃 구조상 주의 (v2.30에서 재확정)
- **이 앱은 `body`가 `overflow:hidden`이고 `.main-body`(`overflow-y:auto`)가 스크롤 컨테이너다.**
  문서 자체는 스크롤되지 않는다. 이 구조가 아래 모든 판단의 전제다.
- ⚠️ **모바일 액션바를 `position:fixed`로 만들지 말 것.** (v2.24에서 fixed로 바꿨다가 v2.30에서 되돌림)
  iOS는 키보드가 열려도 **레이아웃 뷰포트는 그대로 두고 비주얼 뷰포트만 줄인다.**
  `fixed`는 레이아웃 뷰포트 기준이라 액션바가 화면 밖으로 밀려나고, 키보드를 닫아도
  리페인트 전까지 돌아오지 않는다 → **"저장 버튼이 사라졌다"** 증상.
  붙여넣기 작업은 반드시 키보드를 쓰므로 이 경로를 100% 밟는다.
- `position:sticky; bottom:0`은 **스크롤 컨테이너(`.main-body`) 기준**이라 뷰포트 계산과 무관하다.
  데스크탑·모바일 모두 sticky를 쓴다. v2.24의 "sticky가 흐름 중간에 박힌다"는 서술은
  현재 구조에서는 재현되지 않는다(`.main-body`가 정상 스크롤러이므로 정상 pin됨).
- sticky는 문서 흐름에 남으므로 `#viewInput .main-body`에 **하단 보정 여백이 필요 없다**(`padding-bottom:0`).
  fixed 시절의 63px 보정을 되살리면 액션바 아래 빈 공간이 생긴다.
- `.actions-shortcut`(⌘+↵)은 모바일에서 숨긴다 — 폰에서 쓸 수 없고 좁은 폭에서 '저 장'으로 줄바꿈돼 깨진다.
- `.view.on`에 `overflow:hidden`을 걸지 말 것 — 카테고리 팝오버가 잘림 (v2.22에서 제거).
- 모바일에서 하단에 띄우는 것(토스트·일괄 전송 바 등)은 **nav bar 68px + safe-area를 반드시 비켜야 한다.**
  `bottom:20px` 같은 값을 그대로 쓰면 nav bar에 가려진다 (v2.31).
- ⚠️ **헤더 높이를 `height`로 고정하지 말 것 — `min-height`를 쓸 것** (v2.56).
  `padding-top`이 `safe-area-inset-top`에 따라 달라지므로 고정 높이는 반드시 어딘가에서 잘린다.
- ⚠️ **화면 전체 높이를 계산하는 곳(`.shell`·`.app`)은 `--cw-h`를 빼야 한다.**
  미연결 경고 띠가 뜨면 그만큼 아래가 잘린다 (v2.56에서 `.app` 누락분 수정).

## 🚫 Dropbox 파일은 절대 지우지 않는다 (v4.10 · 최우선 규칙)
- v4.04 '중복 정리'가 판정을 잘못해 완료 JPG 수십 개를 지웠다(v4.09에서 휴지통 복원). 그 뒤로 **앱의 '지우기'는 전부 `_dbxTrash`** —
  `영수증(RECEIPT-DB)/정리 보관함/YYYY-MM-DD/<원래 경로>`로 옮긴다. 사용자가 비우기 전까지 남고, 원래 폴더로 옮기면 되살아난다.
- 실제 삭제(`files/delete_v2`)는 `_dbxDeleteAutoSnapshot` 한 곳 — 매일 자동 백업 30개 초과분만. `delete_batch`·`permanently_delete` 금지.
- 완료 폴더에 `autorename:true` 금지(`(1)` 사본), `mode:'overwrite'`는 images/ 사진 백업만. 이름 바꾸기·옮기기는 같은 이름이 있으면 하지 않는다.
- **`python3 scripts/check_app.py`가 위 규칙을 어기면 실패한다** — 규칙을 풀지 말고 코드를 고칠 것.
- 파일을 옮기거나 연결을 바꾸는 새 기능은 가짜 Dropbox(`page.route`)로 **실행 전후 파일 목록을 비교**해 검증한다(이름·내용·개수, 휴지통·보관함 포함).

## ⚠️ Dropbox 데이터 경로 (v2.33~ · /07_Apps 통합)
모든 앱 데이터를 Dropbox `/07_Apps/` 아래로 모으면서 이 앱도 이동했다.

```
/07_Apps/영수증(RECEIPT-DB)/
  스캔함/              — 여기에 사진·PDF를 넣으면 동기화 때 자동 등록된다 (경로 변경 가능)
  완료 JPG/YYYY-MM/    — 등록된 사진(jpg·jpeg·png)이 YYYY-MM-DD_영수증.확장자로 옮겨짐
  완료 PDF/YYYY-MM/    — 등록된 PDF가 같은 규칙으로 옮겨짐
  images/              — 앱이 관리하는 영수증 사진 원본
  backups/             — 수동 전체 백업 JSON + 매일 자동 백업 receipt-db_auto_YYYY-MM-DD.json(최근 30개, v4.04)
  정리 보관함/YYYY-MM-DD/ — 앱이 '지운' 파일(중복 정리·옛 폴더 정리). 실제로는 지우지 않고 여기로 옮긴다(v4.10)
  receipt-db_sync.json · receipt-db_inbox.json
```

- 옛 위치는 `/01_Personal/영수증/Receipt_DB/`. `_dbxResolveRoot()`가 동기화 시작 때 한 번
  **copy_v2로 통째 복사**하고 옛 폴더는 **지우지 않는다**. 복사가 실패하면 옛 위치로 계속
  동작하다 다음 동기화에 재시도하므로 어떤 경우에도 데이터가 사라지지 않는다.
  성공 여부는 localStorage `dbx_migrated_07apps`에 기록해 1회만 돈다.
  **App key가 바뀌면 그 표시를 지운다** — App folder 앱 → Full Dropbox 앱으로 갈아탈 때
  이전을 건너뛰고 엉뚱한 위치를 계속 쓰는 것을 막기 위함.
- ⚠️ **`/07_Apps/`에 실제로 저장되려면 Dropbox 앱이 Full Dropbox 권한이어야 한다.**
  App folder 권한이면 `/Apps/<앱>/07_Apps/...` 안으로 접힌다.
  설정 탭 **'위치 확인'** 버튼이 어느 쪽인지 판별해 실제 위치를 알려준다 —
  다만 Dropbox API에 스코프를 알려주는 호출이 없어 **추정**이다(이름 패턴 + `/Apps` 존재).
  확실히 알려면 Dropbox 개발자 콘솔의 앱 목록에서 `Permission type`을 보면 된다.
- 한글 폴더명이라 `Dropbox-API-Arg` 헤더는 반드시 `_dbxApiArg()`로 ASCII 이스케이프할 것
  (HTTP 헤더는 ASCII만 허용 — 안 하면 fetch가 통째로 실패한다).
- **PNG/JPG 스크린샷**(토스 전자영수증 등)은 `scripts/receipt_png_to_receipt_db.py`가 처리 —
  v2.33부터 **앱과 같은 `스캔함/` 폴더를 감시**하고 완료 파일도 같은 `완료 JPG`/`완료 PDF`로 옮긴다.
  앱과 스크립트가 같은 파일을 봐도 안전하다: 양쪽 모두 **원본 파일 내용의 sha1**로
  ID(`rec_YYYYMMDD_p해시6`)와 `srcHash`를 만들기 때문에 먼저 처리한 쪽으로 합쳐질 뿐 중복이 없다.
  PDF 스크립트(`receipt_pdf_to_jpg.py`, repo 밖·맥에만 있음)와 **동시 실행은 금지**
  (inbox.json 단일 쓰기 원칙 — 순차 실행은 안전).

### ⚠️ 완료 JPG·PDF 폴더 규칙 (v4.04 — `이름 (1)(2)(3)` 사본이 쌓이던 원인)
- 완료본으로 **이동·업로드할 때 `autorename:true` 금지.** Dropbox가 `이름 (1).jpg`로 조용히 사본을 만든다. 같은 이름이 있으면 옮기지 않는다.
- 영수증 ↔ 완료본 연결은 `receipt.scanPath` 하나. **올리기 전에 먼저 찾아서 연결한다**(`_dbxArchiveReceiptPhoto`): 내용이 같은 파일 → 이 영수증 이름의 파일(`_isOwnNameFor`: 정식 이름·확장자 없음·`(N)`·`-<ID>` 꼬리) → 없을 때만 업로드. 다른 영수증이 쓰는 파일은 제외하고, 내용이 다른 파일은 같은 이름(날짜·금액·매장)의 다른 영수증이 없을 때만 채택.
- 동기화 순서: 이름 정리·맥 원본 연결(`_autoRenameCompleted`) **먼저**, 그다음 사본 업로드(`_dbxArchivePending`).
- 날짜로 파일을 짝지을 때는 **아직 `scanPath`가 없는 영수증만** 후보. 이미 파일이 있는 영수증의 연결을 바꾸지 않는다.
- `_dbxMerge`는 이긴 쪽(최신본)에 `scanPath`가 없으면 이 기기 값을 지킨다(연결이 지워지면 사진을 또 올린다).
- ⚠️ **완료본 연결은 `_putScanPath`로 최신 레코드에 scanPath만 적는다**(v4.08). 네트워크를 기다린 뒤 들고 있던 레코드를 통째로 dbPut하면 그 사이의 수정(매장명 등)을 덮는다. 상세 저장 뒤 이름 정리는 `_detailBgQueue`로 한 줄로 — 연달아 저장하면 겹쳐 파일이 중간 이름으로 남고 연결이 끊겼다. 상세 저장 때 scanPath는 DB 값을 쓴다.
- 끊긴 연결(scanPath 파일이 폴더에 없음)은 동기화 때 `_dbxHealDoneLinks`가 다시 잇는다(30분에 한 번, 같은 사진 → 이 영수증 이름 → 없으면 재업로드, 삭제 없음). 사용자가 완료 폴더에서 지운 파일도 다시 올라온다.
- 확장자는 `_fileExt`(`.영문숫자 2~5자`)로만 판정 — `lastIndexOf('.')`는 확장자 없는 파일에서 마지막 글자를 뗀다.
- ⚠️ **한글 파일 이름은 NFC/NFD가 섞여 있다**(맥에서 만든 이름은 자모 분리 NFD). 이름·경로 비교는 반드시 `_nfc`·`_pkey`(NFC+소문자)·`_baseKey`(확장자 제외)로(v4.06).
- 이름 정리는 **같은 이름(확장자·정규화 무시)의 다른 파일이 있으면 옮기지 않는다** — 사용자가 편집한 원본이 그 이름을 쓰면 앱 사진은 `(N)` 이름 그대로 둔다(v4.06).
- ⚠️ **완료 JPG와 완료 PDF를 한 목록으로 이름 비교하지 말 것**(v4.09). 맥 PDF 스크립트는 같은 이름의 JPG와 PDF를 만든다 — v4.04 '중복 정리'가 이 짝의 PDF를 원본, JPG를 앱 사본으로 오판해 JPG 수십 개를 지우고 연결을 PDF로 바꿨다(`_dbxRepairV404`가 휴지통에서 복원·재연결). 사진 영수증은 완료 JPG에만 연결한다.
- '중복 정리' ②(v4.11): **연결 안 된 파일**이 이름의 날짜·금액이 같은 **연결된 파일**과 사진이 같으면(`_imgLooksSame` — 16×16 칸 중 가장 다른 칸 ≤ 6) 보관함으로. 연결된 파일은 옮기지 않는다. 기준을 느슨하게 하지 말 것 — 같은 가게·같은 금액의 다른 영수증은 시간·승인번호 칸에서만 차이 난다.
- ⚠️ **'중복 정리'는 ① content_hash가 같은 파일은 1개만 남기고 정리 보관함으로.** `(N)` 파일이 사용자가 따로 편집한 다른 사진일 수 있다(실사례: 카드 전표만 vs 전표+메뉴판 합본 — v4.06). 내용이 다른 파일은 절대 자동 삭제하지 말고 목록으로 알리기만 한다.

### 매일 자동 백업 (v4.04)
- `_dbxDailySnapshot` — 그날 첫 동기화에서 **이 기기가 올리기 전** 서버 `receipt-db_sync.json`을 `copy_v2`로 `backups/receipt-db_auto_YYYY-MM-DD.json`에 복사(사진 제외 — 사진은 `images/`), 최근 30개만 유지. 'Dropbox에서 복원' 목록에 그대로 나온다. 마지막 날짜는 localStorage `dbx_auto_snap_day`.

## 변경 이력
**`CHANGELOG.md`**(최신이 위). 옛 결정의 이유·검증 내용은 거기서 찾는다(`grep -n "v3.9" CHANGELOG.md` 등).
아래 섹션들은 지금 코드 기준의 규칙·함정 요약이다.

## 데이터 모델
```js
Receipt {
  id: "rec_20260519_001_lz5y", // rec_YYYYMMDD_NNN_<rand>(앱, v2.95~ 기기 간 고유) · rec_YYYYMMDD_p<sha1 6>(스캔함, 결정적) · rec_YYYYMMDD_aNN(맥 PDF 스크립트 inbox)
  date: "2026-05-19",          // YYYY-MM-DD
  time: "14:30",               // 선택, HH:MM (v4.00~ 화면·프롬프트에 있음 — 같은 날 사용 순서 정렬용)
  store, category,             // category는 normalizeCategory()로 읽을 때 정규화
  paymentMethod: "card",       // card | cash | transfer | other
  paymentDetail: "현대카드",
  total: 27020,                // 정수, 원
  items: [{name, quantity, unitPrice, amount /*음수=할인*/, category}],
  paidBy: "조상현",            // 결제자(1명). 비면 저장 시 getMyName()
  participants: ["조상현","신유철"],
  splitExclude: ["신유철"],    // 선택 — 깍두기(참석·분담 0원)
  treat: true,                 // 선택 — 한턱(결제자 전액)
  treatBy: {type:'relationGroup',groupId,members:[...]}, // 선택 — 공동 한턱 주체 snapshot (v3.70)
  meetingId: "mtg_xxx",        // 선택 — 같은 만남 연결 (v3.46)
  meetingOrder: 2,             // 선택 — 만남 안 차수(표시 전용, v3.83). 만남의 모든 영수증에 시간이 있으면 무시하고 날짜+시간 순(v4.08)
  imageId: "img_xxx",          // images store 키
  imageHash, photoClaim,       // 사진 무결성 확인용
  scanPath: "/07_Apps/…/완료 JPG/260519_영수증(27,020)_하나로마트 청담점.jpg", // 연결된 완료본 (위 「완료 폴더 규칙」)
  srcHash: "…",                // 스캔함/스크립트 등록분 — 원본 파일 sha1(중복 방지)
  prepaidEventId,              // 선불권 사용 기록과 연결
  notes: "", tags: [],
  createdAt: ISO, updatedAt: ISO   // 동기화 머지는 updatedAt 최신 우선
}
```
- 관계 그룹(`relationGroups`)·카테고리 학습 사전(`storeCatMap`)은 settings store, 선불권은 `prepaidRecords` — 셋 다 sync JSON·백업에 포함.

## 저장소 (IndexedDB)
- DB 이름: `receiptdb`, **버전 2** (v1 → v2 마이그레이션: settings store 추가)
- Object stores:
  - `receipts` (keyPath: `id`) — 영수증 메타데이터
  - `images` (keyPath: `id`) — `{id, blob, mime}` 이미지 Blob 분리 저장
  - `settings` (keyPath: `key`) — `{key, value}` 형식. 카테고리 학습 사전 등
- 마이그레이션은 `onupgradeneeded`에서 idempotent하게 처리 (`if(!contains)`)
- localStorage는 UI 설정 정도만 사용 — Blob 때문에 메인 데이터는 IndexedDB

## GPT 텍스트 포맷 · 프롬프트 (사용자 → 앱 입력)
- **프롬프트 원문의 진실원은 코드의 `GPT_PROMPT`**(추가 화면 '프롬프트 복사'). 형식:
```
매장명: 하나로마트 청담점
일자: 2026.05.19
시간: 19:40            ← 영수증에 없으면 줄 생략 (v4.00)
총액: 27,020원
결제수단: 카드          ← 카드/현금/계좌이체 (v2.58)

품목명 | 수량 | 단가 | 금액

P오플레 클래식 플레인 1+1 680.0g | 1 | 3,980 | 3,980
[쿠폰]테라 453ml 8캔 | 1 | -2,400 | -2,400
```
- 파서 `parseReceiptText`가 읽는 줄: 매장명·일자(날짜)·시간·총액(합계)·결제수단·품목 줄. `카테고리`·`결제자` 줄은 읽지 않는다(카테고리는 자동 분류, 결제자는 기본 '내 이름').
- 쉼표는 천 단위만, 할인/쿠폰은 금액에 `-`. 품목 합계 ≠ 총액이면 경고(저장은 가능 — 사용자 판단).

## Phase 단계
- **Phase 1 (MVP, 완료)** — 단일 HTML, 파서, IndexedDB, 사진 첨부,
  목록·상세·인라인 편집, 기본 검색, JSON export/import
- **Phase 1.5 (가계부 형태, 완료)** — '목록' 탭 → '내역'으로 확장.
  좌측 사이드바 상단에 월 네비게이션, 우측 메인 패널 빈 상태에 가계부 요약
  (총지출/영수증수/일평균 + 전월 대비, 카테고리별 막대, 일별 sparkline).
  영수증 선택 시는 기존 상세 화면.
- **Phase 2** — 카테고리 자동 분류 (사용자 정의 사전, "진로/처음처럼 → 술" 매핑),
  한글 자모 검색
- **Phase 3** — Dropbox API 연동 (OAuth, 자동 백업)
- **Phase 4** — 가족 공유 (Dropbox 공유 폴더 가이드)
- **Phase 5** — PDF 내보내기 (월별 영수증 묶음 인쇄용), 예산 기능

## 카테고리 자동 분류 (Phase 1.5 후속)
- **기본 카테고리 16종** (`BASE_CATEGORIES`, 리터럴 배열·표시 순서):
  외식 / 카페 / 술집 / 노래방 / 쇼핑 / 영화 / 교통 / 여행 / 숙박 / 골프 / 스파 / 운동 / 케이크 / 경조사 / 병원·약국 / 기타
- **구 카테고리는 alias로 흡수** — `normalizeCategory()`가 매핑:
  `마트→쇼핑`, `문화→영화`, `배달→외식`, `병원→병원·약국`, `약국→병원·약국`, `부의금`·`축의금→경조사`.
  별도 마이그레이션 함수 없이 **읽을 때마다 정규화**하는 방식.
- **표시 라벨은 따로** — 저장 데이터 호환성을 유지하면서 화면에는 케이크→기념, 영화→문화, 병원·약국→의료, 경조사→경조, 스파→뷰티(v4.24, 연꽃 `beauty-line.svg` · 헤어·네일·마사지·스파)로 표시
- **계층 그룹** `CATEGORY_GROUPS`: 경조사 ← 부의금·축의금
- **아이콘** — `getCatSvg(cat)` 하나로 통일해서 꺼냄:
  `CAT_ASSETS`의 24×24 투명 SVG를 `currentColor` 마스크로 표시하고, 알 수 없는 카테고리는 인라인 문서 아이콘으로 fallback.
  원본 100×100 아트보드의 크기와 여백을 유지하며 `CAT_ICON_SCALES`는 비워 둔다.
- **규칙 사전 (`CAT_RULES`)**: `{cat, kws}` 배열. 가게명에 키워드 포함 시 매칭
- **사용자 학습 사전 (`storeCatMap`)**: `{"하나로마트 청담점": "마트", ...}`
  - IndexedDB `settings` store의 `storeCatMap` key에 저장
  - 정확 일치 → 부분 일치 → 규칙 사전 순서로 fallback
- **`autocategorize(storeName)`** → 카테고리 문자열 or `''`
- **`learnCategory(storeName, newCat)`** — 사용자가 명시한 매핑을 저장 (덮어쓰기)
- **학습 트리거**:
  1. 입력 화면에서 영수증 저장 시 (사용자 입력값 그대로 학습)
  2. 상세 화면에서 카테고리·가게명 인라인 편집 시
- **UI 자동 채움**:
  - 입력 화면: 텍스트 붙여넣자마자 가게명 인식 → 카테고리 자동 채움
  - 카테고리 입력란이 빈 상태이거나 이전에 자동 채워진 상태일 때만 덮어씀
  - 사용자가 손대면 자동 채움 플래그(`_catAutoFilled`) 해제
  - 라벨 옆 힌트: "→ 가게명에서 자동 분류됨 (수정 가능)" 초록색
- ⚠️ **규칙 사전이 얇다**: 학습 사전 없는 새 기기에서 실데이터 매장 107곳 중 13곳만 잡힌다(2026-09-27 점검). 스타벅스·이디야·GS25·CU·다이소 등이 없고,
  술집 키워드 `바` 한 글자 때문에 파리바게뜨·바른치킨이 술집이 된다. 보강은 「다음 작업 후보」.
- **export/import 호환**: 카테고리 학습 사전도 JSON 백업에 포함 (`storeCatMap` 키),
  import 시 기존 사전과 머지 (덮어쓰기)

## 가계부 화면 구조 (Phase 1.5)
- **State**: `viewMonth` ('YYYY-MM') — 현재 보고 있는 월. 초기값 = 오늘이 속한 월
- **사이드바**: 월 네비 ← `2026년 5월` → 와 "오늘" 버튼.
  검색 없을 땐 `viewMonth` 영수증만 단순 리스트로,
  검색 있으면 전체에서 월별 그룹핑 리스트로 (`searchQuery`가 모드 결정)
- **메인 패널**: 영수증 미선택 시 `renderMonthSummaryHtml(viewMonth)`,
  선택 시 기존 상세 화면
- **집계 함수** (전부 메모리 캐시 `receipts` 사용, IndexedDB 재조회 X):
  - `receiptsForMonth(ym)` — 특정 월 필터
  - `monthSummary(ym)` — { total, count, dayAvg, dayDivisor }
    (일평균은 현재 월이면 오늘까지, 과거 월이면 그 달 전체 일수로 나눔)
  - `categoryBreakdown(ym)` — 카테고리별 합계 (양수만), 비중 % 포함, 내림차순
  - `dailySparkline(ym)` — 일별 합계 배열 (28~31개)
  - `ymOffset(ym, ±N)` / `ymLabel(ym)` / `daysInMonth(ym)`
- **자동 동작**:
  - 영수증 저장 시 viewMonth가 그 영수증의 월로 자동 이동
  - 검색 결과에서 카드 클릭 시 selectReceipt → '내역' 탭 자동 전환
  - 월 네비 이동 시 `selectedId` 클리어, 검색 클리어 (의도 충돌 방지)
- ※ v3.14부터 통계 화면은 기간(이번 달·올해·전체·직접 기간)마다 `renderLedgerPanel`이 그린다. 위 집계 함수는 월 단위 보조용.
- **글자 통일**(v4.13, 사용자 지정): '카테고리별 지출'·'사람별 분담' 모두 섹션 제목 11/600 회색 · 이름 12.5/500(사람별 1위 600) · 금액 12.5/600 · 비율 12/400(1위 파랑 600) · 내 부담 = 금액과 같은 12.5/600 파랑, 앞에 회색 `/`(v4.14). 한쪽만 바꾸지 말 것.
- **내 부담**(v4.12): 카테고리 행 `총 N원 / N원`(내 부담 파랑, v4.14)·막대 진한 부분, 총 지출 카드 한 줄. 계산은 `_myShareOf`(사람별 분담 + 참석자 없으면 결제자가 나/비었을 때 전액). 카테고리 2열은 영역 폭 630px 미만이면 1열(container query) — 화면 폭 미디어쿼리로 바꾸지 말 것(금액 자릿수에 따라 경계가 달라진다).

## 디자인 원칙 (dutchpay.html과 통일)
- **기본은 다크** (v1.71부터). `:root`가 다크 팔레트고 라이트는 `html[data-theme="light"]` 오버라이드.
  - 다크: `--bg:#111213`, `--card:#1e2022`, `--left-bg:#161718`, `--nav-bg:#0D0E11`,
    `--blue:#6264ee`, `--red:#ff5252`, `--green:#34c97d`
  - 라이트: `--bg:#F7F7F8`, `--card:#fff`, `--left-bg:#FAFAFA`, `--nav-bg:#F1F2F6`,
    `--blue:#4355E8`, `--red:#E53E3E`, `--green:#1DAD53`
  - 색은 **반드시 토큰으로** 쓸 것. 하드코딩하면 한쪽 테마에서 깨짐.
- 모서리 `--r:16px / --rm:10px / --rs:9px` (테마 공통)
- 외부 폰트·CDN 없음 — 오프라인 동작 필수
- 카테고리 아이콘은 **24×24 투명 SVG 16종**을 `currentColor` 마스크로 표시. PWA 설치 아이콘만 PNG.
- **모바일 분기는 ≤780px** (`@media(max-width:780px)` 11곳이 주력).
  보조로 900 / 1100+781 / 600 / 520 / 420px. `min-height:700px`는 브레이크포인트가 아니라 최소 높이니 헷갈리지 말 것.
- 데스크톱은 좌·우 2단 그리드
- iOS 자동 확대 방지 (`maximum-scale=1.0,user-scalable=no` viewport)
- ⚠️ **구분선은 항상 완전한 직선 (v3.62 Foundation 불변식)**:
  "Dividers are always straight. Flat rows never use rounded corners.
  Rounded corners are reserved for containers and interactive controls, not separators."
  - **radius 금지**: divider / flat information row(`.rel-li`·`.pd-row`·`.org-row`) / table·receipt·date-group·section·Action Bar separator / 선택된 flat receipt row.
  - **radius 허용**: Card·Modal·Sheet 외곽 / Input·Select·Button / filter chip·badge·toggle·selection circle.
  - ⚠️ **함정**: 클릭 가능 flat row에 `border-radius`를 주면 그 행의 `border-bottom`(divider) 양끝이 곡선으로 보인다.
    hover 피드백은 radius 없는 full-width 사각 tint(`background:var(--fill)`)로 준다. `overflow:hidden` 부모 radius가 내부 divider 끝을 자르지 않는지도 확인.

## ⚠️ 헤더 규칙 (v3.93~ · 모든 탭 · 좌/우 패널 공통 — 매번 다시 묻지 않도록 고정)
- **한 곳에서만 정한다**: 눈썹(`RECEIPT DB`)·버전·제목의 글자·줄 높이·여백은 `index.html` `<style>` 맨 끝 **「v3.93 헤더 규칙(Header Contract)」 블록**이
  좌측 `.side-top`(`.app-eye-row`/`.app-eye`/`.app-title`)과 오른쪽 `.main-top`(`.main-eye-row`/`.main-eye`/`.main-title`)에 **같은 값**으로 건다.
  탭·화면(선불권·통계·사람·영수증 상세 등)별로 크기·굵기·자간·`line-height`·`margin`을 따로 주지 말 것. 새 화면도 이 클래스를 그대로 쓴다.
- **값**: 눈썹 11px/600/`--label3`/대문자/자간 .8px(모바일 .9px) · 버전 10px/600 · 제목 `--fs-page-title`(PC 24 · 모바일 23)/700/`--ls-page-title`/행간 1.2(모바일 1.18) ·
  부제 `.main-sub` 13px/`--label2`. 헤더 상단 여백 PC 28px(좌·우 동일), 헤더 높이 PC 144px(좌측은 `.side-top` 88 + 범위 행 56 = 144 → 좌/우 구분선 한 줄).
- **기준 위치**(헤더 위에서부터, 데스크탑 1280): 눈썹 30 · 버전 28 · **제목 50 · 부제 84**. 모바일 390: 눈썹 14 · **제목 39 · 부제 72**
  (목록형·상세형 모두 같음). **모바일 헤더 아래 구분선도 모든 탭 112px**(v3.98 — 상세형 = `--mobile-head-h`, 목록형 = 제목 + 46px 줄(월 이동·'전체'·총 잔액)). 탭 전용 헤더 높이를 새로 만들지 말 것. 좌측 패널 제목도 화면상 오른쪽 제목과 같은 높이(PC 절대 y 130, 모바일 109).
- **어긋나기 쉬운 곳(실제 이력)**:
  ① 제목 옆에 버튼(기간 선택 38px 등)을 두면 줄이 커져 제목이 내려간다 → `.main-title-row .ledger-period-slot{margin-block:-6px}`처럼 **버튼이 줄 높이를 키우지 않게**(v3.92, 통계 +3px).
  ② 눈썹 자리에 아이콘·버튼(‹ 돌아가기)을 넣으면 줄 높이가 바뀐다 → 눈썹은 **글자**('RECEIPT DB'), ‹ 돌아가기는 헤더 규칙의 `.main-eye .back-to-summary`(줄 높이 13px, 누르는 영역은 padding±8px로 넓히고 margin으로 상쇄)(v3.92~93, 영수증 상세 +6px·사람 +1~2px).
  ③ 버전을 숨길 땐 `display:none` 대신 **자리를 남기는 숨김**(`[hidden]`→`visibility:hidden`, PC) — 안 그러면 눈썹 줄이 18→13px로 줄어 제목이 2px 올라간다.
  ④ 화면 전용 클래스(`.pp-eyebrow` 등)로 눈썹을 새로 만들지 말 것(v3.92, 선불권 굵기·자간 불일치).
- **헤더 오른쪽 버튼**(영수증 상세 [더치페이][되돌리기][저장][삭제]·모바일 [···]·통계 기간·사람 '전체 기간')은 **제목 줄 가운데**에 둔다:
  제목 가운데 = 헤더 위에서 PC 64.4px · 모바일 52.3px. `.main-top>.main-actions`는 헤더 규칙 블록의 `margin-top`(PC 36.4 / 모바일 38.6) + `translateY(-50%)`로
  버튼 높이와 무관하게 맞춘다. 제목 줄 안의 버튼(`.main-title-row`)은 ①의 음수 margin으로 가운데 정렬.
- **검증**: 헤더를 건드리면 Playwright로 1280·390에서 각 탭(통계·영수증 상세·사람·추가·선불권·설정)의 `.main-top` 기준 눈썹·제목·부제 `top`과
  좌측 `.side-top` 제목의 화면 절대 y를 재서 위 숫자와 같은지 확인한다(눈대중 금지 — 1~3px 차이는 눈으로 판별이 안 된다).

## 사람 요약 (v4.15 · 사용자 확정)
- **기준은 '정산 후 실제로 낸 돈'**(사용자는 더치페이로 정산). 1/N + 한턱은 낸 사람 전액 = `_splitShareMap`/`_receiptShare`. 결제액(누가 카드를 긁었나)을 요약 기준으로 되살리지 말 것.
- 몫은 원 단위로 내리고 남는 원을 결제자에게 → 몫의 합 = 총액(`_splitShareMap`, v4.15). 사람별 분담·대시보드 내 부담도 같은 함수.
- 결제 밸런스 카드는 부제 없이 제목 줄 오른쪽에 [전체·단둘이·여럿이](v4.18). 문장('조상현이 ○원 더 냈어요')은 15px/400·숫자 600. 헤더 두 버튼은 높이 32px·같은 너비.
- 순서: 결제 밸런스 → 한턱 → 만남(만남 관리·횟수 타일·만남 간격·자주 간 곳) → 최근 함께한 자리 → 묶이지 않은 영수증 → 관계 그룹. [전체·단둘이·여럿이]가 앞 두 카드를 함께 바꾼다(`_psnSeg`).
- 범례는 탭 줄 오른쪽 한 곳(상대 주황·나 파랑). 카드 안에 이름·범례를 또 넣지 말 것(사용자: 중복이 불편). 문장은 '나/내가' 대신 이름 + `_psnJosa`.
- 목록의 왼쪽 **점**(v4.17, 막대 아님) = **결제한 사람**, 결제자가 두 사람이 아니면 빈 자리로 정렬 유지(최근 함께한 자리·결제 밸런스·한턱·자주 간 곳 모두 같은 규칙, v4.16). 시트 PC 최대 너비 560px.
- **만남 횟수 = `_mtgUnits`**(v4.19): meetingId 만남 1회 + 묶이지 않은 영수증은 같은 날끼리 1회(시간이 새벽 6시 전이면 전날). 시간 없는 다음 날 자동 합치기는 하지 말 것(단둘이는 참석자가 늘 같아 이틀 연속 만남이 합쳐진다). 표시·집계 규칙일 뿐 저장하지 않는다.
- **만남 창 = `_openMeetingsSheet`**(v4.19, [만남 관리]·만남 타일 공통): 날짜 줄 · 첫 가게 외 N곳 · 사람/한턱 · `총액 / 내 부담` · 펼치면 차수+결제자 점. 검색·정렬·이름 칩·'묶이지 않음' 표시·화살표는 사용자와 빼기로 했다(줄을 누르면 펼침). PC는 글자를 구분선 끝에서 12px 안쪽으로, 버튼 왼쪽 끝 = 결제자 점(v4.20). 편집·영수증 직접 묶기는 옛 `_mtgManageOpen` 화면을 쓴다. 그 편집의 '영수증 추가'(`renderAddV`/`paintAdd`)는 맨 위 '이 만남 전후'(±1일) + 고정 검색창(가게·사람·날짜·금액·초성) + 나머지 전체 — 검색창은 다시 그리지 말 것(한글 조합이 끊긴다, v4.22).
- 공동 한턱은 요약에 넣지 않는다(사용자: 이미 분담으로 처리). 결제자 본인을 '제외'한 영수증(예: 내기에서 진 사람 대신 결제)은 정상 입력이다 — 경고하지 말 것.

## 멤버십 탭 (v4.29 · 사용자 확정 — 시안 A, 연간 구독 포함, 기본 카테고리 문화)
- 레일 '선불권' → **'멤버십'**. 범위 행(`#ppScope`)에 [구독 | 선불권](`#ppSeg`, 마지막 선택 localStorage `ppSeg`) + [등록](보고 있는 쪽). 선불권 총 잔액은 목록 머리(`ltInfo`)로. 구독 목록 머리는 '매달 N원 · 1년 N원', 정렬 없음(다음 결제일 순). 목록 줄은 선불권·내역처럼 **아이콘 없이**(v4.31 사용자 요청), 다음 결제일은 **연도 없이** '2월 16일 · D-141'(연도를 넣으면 이름이 잘리고 메타가 줄바꿈됐다), 결제수단 메타는 한 줄 말줄임.
- 선택값은 하나(`prepaidSelectedId`) — `sub_…`면 구독 상세(`sbRenderDetail`), 아니면 선불권. `ppOpen`이 id로 전환 쪽을 맞춘다. 창 저장 뒤 여는 건 `ppOpenRecorded`(비동기라 클릭 기록이 못 잡음 → ‹ 멤버십이 이전 탭으로 가던 것).
- **구독 저장**: settings store `sub:` 기록 — `type:'sub'`(name·amount·cycle month|year·**startOn = 결제일**(매달 N일/매년 M월 N일과 기록 시작을 함께 정함)·endedOn(해지)·category(기본 `영화`=문화)·payMethod·payDetail·deleted·updatedAt), `type:'skip'`(subId·period). 합치기는 `sbMerge`(구독은 updatedAt 최신, skip은 더하기). 삭제는 `deleted:true`(지우면 동기화로 되살아난다). 동기화·백업 필드 `subRecords` — 옛 버전은 모른 채 올리지만 합치기가 더하기라 새 버전 동기화 때 되살아난다.
- **결제 = 영수증**: 결제일이 지나면(오늘 포함) '결제됐나요? [건너뛰기][영수증 등록]'. **저절로 등록하지 말 것**(요금 변경·해지·쉬는 달에 틀린 영수증). 영수증 id `rec_sub_<구독>_<기간>`(두 기기가 같이 눌러도 한 건), `subId`·`subPeriod`·태그 '구독', 참석자 없음(내 부담 = 전액). 사용자가 그 영수증을 지우면 '영수증 지움'(다시 묻지 않음), 다시 등록하면 id 뒤에 꼬리. 확인 창의 금액은 그 결제에만.
- 구독 영수증은 종이 영수증이 없어 '사진 없음'에서 뺀다(`_photoErrorReason`). 31일 결제는 짧은 달 말일.
- 빈 화면(v4.30): 구독이 없으면 안내(`sbGuideHtml`)와 버튼 **하나** — PC 오른쪽 / 폰 목록, PC 왼쪽은 짧은 글. 빈 화면 버튼은 `.sbx-cta`(`.primary-btn`은 추가 화면 전용 모양이라 빈 화면에 쓰면 찌그러진다).

## ⚠️ 숫자 규칙 (v3.84~ · Dutch Pay와 동일 — 매번 다시 묻지 않도록 고정)
- **표기는 `fmtMoney(n)` 하나로**: `Math.round(n).toLocaleString('ko-KR')`(Dutch Pay `fmt`와 동일 — 천 단위 쉼표, 음수는 `-1,000`). 금액 뒤 `원`은 숫자와 붙여 쓴다(`12,000원`).
  새 코드에서 쉼표를 직접 만들거나(`replace(/\B(?=…)/)`) 다른 구분자·약식 표기(`1.2만`)를 쓰지 말 것.
- **글꼴 속성은 `font-variant-numeric:tabular-nums`만**(전역 `html,body`에 이미 있음). ⚠️ **`font-feature-settings:'tnum'` 금지** —
  iOS 시스템 글꼴에서 OpenType tnum을 직접 켜면 쉼표·마침표까지 숫자 폭으로 넓어져 Dutch Pay와 쉼표 간격이 달라진다(v3.37~v3.83 원인).
- **글꼴 스택 = Dutch Pay 금액 글꼴**(v3.90~): `system-ui,-apple-system,'BlinkMacSystemFont','Apple SD Gothic Neo',Arial,sans-serif`
  (전역 `html,body`). Dutch Pay는 금액 클래스(`.sh-num`·`.txn-amt` 등)에 **`system-ui`가 맨 앞인 스택**을 따로 걸어 두었고,
  이 앱은 `-apple-system,'SF Pro Text'`로 시작해 **쉼표 글리프가 달랐다**(v3.84에서 tnum만 고치고 못 잡은 진짜 원인).
  다른 font-family를 새로 지정하지 말고 `inherit`할 것(코드용 monospace 칸만 예외).
  ✅ 사용자 실기기에서 Dutch Pay와 쉼표가 똑같아진 것 확인(v3.90) — **이 스택을 바꾸면 쉼표가 다시 달라진다.**
- **자간**: 숫자는 0이 기본. 20px 이상 큰 숫자만 Dutch Pay 범위(-.2 ~ -.5px). 그보다 더 좁히지 말 것.
- **이름에는 색을 넣지 않는다**(v3.88~ — 기본 글자색). 나/상대 색은 **숫자·막대·범례 점에만**. (목록의 '선택된 항목' 강조는 상태 표시라 예외)
- **색**: 나 = Signature Blue(`--blue` 계열), 상대(관계 분석) = **순수 주황 `--amber`**(라이트 #FF9500 · 다크 #FF9F0A, Dutch Pay `--txn-amber`).
  ⚠️ **어두운 주황(주황+검정 color-mix, #EA580C·#B45309 등) 숫자에 금지.** 음수(할인·환불) = `--red`. 그 외 숫자 = 기본 글자색.

## 테마 전환 (다크/라이트/시스템)
- 설정 탭에 3단 토글: `system` · `light` · `dark` (`[data-theme-choice]` 버튼)
- 선택값은 localStorage `receiptDbTheme`. `system`이면 `prefers-color-scheme` 추종 +
  미디어쿼리 `change` 리스너로 실시간 반영
- `<head>` 최상단 인라인 스크립트가 페인트 전에 `documentElement.dataset.theme`을 세팅 — **FOUC 방지용이니 지우지 말 것**
- `applyTheme()`가 `data-theme` / `data-theme-preference` / `<meta id="themeColorMeta">`(`#111113` ↔ `#F7F7F8`) 셋을 함께 갱신

## 스캔함 — 다중 기기 동시 사용 규칙 (v2.28) ⚠️
여러 기기(폰·다른 컴퓨터의 앱)와 맥 스크립트가 **같이 돌아도 충돌하지 않게** 하는 설계다.
건드릴 때 아래 전제를 깨지 말 것.

### 소유권 — 폴더마다 처리 주체는 하나
| 자원 | 주체 |
|---|---|
| `스캔함/` (+ `완료 JPG/`, `완료 PDF/`) | **앱과 맥 스크립트 둘 다** (v2.33~ 폴더 통합) |
| `receipt-db_inbox.json` | **맥만 씀** — 앱은 읽기 전용 |
| `receipt-db_sync.json`, `images/` | **앱만 씀** |

v2.32까지는 감시 폴더를 아예 분리해 두었지만(맥=`01_Personal/영수증/`, 앱=스캔함),
폴더가 여기저기 흩어지는 원인이라 v2.33에서 `스캔함/` 하나로 합쳤다. 겹쳐도 안전한 이유는
아래 "중복이 안 생기는 이유"와 같다 — 양쪽 모두 **원본 파일 내용의 sha1**로 ID와 `srcHash`를
만들기 때문에 먼저 처리한 쪽의 레코드로 합쳐질 뿐이다.
- ⚠️ **파이썬 스크립트는 맥 한 대에서만 돌릴 것.** 두 대가 같은 폴더를 감시하면
  inbox.json을 양쪽이 써서 Dropbox 충돌 사본이 생긴다. 폴더 분리로 못 막는 유일한 경우다.

### 중복이 안 생기는 이유 (순서를 바꾸지 말 것)
1. **ID가 결정적** — `rec_{YYYYMMDD}_p{sha1(파일내용)[:6]}`. 어느 기기가 처리해도 같은 ID가 나오고
   `_dbxMerge`가 ID로 합치므로 중복 레코드가 원천 차단된다.
2. **`srcHash`(전체 sha1)가 2차 방어** — 기기마다 날짜 산출이 달라 ID가 어긋나도
   `_dbxMerge`와 스캔함 처리 양쪽에서 해시로 같은 영수증임을 알아낸다.
3. **반드시 "레코드 저장 → 파일 이동" 순서.** 이동이 실패하면 파일이 남아 다음에 재처리되지만
   ID가 같아 합쳐질 뿐 유실이 없다. 순서를 뒤집으면 이동 성공 + 저장 실패 시 영수증이 사라진다.
4. **이동 충돌**은 `-2`, `-3`으로 재시도(12회차는 서버 autorename으로 확실히 성공).
   다른 기기가 먼저 옮겨 `from_lookup/not_found`가 오면 오류가 아니라 정상 종료로 본다.
5. **삭제된 영수증은 부활시키지 않는다** — `deletedIds`에 있으면 레코드는 만들지 않고
   파일만 치운다. 안 그러면 파일이 남아 매번 다시 등록된다.

### 기타
- EXIF는 JPEG APP1을 직접 파싱(`_exifDate`) — 외부 라이브러리 금지 때문. 실패하면 null 반환.
- PDF는 앱이 이미지로 못 바꾸므로 **사진 없이 레코드만** 만들고 파일은 등록완료로 옮긴다.
- `.jpg/.jpeg/.png/.pdf` 외 확장자는 손대지 않는다.
- 한 번에 최대 `_SCAN_BATCH_MAX`(20)개만 처리.
- 경로는 `_dbxScanDir()`이 결정한다. 기본값은 데이터 폴더 안
  (`/07_Apps/영수증(RECEIPT-DB)/스캔함`), 설정에서 변경 가능(localStorage `dbx_scan_dir`).
  v2.32는 이걸 앱 최상단 `/스캔함`으로 뺐었는데, 그때 근거는 옛 경로
  (`…/01_Personal/영수증/Receipt_DB/스캔함` + App folder 중첩)가 너무 깊다는 것이었다.
  v2.33에서 데이터 폴더가 `/07_Apps/영수증(RECEIPT-DB)`로 얕아져 그 문제가 없어졌다.
  ⚠️ 그래도 **App folder 권한이면 한 겹 더 접힌다** — 깊게 느껴지면 설정에서 `/스캔함`으로 되돌리면 된다.
- 완료본 경로는 `_dbxScanDoneDir(isImg)` — 스캔함을 어디로 옮기든 **항상 데이터 폴더 안**의
  `완료 JPG` / `완료 PDF`로 모은다. 영수증 관련 파일이 흩어지지 않게 하기 위함.
- 설정 탭 **'위치 확인'** 버튼이 `list_folder('')`로 루트를 읽어 App folder / Full Dropbox 를 판별한다.
  루트에 앱이 만들지 않은 폴더가 있으면 Full Dropbox로 본다.

## PDF 내보내기 = 브라우저 인쇄 (v2.27)
- 외부 라이브러리 금지 원칙 때문에 PDF를 직접 만들지 않는다.
  `buildPrintHtml(ym,{includeItems})` → `#printRoot`에 주입 → `window.print()` →
  사용자가 인쇄 창에서 '대상: PDF로 저장' 선택.
- `#printRoot`는 화면에서 `display:none`, `@media print`에서만 `display:block`.
  인쇄 시 `body>*{display:none}`으로 앱 UI 전체를 숨긴다.
- ⚠️ **인쇄 블록에서는 CSS 토큰(`var(--...)`)을 쓰지 말 것.**
  기본 테마가 다크라 토큰을 그대로 쓰면 검은 배경이 그대로 인쇄된다. 흑백을 직접 지정한다.
- 표는 `table-layout:fixed` + `<colgroup>`으로 폭 고정 — 안 그러면 영수증마다 컬럼 위치가 달라진다.
- `.pr-rec{break-inside:avoid}`로 영수증 한 건이 페이지 경계에서 쪼개지지 않게 한다.
  한 페이지보다 큰 영수증(품목 80개 등)은 어쩔 수 없이 나뉘지만 내용 손실은 없다.
  `thead{display:table-header-group}`이라 표 머리글은 페이지마다 반복된다.
- `#printRoot`는 인쇄 후(`afterprint`) 비운다. 인쇄 시작 시에도 먼저 비워서
  중단된 이전 인쇄 내용이 남지 않게 한다.
- 💡 Playwright로 검증할 땐 `page.pdf()`에 **`margin` 파라미터를 넘기지 말 것** —
  넘기면 CSS와 무관하게 결과가 1페이지로 붕괴해 페이지 분할을 잘못 판단하게 된다.
  `emulateMedia({media:'print'})`도 먼저 호출해야 `#printRoot`가 보인다.

## 한글 IME 주의 (dutchpay에서 학습된 패턴)
- `keydown`에서 `preventDefault()` 호출 시 `e.isComposing` 또는
  자체 `composing` 플래그 둘 다 확인 — 안 그러면 마지막 음절이 버퍼에 남음
- `compositionstart` / `compositionend`로 상태 추적
- 입력 후 blur 처리도 `setTimeout(...,0)`로 한 틱 미뤄야 IME 정상 완료
- 음수 금액 파싱 시 `-` 부호 유의 (할인/쿠폰 항목)

## 음수 금액 표시
- 빨간색 (`--red`) — dutchpay의 `.amt-neg` 클래스 동일 컨벤션
- 합계 계산 시 음수 그대로 더하기 (할인 = 음수 amount)

## 알려진 함정 (작업 시 주의 — 실제로 한 번씩 밟은 것들, 자세한 경위는 CHANGELOG.md)
**데이터·동기화**
- IndexedDB Blob: `imageId`만 receipt에 두고 Blob은 images store에. JSON 백업 때 base64로 직렬화.
- IndexedDB 트랜잭션은 microtask 안에 끝내야 한다 — 중간에 외부 await가 끼면 트랜잭션이 닫힌다.
- 영수증 ID는 기기 간 고유해야 한다(v2.95 — 순번만 쓰던 시절 폰·PC가 같은 ID를 만들어 사진이 덮이고 머지에서 사라졌다).
- 완료 폴더 이동·업로드에 `autorename:true` 금지, 올리기 전 연결 먼저(위 「완료 폴더 규칙」, v4.04).
- 스캔함은 "레코드 저장 → 파일 이동" 순서를 지킨다(아래 스캔함 섹션).
- Dutch Pay 전송 항목(`sendReceiptsToDutchPay`)은 `members`·`watchers`·`treat`까지 보낸다(v3.99). 필드를 바꾸면 dutch-pay `_consumeReceiptDbTransfer`도 같이 본다.
**레이아웃·CSS**
- `.main-body`는 `overflow-x:hidden`(v4.26) — 세로 스크롤러는 `overflow-x`가 자동으로 auto가 돼, 1px만 삐져나와도 iOS에서 화면이 옆으로 밀린다(지출 추이 끝 막대 툴팁).
- 지출 추이 = **짚어 보기**(v4.27): `.lp-canvas-col`에 손을 대고 밀면 x 위치로 칸을 골라 `.lp-cursor`(0.5px 연한 세로선) + 제목 줄 오른쪽 `.lp-hd`에 '날짜 · N건 금액'(v4.28 사용자 선택 — 그래프 안 카드는 손가락·막대를 가려서 뺐다, 손 떼면 `data-note`로 되돌림). 칸 데이터는 `.lp-col`의 `data-l/a/c`. `touch-action:pan-y`라 위아래는 스크롤. 막대마다 툴팁을 다시 넣지 말 것(가는 막대는 못 누르고, 끝 막대 툴팁이 화면 밖으로 나갔다 — v4.26).
- 문서가 아니라 `.main-body`/`.side-list`가 스크롤한다 — `window.scrollY`는 늘 0(v2.67). `html,body{overflow:hidden}`은 프로그램·iOS 시스템 스크롤은 못 막는다(v2.66).
- 모바일 저장 바는 sticky도 fixed도 아니라 **스크롤 컨테이너 밖 flex 형제**(v2.64). fixed는 iOS 키보드에 밀린다(v2.30).
- `backdrop-filter`가 있는 조상 안의 `position:fixed`는 그 조상 기준이 된다 → 시트는 `document.body`로 포탈(v3.29). 포탈한 요소는 `document.getElementById`로 찾는다(v3.73).
- 레일 버튼 규칙은 `.icon-nav`를 앞에 붙인다(`.tab` 규칙과 우선순위 충돌 — v2.62·v3.85). z-index는 쌓임 맥락까지 본다(v2.63).
- CSS 주석 안에 `*/`가 들어가면 다음 규칙이 통째로 죽는다(v3.95). 미디어쿼리 규칙은 덮어쓸 기본 규칙 **뒤에** 둔다(v4.03).
- 클래스 이름 재사용 주의 — `.pp-row`(사람별 분담)와 선불권 행이 겹쳐 모서리가 둥글어졌다 → `.ppw-row`(v3.91).
- 헤더 높이는 `height` 말고 `min-height`, safe-area `env()`는 0이 올 수 있다(v2.56·v2.59). 헤더 수치는 「헤더 규칙」.
- 배경만 고정색으로 두지 말 것 — 배경·글자를 한 쌍의 토큰으로(v2.60). 인쇄 블록엔 토큰 금지(PDF 섹션).
- 접이식 칸(`.section-body`)에 **고정 max-height를 두지 말 것** — 펼침 움직임용 2000px 때문에 긴 검색 구매 이력이 잘렸다(v4.23). 펼친 상태는 `none`, 움직임은 `_bindSectionToggles`가 실제 높이로.
- 항상 DOM에 있는 `.modal-overlay` 등은 존재가 아니라 `getClientRects().length`로 표시 여부를 본다(v2.67).
- 날짜·시간 칸은 직접 그린 글자 + 투명 `date`/`time` input(v4.02). 코드로 value를 넣는 칸은 `_kvHookValue`로 표시를 갱신한다.
**JS**
- 같은 이름의 함수를 두 번 선언하면 뒤의 것이 조용히 덮는다(v3.79 — `_setSaveState` 충돌로 추가 화면 저장이 안 켜졌다).
- `renderDetail`은 동기화 뒤에도 불린다 — 열린 목록 팝업(`.mtg-sheet-backdrop`)을 지우지 말 것(v4.17, 창이 저절로 닫힘).
- 오버레이(시트·모달·drill-down)는 반드시 `_ovPush`/`_ovDismiss`로 history에 올린다 — 안 하면 iOS 뒤로 스와이프가 밑 화면을 건드리거나 새로고침된다(v3.72~73, 유령 오버레이 v3.90).
- 목록 창(`.mtg-sheet`)은 머리 고정(v4.21): 창의 **직계 자식** `.mtg-sheet-hd`·`.pd-filter`/`.mtl-bar`만 sticky(높이는 `_mtgSheetOpen`의 MutationObserver가 `--sh-hd`·`--sh-top`으로). 새 창의 필터 줄도 이 클래스를 창 바로 아래에 두면 자동으로 고정된다. 창 안쪽 여백을 바꾸면 `--shp`도 같이.
- `_openPersonDetailShell`은 title·subtitle을 한 번만 escape한다 — 호출하는 쪽에서 미리 escape하지 말 것(v3.75 `&amp;` 노출).
- drag 중 요소를 DOM에서 옮기면 pointer capture가 풀린다 — translateY로 미리보기(v3.83).
- `JSON.stringify` 결과를 HTML 속성에 그대로 넣지 말 것 → escape 헬퍼. 사용자 입력은 `escapeHtml`(2026-09-27 점검: 매장명·참석자·메모·품목에 HTML을 넣어도 실행 안 됨).
- 이름·품목명 파싱은 파이프(`|`) 구분 — 품목명에 파이프가 있으면 깨짐(실용상 무시).
- 사진 input은 `accept="image/*"`만 — `capture="environment"`를 넣으면 아이폰에서 사진 보관함 선택이 막힌다(v1.57).
- `toast()`는 `{dismiss,remove}`를 돌려준다 — 진행 토스트는 반드시 닫을 것(v4.05 전엔 `remove`가 없어 최대 5분 남았다).
- 한글 IME: 위 「한글 IME 주의」. 검색은 input마다 180ms 디바운스, Enter는 즉시(v3.37).
- 검색 적용(`_applySearchInput`)은 **검색어가 그대로면 아무것도 하지 않는다**(v4.07). 한글 조합 중 결과 카드를 누르면 blur로 `compositionend`·`input`이 늦게 와 같은 검색어가 다시 적용되며 `selectedId`를 지워 상세가 검색 결과로 튕겼다. `selectReceipt`는 대기 중인 검색 타이머를 끈다. Playwright `keyboard.type`은 조합이 없어 재현되지 않으니 composition 이벤트를 직접 보내 검증.

## 현재 상태 (2026-09-27 기준)
- **버전 `v4.31`**. GitHub `sh4sh-ux/receipt-db`(GitHub Pages 배포).
- 데이터: 실데이터 백업 기준 영수증 151건(2025-03 ~ 2026-09), 사진 142장, 선불권 사용. 3,000건 가상 데이터에서도 목록 0.01초·검색 0.1초·사람 화면 0.4초(데스크탑).

### 작업 흐름 (Claude Code 웹 세션)
- 지정 브랜치에서 작업 → 1280·390(+375 입력 후 저장 버튼) Playwright 검증 → `check_app.py` → 커밋·push.
- 사용자가 **"배포"**라고 하면: PR 생성 → squash merge → main 트리 = 검증한 트리인지 확인 → 브랜치를 `origin/main`으로 리셋(`git checkout -B <branch> origin/main` + `push --force-with-lease`).
- `gh` CLI 없음 — GitHub 작업은 GitHub MCP 도구로. 실데이터 백업(sync JSON)은 사용자가 올려 준 파일로만 검증(repo에 없음).
- Dropbox 기능은 Playwright `page.route`로 가짜 Dropbox(목록·업로드·이동·복사·삭제·내려받기, content_hash)를 붙여 검증한다(v4.04 방식).

### ⚠️ 저장소 밖(맥 로컬) — 이 repo에 없음
- `receipt_pdf_to_jpg.py`(`~/Documents/Codex/2026-06-02/pdf-jpg/scripts/`) + LaunchAgent 2개: PDF 영수증 → 완료 JPG/PDF + `receipt-db_inbox.json`(ID `rec_YYYYMMDD_aNN`, `scanPath` 없음 — 앱이 이름·날짜로 원본에 연결한다).
  2026-08-31에 경로를 `/07_Apps/영수증(RECEIPT-DB)`로 고쳤다(백업 `~/Library/LaunchAgents/_backup_20260831_102959/`). `_STORE_NORMALIZERS`의 쉼표 교정(`다이소,강남구청역점`)은 한글 옆 쉼표만.
- 사진(`스캔함`)용 `receipt_png_to_receipt_db.py`는 LaunchAgent가 없다(수동 실행).
- 완료 폴더의 확장자 없는 옛 파일(예: `260716_영수증(119,000)_두레국수`)은 맥 쪽에서 생긴 것으로 보인다 — 앱은 이름을 그대로 두고 연결만 한다.

### 알아둘 것
- **앱은 사진 속 글자를 읽지 않는다(OCR 없음).** 스캔함에서 매장명·금액의 단서는 **파일 이름**뿐(`260809_영수증(5,900)_스타벅스 강남구청정문점.jpg`면 통째로 채워짐, v2.51). 그 외 날짜는 `파일명 → EXIF → 업로드 시각` 순 추정(= 사진 날짜).
- 스캔 등록분을 지우면 같은 사진을 다시 넣어도 재등록되지 않는다(`deletedIds`, 의도된 동작).
- `#r=<base64url(UTF-8)>` 링크로 추가 탭을 채운 채 열 수 있다(v2.53). `#k=<App Key>`는 폰 Dropbox 연결(v2.55).
- 저장공간 영구 보존은 요청만 한다(v4.04) — 허용 여부는 브라우저 몫. Dropbox 미연결 기기는 여전히 그 기기에만 데이터가 있다(빨간 띠 `#connWarn`).
- 같은 날 영수증 정렬은 `date+time+id` — 시간 없는 옛 영수증이 최신순에서 시간 있는 것보다 위로 간다(v4.00).

## 다음 작업 후보 (2026-09-27 점검)
- **카테고리 자동 분류 보강**: `CAT_RULES`에 흔한 매장(스타벅스·이디야·투썸·메가커피·빽다방 / GS25·CU·세븐일레븐·이마트24 / 다이소·올리브영 등) 추가, 술집 `바` → `호프`·`펍`·`포차` 등, 학습 사전의 브랜드(첫 단어) 일치(스타벅스 새 지점 → 카페). `#r=` 링크 카테고리 미분류도 이것으로 해결될 가능성이 크다.
- 같은 날 시간 없는 영수증 정렬(위 「알아둘 것」).
- `.github/workflows/`의 일회성 패치 3개 삭제.
- 호출처 없는 함수 정리: `_dbxPathExists`·`_enhanceStats`·`_fmtDayHd`·`_mtgToggleRow`·`_searchMatchReason`·`_splitModeLabel`·`_treatSummarySentence`·`participantBreakdown`(+ `_peopleBlockHtml`·`_bindPeopleUI`).
