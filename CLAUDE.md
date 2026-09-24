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
- `index.html` — 앱 전체 (HTML/CSS/JS 통합)
- `sw.js` — network-first 탐색 + 오프라인 앱 셸 캐시
- `README.md` — GitHub repo 첫 페이지용 한글 설명
- `CLAUDE.md` — 이 파일
- `icons/` — PWA 아이콘(`icon-192/512.png`, `apple-touch-icon.png`) + 작은 화면용 `icons/categories/*.svg` 16종
- `scripts/receipt_png_to_receipt_db.py` — PNG/JPG 영수증 스크린샷 자동 등록 (맥에서 실행)
- `scripts/check_app.py` — 버전·오프라인 파일·아이콘·정리 상태를 확인하는 릴리스 검사
- `scripts/extract_category_svgs.py` — 이전 Illustrator SVG 정리 도구. 확인 적용된 숙박 자산은 덮어쓰지 않도록 제외

## 버전 관리
- 단일 상수 `APP_VERSION` (JS 상단)이 진실의 원천. DOM 두 군데(좌측 상단 칩, 설정 탭 앱 정보 카드)에 init 시 주입
- 형식: `v메이저.패치2자리` (예: `v1.02`, `v1.10`, `v1.11` ... `v1.99` 후 `v2.00`)
- 변경 시 매번 `APP_VERSION` + 상단 changelog 코멘트 + CLAUDE.md changelog 한 줄씩 갱신
- JSON 백업 파일에도 `appVersion` 필드로 포함 — 어떤 버전에서 만든 백업인지 추적
- IndexedDB 스키마 버전(`DB_VER=2`)과 JSON 백업 포맷 버전(`version:2`)은 앱 버전과 **독립적**.
  세 가지 모두 다른 의미라 헷갈리지 말 것.


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

## ⚠️ Dropbox 데이터 경로 (v2.33~ · /07_Apps 통합)
모든 앱 데이터를 Dropbox `/07_Apps/` 아래로 모으면서 이 앱도 이동했다.

```
/07_Apps/영수증(RECEIPT-DB)/
  스캔함/              — 여기에 사진·PDF를 넣으면 동기화 때 자동 등록된다 (경로 변경 가능)
  완료 JPG/YYYY-MM/    — 등록된 사진(jpg·jpeg·png)이 YYYY-MM-DD_영수증.확장자로 옮겨짐
  완료 PDF/YYYY-MM/    — 등록된 PDF가 같은 규칙으로 옮겨짐
  images/              — 앱이 관리하는 영수증 사진 원본
  backups/             — 수동 전체 백업 JSON
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

### Changelog
- `v3.51` — **영수증 상세 저장 UX를 Desktop+Mobile 공통 상태 시스템으로 개선(기능·데이터·계산 전부 불변).**
  ① 명칭 **'수정 확인' → '저장'**. ② **공통 저장 상태 하나**(CLEAN/DIRTY/SAVING/SAVED/ERROR)를 `_setSaveState`가
  관리 — 데스크탑 헤더 버튼과 모바일 하단 저장 바가 **같은 엔진(`_doConfirm`)·같은 상태**를 공유하고 표현만
  responsive. CLEAN=저장 disabled/neutral, DIRTY=Primary 활성, SAVING='저장 중…'(비활성·중복 차단), SAVED=
  '✓ 저장됨/저장됐어요' 약 1.4초 뒤 CLEAN, ERROR='다시 시도'(자동 사라지지 않음). ③ **Desktop 헤더 유지**
  ([더치페이][되돌리기][저장][삭제], 고정 헤더·divider Y=**224** 불변, 실측: scroll 0/mid/max 모두 224·문서 스크롤 0·
  Content만 scroll). ④ **Mobile 헤더 간소화**: 상단 4버튼 제거 → breadcrumb·상호명(**한 줄 `nowrap+ellipsis`**)·[···]·
  meta·divider만(`.detail-desk-act`를 ≤780px에서 숨기고 `.detail-more-btn` 표시). [···]는 바텀시트(더치페이로 보내기/
  되돌리기/삭제[danger])로 **기존 헤더 버튼 핸들러를 그대로 재사용**(hidden 버튼 `.click()`). ⑤ **Mobile 저장 바**:
  수정(DIRTY)일 때만 하단 nav(68px)+safe-area 위에 `position:fixed`로 표시(Foundation 토큰만, 과한 shadow/gradient
  없음, nav와 겹치지 않음, 390/430 overflow 없음). ⑥ **1회 저장**: focus 유지 상태에서 첫 클릭/첫 탭에 최신 DOM 값까지
  commit 후 즉시 저장(pointerup+click 둘 다 바인딩, `_confirmRunning` 가드로 1회만). ⑦ **DIRTY 감지**: 렌더 완료 후
  `_detailSnapshot()` baseline과 비교해 **실제 값이 바뀌었을 때만 DIRTY**, 원래 값으로 되돌리면 CLEAN(저장 데이터
  모델 재설계 없음). ⑧ **SAVED 기준=로컬 IndexedDB 저장 성공**(Dropbox 동기화는 기존대로 백그라운드), 실패 시 ERROR.
  ⚠️ receipt schema·meetingId·Meeting UI/계산·Dutch Pay payload·normalizeName/receiptPeople/_personRelation/
  _receiptShare/treat/splitExclude·카테고리 팔레트·선불권·Dropbox 구조·다른 화면 정보구조 전부 불변. 검증(실데이터 151건):
  Desktop A~I(CLEAN/DIRTY/원복CLEAN/1클릭·저장중·저장됨·자동복귀/중복방지/reload/divider 224·문서스크롤0) + Mobile
  390·430 A~L(헤더간소화·ellipsis····메뉴·CLEAN無바·DIRTY바·카테고리/한턱즉시DIRTY·focus유지 1탭·저장중·저장됐어요·
  자동사라짐·double탭 1회·reload·nav충돌無·overflow無) + ERROR(다시 시도·미자동소멸·복구) + meetingId row 회귀 없음,
  콘솔에러 0. 변경 파일 `index.html`만.
- `v3.50` — **UI Foundation(역할 기반 디자인 토큰) 정리·적용 — 최소 변경·시각 거의 불변.** 색/구분선/모서리/폼/보조
  그레이는 이미 토큰(`--label/2/3`·`--sep`/`--sep2`·`--r/rm/rs`·`--blue`/`--blue-bg`·`--green/red/amber`)으로 앱 전역
  통일돼 있어, 그 위에 **시맨틱 역할 토큰 계층**을 `:root`에 추가했다: ① **색 별칭**(`--color-primary`·`--text-primary/
  secondary/tertiary`·`--surface`/`--surface-subtle`·`--background`·`--border`(=sep2)·`--divider`(=sep)·`--selected-bg`
  (=blue-bg)·`--danger/warning/success`) — 기존 팔레트 참조라 값 불변. ② **타이포 역할 스케일**(`--fs-page-title` 24/
  모바일23·`--ls-page-title`·`--fs-section-title` 14·`--fs-card-title` 15·`--fs-body` 14·`--fs-secondary` 13·`--fs-caption`
  11·`--fs-amount` 20·`--fs-large-amount` 26/모바일25 + `--fw-strong/med/reg`). ≤780px에서 크기만 responsive 재정의
  (역할·weight·색은 데스크탑과 공통). ③ **스페이싱 스케일** `--sp-1..8`(4·8·12·16·24·32), ④ **컨트롤 높이** `--ctl-h`
  36·`--input-h` 40. 공유 역할 셀렉터를 토큰으로 재배선(값 현행 유지): `.main-title`(모든 뷰 공통 페이지 제목)·`.main-sub`·
  `.section-hd`·`.field-lbl`·`.kv-lbl`·`.field-inp/sel/ta`·`.kv-inp`·`.detail-header-btn`(height/border/색). 페이지 제목의
  흩어진 크기(base 22 / desktop 24 / 모바일 22·23 혼재, 죽은 규칙 포함)를 토큰 하나로 통합 → **데스크탑 24 / 모바일 23**
  단일 규칙. ⚠️ **카테고리 팔레트·좌측 브랜드 `.app-title`·정보구조·계산(normalizeName/receiptPeople/_personRelation/
  _receiptShare/treat/splitExclude)·Dutch Pay payload·meetingId·레이아웃(데스크탑 3단·고정 헤더·모바일 page/내부 스크롤)·
  [수정 확인] 1회 저장 로직 전부 불변.** 신규 색테마·gradient·glassmorphism·그림자/카드 남발 없음. 검증: 데스크탑+모바일
  (390·430) 전 화면(통계·내역·상세·추가·사람분석·선불권·선불권상세·설정·meeting·Dutch Pay) 스크린샷, 헤더 divider
  Y 고정(스크롤 0/중간/끝 동일), 수정확인 1회 저장·계산·콘솔에러 0·가로 overflow 없음. 변경 파일 `index.html`만.
- `v3.49` — **[수정 확인] 1회 클릭 저장 근본 수정 + 오른쪽 헤더 고정 실측 확인(레이아웃 코드 변경 없음).**
  ⚠️ **근본 원인**: 상세 '수정 확인'의 '수정됨' 성공 피드백(`toast`+`_flashSaved`)이 로컬 `dbPut` 직후가 아니라
  **Dropbox 네트워크 3종**(`_autoRenameCompleted`·`_dbxRenameScanFile`/`_dbxArchiveReceiptPhoto`)을 `await`한
  **뒤**에 있었고, 내부 `try`에 `catch`가 없어 미연결/지연/예외 시 **로컬 저장은 됐는데 피드백이 안 떠** 두 번 눌러야
  했다. **수정**: `_doConfirm` 재구성 — 포커스 input `blur`→값 commit→로컬 `dbPut`→**즉시 '수정됨'+'저장됨 ✓'
  피드백 및 재렌더**, 완료본 이름 정리·`dbxSyncNow`는 새 `_detailBackgroundSync`로 **후속(백그라운드, catch)**.
  저장 시작 시 버튼 `disabled`(중복 저장·pointerup+click 이중 발화 차단), 저장 완료 시 `_flashSaved`가 버튼 재활성
  (⚠️ `.main-top`은 정적이라 `renderDetail`이 버튼을 재생성하지 않음 — 반드시 직접 재활성/복원), 예외 시 `finally`
  에서 `_restoreConfirmBtn`. 검증(실데이터): 매장명·날짜·카테고리·결제수단·참석자·**포커스 유지 메모** 각 1클릭
  저장, 빠른 2회 클릭 시 '수정됨' 1회만, reload 유지 — 데스크탑·모바일(390) 모두 PASS, 콘솔에러 0.
  ✅ **오른쪽 Detail 헤더/​divider 고정은 이미 기존 구조로 충족**(코드 변경 없음): `.main{height:100%;overflow:hidden}`
  → `.view.on{flex column;height:100%}` → `.main-top{flex:0 0 144px}` → `.main-body{flex:1;overflow-y:auto;min-height:0}`.
  긴 영수증(scrollHeight 1832 vs client 545)에서 `.main-body` scrollTop 0/중간(643)/최대(1287) 모두 헤더 divider
  Y=**224 동일**·actions top=108 고정·문서 스크롤 0으로 실측 확인. 좌측 주 divider(월네비 아래)도 Y=224로 이미 동일
  (1px `--sep`); 좌측 검색/정렬 툴바 구분선(Y=331)은 목록 구분용으로 그대로 유지. 모바일은 기존 구조 유지(변경 없음).
  meetingId·Dutch Pay payload·normalizeName/receiptPeople/_personRelation/_receiptShare/treat/splitExclude 전부 불변.
  변경 파일 `index.html`만.
- `v3.48` — **만남 생성/상세 마감 다듬기(계산·저장구조·Dutch Pay payload 불변).** ① **만남으로 묶기 생성 확인창에
  경고 2종**(차단 아님, 그대로 진행 가능): 선택 영수증들의 **날짜 차이가 3일 이상**이면 '날짜 차이가 N일로 커요 — 같은
  만남이 맞는지 확인해 주세요'(자정 넘김 1일은 정상이라 제외), 선택 영수증에 **공통 참석자가 전혀 없으면**(각 receipt
  `receiptPeople` 교집합이 공집합) '공통 참석자가 전혀 없어요 — 서로 다른 자리일 수 있어요'. 경고는 확인창 안 노란
  배지(`--toast-warn`+흰 글자)로만 표시하고 묶기는 사용자가 진행. ② **데스크탑 만남 상세 모달 폭·여백 정제**
  (`.mtg-sheet` max-width 360→400·padding 18→22·그림자 강화, 제목 16px+자간, 항목 padding/gap 상향, × 버튼 hover).
  모바일 하단 시트는 그대로. 계산/데이터/저장구조/Dutch Pay payload/분리·전송 로직 전부 불변. 변경 파일 `index.html`만.
- `v3.47` — **만남 연결 UX (영수증 상세 ↔ meetingId ↔ 더치페이).** Receipt=작업단위·Meeting=meetingId 관계·
  Dutch Pay=선택 receipt 전송, 셋을 섞지 않는다. ① **영수증 상세 연결 row**: `meetingId`가 있고 같은 만남 영수증이
  **2건 이상**이면 상세내역 카드 아래에 **얇은 연결 row**(`.mtg-row`, 연한 blue surface·shadow 없음·작은 link 아이콘)
  — 'M월 D일의 만남 · 영수증 N건 · 합계원', 자정 넘김은 'M월 D일 ~ D일의 만남'(달 다르면 둘째에도 달). 날짜/건수/합계는
  같은 meetingId 영수증에서 **동적 계산**. 현재 receipt가 항상 주인공(큰 Meeting Card 없음). ② **만남 상세 시트**(row 클릭
  → 데스크탑 중앙 카드 / 모바일 하단 시트, `.mtg-sheet` body 포탈): 제목·날짜·건수·합계 + **참석자 union**(각 receipt
  `receiptPeople` 합집합·정확일치·원본 participants 불변·별도 저장 없음) + 영수증 목록(현재 열람분 `.cur` 강조) + 개별
  클릭 시 기존 `selectReceipt`로 전환 + **[이 영수증을 만남에서 분리]**(현재 receipt만 `meetingId` 제거, `_mtgConfirm`
  확인 후 `dbPut`+`updatedAt`+동기화). '만남 삭제'는 없음(Meeting은 관계라 분리만). ③ **더치페이 범위 선택**: 현재
  receipt에 meetingId(2건+)가 있으면 [더치페이] 클릭 시 **범위 선택 시트**(①현재 영수증만[**기본**] ②이 만남의 모든
  영수증 ③직접 선택) → 기존 전송 경로로 라우팅. meetingId 없으면 기존 단일 전송 그대로. **자동 전체 전송 없음**(명시
  선택만). '직접 선택'은 만남 영수증 체크리스트(기본 전체 선택, 실시간 건수·합계). **selection 진실원=receipt.id**. 현재
  영수증만→`sendReceiptsToDutchPay([r],{single:true})`, 만남 전체→`sendReceiptsToDutchPay(meetingRecs)`, 직접→선택
  `receipt.id` 목록. ⚠️ **Dutch Pay payload 불변**(sourceId/store/date/total/payer/people/items/receiptImage, meetingId
  미추가), 새 정산 엔진 없음. Rail+왼쪽 목록+오른쪽 상세 3단·모바일 상세·Bottom nav 불변. 시트는 renderDetail 진입 시
  잔재 제거(body 포탈 정리). **계산 전부 v3.46과 동일**(normalizeName/receiptPeople/_personRelation/_receiptShare/
  단둘이·여럿이·상대·내 결제/한턱/참석부담/treat/splitExclude). meetingName/meetingDate/meetingParticipants/Meeting
  object/round/payee/treatBy/migration·만남 횟수 통계 **미도입**. 검증: meetingId 없는 상세=기존 동일, 연결 row·자정 넘김
  범위·건수/합계·만남 상세 목록·참석자 union·receipt 이동·현재 분리·더치페이(현재/전체/직접·기본값 현재·payload 불변)·
  Desktop 3단·Mobile 390/430 overflow 없음·사람별 계산 불변·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.46` — **만남으로 묶기(meetingId) 1단계 — 수동 다중 선택.** 사람별 결제 분석 화면의 **결제 내역/참석 내역**에서
  **[선택] 버튼**을 눌렀을 때만 선택 모드로 전환(행마다 원형 체크박스), 영수증을 여러 개 골라 **같은 `meetingId`를
  부여(만남으로 묶기)**하거나 **해제(만남에서 분리)**한다. **원본 영수증은 그대로** — 병합·삭제·마이그레이션·자동추정·
  만남통계 **전부 없음**. optional `meetingId` 필드만 추가/삭제. 선택은 **`receipt.id` 기준**(결제·참석 중복 없음),
  **2건 이상**부터 [만남으로 묶기] 활성. 저장은 **`dbPutMany` 단일 IndexedDB 트랜잭션**(원자적 — 실패 시 in-memory
  롤백 + 에러 토스트, 부분 저장 없음). **서로 다른 날짜(자정 넘김 포함)도 경고·제외·날짜보정 없이** 묶임(확인창에
  `_mtgDateLabel` 날짜 범위 표시). 만남 이름 '○○과의 만남'은 **표시 전용**(현재 검색 대상, 저장 안 함 — `meetingId`만
  저장). 묶인 영수증엔 **작은 '만남' 태그**(기존 토큰 pill, 금액/매장명보다 작게). **이미 다른 만남 포함 시** '이미 다른
  만남에 포함됨' 확인창([취소]/[새 만남으로 이동]) 통과해야만 `meetingId` 덮어씀. `meetingId`는 기존 `_validateReceiptRecord`
  (`{...raw}` 보존)·`_dbxMerge`(`updatedAt` 최신 우선) 경로를 그대로 타 동기화/백업/import에 실림(재설계 없음, 미연결
  기기도 로컬 동작). 검색 변경·검색 해제·탭 이동 시 선택 모드 자동 종료. **모바일 액션바는 하단 nav(68px)+safe-area 위
  고정**, `#detailBody` 하단 여백으로 마지막 행 안 가림. ⚠️ **계산 전부 v3.44와 동일(불변)** — `normalizeName`/
  `receiptPeople`/`_personRelation`/`_receiptShare`/단둘이·여럿이·상대결제·내결제·한턱·참석부담·`treat`/`splitExclude`,
  헤더 '함께한 영수증 41건'. round/1차2차/시간입력/treatBy/payee/만남횟수 통계 **미도입**. 검증: 실데이터 151건 신유철
  묶기 전=후 스냅샷 완전 동일(내결제 27/2,453,500·단둘이 10·여럿이 17·상대단둘이 9·한턱 399,600/8·참석 595,884·
  together 41), 2건 동일 meetingId·IndexedDB 반영·'만남' 태그·분리·이미다른만남 확인·콘솔에러 0, 데스크탑/모바일
  (390·430) 가로 overflow 없음. 변경 파일 `index.html`만.
- `v3.45` — **단둘이 Hero 우측 건수 라벨 문구만 변경**: '19건' → **'영수증 19건'**(meetingId가 없어 '만남 횟수'가
  아니라 영수증 건수임을 명확히, 오해 방지). 숫자는 기존 동적 계산값(`duoCnt`) 그대로, 계산·레이아웃·데이터·다른
  문구 전부 불변. 데스크탑/모바일 '영수증 19건' 표시 확인, 콘솔에러 0. 변경 파일 `index.html`만.
- `v3.44` — **사람 분석 화면 미세 polish(계산·데이터·구조 불변).** ① 단둘이 Hero 제목 '단둘이 있을 때'→**'단둘이
  만났을 때'**, 보조문구 →**'함께한 자리의 결제'**(19건·금액·비율 Bar 그대로). ② **데스크탑 여럿이/전체**: 설명문
  제거 + 값 **인라인 한 줄**('신유철 0원 · 0건' / '나 1,948,500원 · 17건')로 compact(`.rsv` row + `em::before` 중점).
  ③ **모바일**: 여럿이/전체 세로여백 축소(2열 stacked 유지, 중점 없음), **한턱/참석부담을 list row**(제목 왼쪽·금액
  오른쪽·보조정보 아래, `.rel-ins` grid). transaction list(`.person-txn`)·헤더·기간 드롭다운·divider·색·계산 전부
  불변. 검증: 실데이터 151건 신유철 값 전부 동일(단둘이 431,900/9·505,000/10·비율 46/54·여럿이 0/1,948,500·
  전체 431,900/2,453,500·한턱 399,600/8·참석 595,884/32), 불변식 PASS, 데스크탑/모바일(390·430) 스크린샷·가로
  overflow 없음·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.43` — **사람 분석 화면 최종 정제(계산·데이터 전부 불변).** Card 남발 → 위계로: **단둘이만 Hero**(연한 blue,
  세로 여백 ~15% 축소, 상대/내 결제 + 결제금액 비율 Bar '금액 기준 비율'), **여럿이·전체는 plain row**(카드 배경/
  테두리 제거, 하단 divider만), **🎉 한턱·참석 부담액은 slim insight**(큰 컬러 카드 제거 → 투명 배경 2열 + 사이 세로
  divider, 🎉·장식 제거). **기간 드롭다운을 본문 상단 → 헤더 우측 슬롯**(`#ledgerPeriodSlot`, 제목 옆)으로 이동해
  전용 줄 제거(pills는 `#ledgerPeriodSlot`에서도 바인딩). **'전체'의 합산 건수(36) badge 제거** — 관계 대표 count는
  헤더 '함께한 영수증 N'. **모바일**: 기간 전용 줄 제거, 여럿이/전체 plain row(stacked), 한턱/참석부담 세로 slim,
  결제·참석 내역을 **compact transaction list**(`.person-txn` + `.txn-store/.txn-amt/.txn-date/.txn-sub`, 모바일에서만
  표→리스트, 데스크탑 표는 그대로; 날짜검색 패널 등 다른 `.srch-table`은 불영향). Header divider·Dropbox 배너·
  Bottom nav·Navigation Rail·왼쪽 목록 불변. 계산(`_personRelation`/`_receiptShare`/treat/splitExclude)·데이터·검색·
  기간로직 전부 불변. meetingId/round/treatBy/payee/migration·새 dependency 없음. 검증: 실데이터 151건 신유철
  단둘이 431,900/9·505,000/10·비율 46/54(합100)·여럿이 0/1,948,500·전체 431,900/2,453,500(36 badge 없음)·한턱
  399,600/8·참석 595,884/32, 불변식 PASS, 기간 헤더슬롯·plain row·투명 insight 확인, 모바일 390/430 가로 overflow
  없음·transaction list·스크롤·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.42` — **사람별 결제 분석 화면 재디자인(계산·데이터 전부 불변, v3.41 검증 함수 그대로).** 회계 비교표(2×3)를
  위계형 카드로 교체. ① **단둘이 Hero**(연한 blue surface): '단둘이 있을 때' + 건수 + 상대/내 결제 금액(내 결제만
  blue accent) + **결제금액 비율 Bar**(상대%/나%, `금액 기준 비율` 라벨, 반올림 후 합 100% 보장, **분모 0이면
  Bar 숨김**=neutral empty). ② **여럿이/전체 compact row**(상대·나 두 값, 0원은 Secondary 톤). '전체'=단둘이+여럷이,
  **상대가 나 없이 결제한 건은 제외**(있으면 note로 '결제 내역' 안내). ③ **🎉 내가 한턱 · 참석 부담액** supporting
  insight 카드(subtle tint) — 한턱은 내 결제의 **부분집합이라 합산 안 함**, 참석 부담액 문구 '다른 사람이 결제한
  자리에서 N의 몫'. **기간 UI**: 상단 긴 pill 나열 → **우측 드롭다운**(`_personPeriodBarHtml`, 기존
  `_personFilterPillsHtml`/`_personTimeFilter`/`_applyPersonTimeFilter` 재사용 — 새 기간 기능 없음, 기간 변경 시
  Hero·여럿이·전체·한턱·참석부담·내역 전부 동기화). 헤더 소제목 '함께한 영수증 N · 상대 결제 N'. ⚠️ 각 헤더 건수는
  tgt·me 결제 합집합(단둘이 19 + 여럿이 17 = 전체 36, '함께한 영수증 41'과는 다름 — 41은 3rd-party 결제 포함).
  장식(맥주·손글씨)·새 아이콘·chevron 미도입, 색 전부 토큰(insight만 subtle tint). **모바일**은 축소 표가 아니라
  stacked 카드(한턱/참석부담은 2열 compact), `_personViewActive`/`_syncMobileSurface`(v3.41) 그대로 — 페이지 스크롤·
  Bottom nav·가로 overflow 회귀 없음. 계산/저장/검색/기간로직/`_receiptShare`/treat/splitExclude/결제·참석 내역/
  다른 화면 불변. meetingId/round/treatBy/payee/migration 미도입. 실데이터 확인: '이용일'≠'와이프(이용일)'(다른
  사람·정확일치 유지), 지급기록·paidBy 누락 자동보정 안 함. 검증: 실데이터 151건 신유철 단둘이 상대 431,900/9·
  나 505,000/10·비율 46/54(합100)·여럿이 상대0·나 1,948,500/17·전체 상대 431,900/9·나 2,453,500/27·한턱 399,600/8·
  참석 595,884/32, 4명 불변식(내 결제=단둘이+여럿이, 상대 함께결제=단둘이+여럷이, 건수·금액) PASS, 정대원 단둘이
  0원→Bar 숨김, 기간 드롭다운 동기화(전체 41→9월 3), 데스크탑·모바일 스크린샷, 콘솔에러 0. 변경 파일 `index.html`만.
- `v3.41` — **사람 검색 대시보드 UI 정리 + 모바일 노출 복구(계산 불변, v3.40 검증 함수 그대로).**
  통합 대시보드(결제자+참석자) 히어로를 **'단둘이/여럿이/전체 × 상대 결제/내 결제' 2×3 비교표**로 재구성.
  가장 직접적인 **단둘이** 행을 맨 위·soft blue surface로 미세 강조, **전체=단둘이+여럿이**. ⚠️ 관계표의
  **'상대 결제 전체'는 '나와 함께 있었던 상대 결제'**(receiptPeople에 나 포함)만 — **나 없이 상대가 결제한
  건은 제외**하고 별도 note로 '결제 내역'에서 볼 수 있게 안내(A=상대 전체결제/B=나와 함께 구분, §7).
  🎉 **내가 한턱**은 내 결제의 부분집합이라 합산 않고 작은 accent(+단둘이/여럿이 보조), **참석 부담액**
  (`_receiptShare` 불변)은 비교표 아래 보조 영역으로 분리. 헤더 소제목 '결제 N·참석 N'→**'상대 결제 N ·
  함께한 영수증 N'**(receiptPeople에 나+상대 모두 포함). 계산은 새 공유 헬퍼 `_personRelation()`(정확일치,
  검색 UX는 부분일치 유지 — v3.40 원칙) 한 곳에서. **모바일**: 인물 대시보드가 그동안 아예 안 뜨던 것 복구
  (`_setMobPersonView`가 `!_isMobileLayout()`로 게이트돼 모바일에서 무력화 + v3.37 표면 시스템과 충돌).
  `_personViewActive` 플래그를 `_syncMobileSurface`가 읽어 **`mob-person-view`(검색창 아래 요약 → 목록 순
  flex column, 페이지 전체 스크롤)** 로 표시. v1.30 이후 side에 추가된 photo-filter/list-toolbar/batch-bar가
  order 없이 맨 위로 튀던 것과 그리드 트랙에 main이 잘리던 것(flex column으로) 함께 해결. 모바일은 표 축소가
  아니라 compact 그룹(단둘이/여럿이/전체별 상대·내 두 줄, 이름 ellipsis). 색은 기존 토큰(내 결제=Blue accent,
  상대=neutral, 한턱 accent 재사용), 헤더 구분선·결제/참석 내역·정확일치·receiptPeople·treat/splitExclude/
  저장구조/검색/기간필터 전부 불변. meetingId/round/만남추정/treatBy/migration 미도입. 실데이터 확인:
  '이용일'≠'와이프(이용일)'(서로 다른 사람=여럿이 정확), 지급기록·paidBy 누락 자동보정 안 함. 검증: 실데이터
  151건, 신유철·이정환·김영석·정대원 4명 불변식(내 결제=단둘이+여럿이, 상대 함께결제=단둘이+여럿이, 건수·금액)
  전부 PASS, 나없이 결제 제외+note(합성 검증), 데스크탑 1280·모바일 390 스크린샷, 콘솔에러 0. 변경 파일 `index.html`만.
- `v3.40` — **[STEP A] 인물 검색 사람별 금액 집계 정확도.** 통합 대시보드(결제자+참석자) 히어로를
  **관계 카드 2개**로 재구성: ① **[상대 결제]**(대상이 결제한 영수증 총액·건수, 그중 나와 **둘만**/**여럿** 분리),
  ② **[내가 결제 · 대상과 함께]**(내가 결제 & 대상 참석, 둘만/여럿 분리 + 🎉 **내가 한턱** 액센트 — 여럿의 부분집합,
  중복 합산 없음). 그 아래 **참석 부담액**(기존 `_receiptShare` 합, 계산 불변)을 보조 라인으로. **핵심: 검색 UX는
  부분일치(`includes`) 유지, 집계는 정확일치(`normalizeName(a)===normalizeName(b)`)로 분리** — 새 헬퍼
  `normalizeName()`/`receiptPeople()`(참석자+결제자 정규화 Set, 빈값 제외, **읽기 시점 계산·원본 불변**).
  '둘만/여럿'은 `receiptPeople` 집합 크기로 판정(participants.length 아님). 부분질의는 pool 후보 중 유일하게
  포함하는 이름으로 해석해 대상 확정 후 정확일치 집계. 참석 전용 패널 라벨 '분담 총액'→'**참석 부담액**'(계산 불변).
  ⚠️ meetingId·차수·만남 추정·treatBy·자동병합·마이그레이션 **없음**('만남 횟수' 대신 '함께한 영수증 N건'). treat/
  splitExclude/_receiptShare/_participantSplit 계산 **불변**(회귀 byte-identical). 검증: 불변식 내 결제=둘만+여럿
  (금액·건수) PASS, 정확일치 집계·부분검색 UX·기존 데이터 불변·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.39` — **'참석만 한 사람(분담 0원)' 표시.** 한턱/제외로 기간 내 분담 총액이 0이라 사람별 분담 막대에는
  안 나오는 참석자를, 섹션 하단에 **회색 칩**으로 보여준다(`_attendedOnly`=`_participantSplit`(분담>0)에 없는
  참석자, `_attendedOnlyHtml`). 칩은 기존 `[data-ppname]` 위임 핸들러로 **클릭 시 그 사람 인물 검색**. 두 렌더
  경로(`renderLedgerPanel`=recs / `renderMonthSummaryHtml`=receiptsForMonth) 모두 적용. 또 **인물 검색**에서
  그 사람의 분담 총액이 0이면 '분담 총액' 카드에 **'참석만 함' 배지** + '한턱·제외로 분담 0원(참석은 함)' 안내를
  달아 0원이 버그가 아님을 명확히(순수 참석자 요약 경로). 계산·데이터 불변(표시만). 검증: 참석만 칩·클릭 이동·
  순수 참석자 배지·콘솔에러 0. 변경 파일 `index.html`.
- `v3.38` — **후속 피드백 7건.** ① **수정확인 '두 번 눌러야' 재수정** — iOS에서 `click`이 포커스/IME 확정·
  키보드 내림 제스처에 첫 탭이 먹히는 경우가 있어 **`pointerup`에도 저장 핸들러를 바인딩**(첫 탭에 저장,
  `_confirmRunning` 가드로 1회만 실행). v3.36의 `onmousedown preventDefault`(iOS서 오히려 첫 탭 삼킴)는 제거.
  저장 뒤 버튼을 잠깐 **'저장됨 ✓'(초록)** 으로 바꿔 저장 전/후를 분명히(저장바 항상 표시 유지). ② **모바일
  기간시트 날짜칸 회귀 수정** — v3.37의 `-webkit-appearance:none`이 '년/월/일' 안내·높이를 없앴다 → 제거하고
  **`min-width:0`로만** 오버플로 방지(네이티브 렌더 복원). ③ **모바일 '기간' 버튼 폭·높이 확대**(min-width:104px,
  h38, 가운데). ④ **지출 추이 칸 탭 → 툴팁 고정(pin)** — 손 떼도 남고 다른 곳 탭하면 닫힘(hover도 그대로).
  ⑤ **좌(side-foot)·우(추가 액션바) 하단바 높이 82px로 정확히 일치**(actions `min-height:82`+`padding:0 32`,
  border-box) → 구분선 정렬. ⑥ **선불권 헤더를 다른 탭과 통일**(prepaid.css: `--mobile-head-h`·safe-area 상단여백·
  `align-items:flex-start`·눈썹 간격/두께) → 더 이상 따로 안 놈. ⑦ **iOS 뒤로가기 스와이프가 새로고침 되던 것**
  — 당겨서새로고침이 **화면 가장자리 시작(28px)·가로 우세 제스처는 양보**(preventDefault 안 함)해 back-swipe 보존.
  검증: 데스크탑 1회클릭 저장·가드·높이 82=82, 모바일 기간버튼 108px·날짜칸 네이티브·추이 pin·선불권헤더 124=124·
  콘솔에러 0. 변경 파일 `index.html`·`prepaid.css`.
- `v3.37` — **사용자 피드백 10건 일괄 반영.** ① **상세 '수정 확인' 두 번 눌러야 저장되던 것 근본 수정** —
  저장바(`#detailSaveBar`)가 `_detailDirty`일 때만 보였는데, 편집 직후 **백그라운드 동기화의 `renderDetail`이
  `_detailSetDirty(false)`로 버튼을 숨겨** 첫 클릭이 허공에 떨어졌다. `_detailSetDirty`를 **영수증이 열려 있으면
  항상 `display:flex`**로 바꿔 근본 제거(저장은 멱등이라 안전). ② **검색 디바운스 안전판** — v3.36의 음절별
  compositionend 의존을 버리고 **조합 여부와 무관하게 input마다 현재 합성값을 180ms 디바운스 적용**('김승환'을
  쳐도 중간값 '김승호'가 고착되던 회귀 수정, Enter 즉시). ③ **왼쪽 목록**: 일 헤더('5월 25일')와 품목 매칭 줄
  제거 — 카드에 이미 결제일자가 있고 품목 줄(이름을 품목에 적는 사용법)이 혼란스러웠음. **월 헤더만 유지.**
  ④ **홈 로고(app-title/navBrandBtn) → 해당 월 대시보드**(`_mobileListMode='stats'`+`_ledgerTimeFilter=month`).
  ⑤ **모바일 기간 바텀시트 날짜칸 우측 오버플로 방지**(iOS `input[type=date]`에 `-webkit-appearance:none;min-width:0`).
  ⑥ **사람별 분담: 이름뿐 아니라 행 전체 클릭 → 인물 검색**(`.pp-row[data-ppname]`, 위임 핸들러 `[data-ppname]`).
  ⑦ **사이드푸터·추가 액션바 높이 1.5배**(side-foot 55→82px, actions padding 9→23px) + **가운데 정렬**
  (`justify-content:center`). ⑧ **분담 칩 이름↔태그 여백**(gap 6→9px). ⑨ **참석 내역 인원·분담금 우측정렬**
  (th/td `text-align:right`). ⑩ **전역 `tabular-nums`**(더치페이식 숫자·콤마 폭 정렬, `html,body`). 검증: 데스크탑
  1280·모바일 390 스크린샷 + 저장바 항상표시·행 클릭·날짜칸 비오버플로·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.36` — **한글 IME 관련 버그 2건 수정.** ① **검색이 '신유'(2글자)에서 먼저 적용되던 것**: 한글은 음절마다
  `compositionend`가 떠서('신'→'신유'→'신유철') 중간 상태가 검색에 반영돼 부분매칭 결과가 번쩍였다. 검색 적용을
  **180ms 디바운스**(`_scheduleSearch`)로 묶어 빠르게 타이핑하면 마지막 상태만 반영되고, **Enter는 즉시 적용**
  (`keydown` `!isComposing`). `_clearSearch`에서 타이머 취소. ② **상세 '수정 확인'을 두 번 눌러야 저장되던 것**:
  입력칸에 포커스(특히 IME 조합)가 있을 때 버튼 첫 클릭이 blur·IME 확정 제스처에 먹혔다. 버튼 `onmousedown`에서
  `preventDefault()`로 **포커스 훔치기를 차단**해 첫 클릭이 그대로 저장으로 이어지게 하고, 핸들러 시작에서
  `document.activeElement.blur()`로 조합을 확정한 뒤 값을 읽는다. Playwright로 재현·검증(빠른 타이핑 시 중간
  '신유' 미적용·Enter 즉시·1회 클릭 저장), 계산 회귀·e2e·Dutch Pay 불변. 변경 파일 `index.html`만.
- `v3.35` — **사람별 분담 정확도: 한턱(treat)·깍두기(제외, splitExclude) + 이름 변경/클릭.** 참석은 했지만
  비용을 안 낸 사람을 0원으로 정확히 잡기 위한 기능. ① **계산 단일 진실원**: `_ppSplitters`/`_receiptShare`/
  새 `_participantSplit`(index.html ~3122)로 통일. `treat`=결제자 전액·나머지 0원, `splitExclude`=참석 유지·분담 0원
  (나머지끼리 1/N). **두 필드 모두 선택적·후방호환** — 없으면 예전 1/N과 **byte-identical**(회귀 테스트 `verify_split.js`로
  증명: 기존 데이터 `_participantSplit`/`_receiptShare` 동일 + 총액 보존). 인물 검색 분담금 5곳도 `_receiptShare`로 교체.
  ② **UI**: 추가 폼·상세 폼에 '분담 방식' 블록(🎉 한턱 스위치 + 참석자 칩 분담↔제외 토글, `_makeSplitUI` 공용
  컨트롤러). 저장 시 참석자에 실제 있는 이름만 남기고 꺼진 값은 필드 자체를 제거(오염 방지). import 새니타이저도
  타입 표준화(불리언·문자열배열). ③ **'참석자별 분담'→'사람별 분담'** 이름 변경 + 적응형 부제(1/N 균등 / 한턱 N ·
  제외 N 반영). 이름에 점선 밑줄 → **클릭 시 그 사람 인물 검색**(`_goPersonSearch`, 기존 검색 재사용). ④ **Dutch Pay
  연동 불변** — `sendReceiptsToDutchPay` 엔트리는 고정 필드(sourceId·store·date·total·payer·people·items·receiptImage)만
  매핑, treat/splitExclude 누출 없음(테스트로 확인). 검증: 계산 회귀 + e2e(부트·패널·인물검색 0원·이름클릭·저장
  영속화·Dutch Pay·콘솔 에러 0) 전부 통과, 데스크탑·모바일·라이트/다크 스크린샷 확인. 변경 파일 `index.html`만.
- `v3.34` — **지출 추이 막대 터치 영역 확대(모바일 호버/탭 개선).** 막대(`.lp-bar`)가 금액이 작으면 높이가
  3~4px라 손가락으로 정확히 눌러야 툴팁이 떴다. 각 막대를 **세로 전체 높이의 투명 칸(`.lp-col`)**으로 감싸고
  호버/툴팁 트리거를 `.lp-bar:hover`→`.lp-col:hover`로 옮겨, **칸(=하루/한 달 폭 × 플롯 전체 높이) 어디를 눌러도**
  툴팁이 뜬다. 막대 모양·툴팁 위치·`_ledgerTrend` 계산·색 불변. 데이터 없는 칸은 `cursor:default`. 데스크탑·모바일
  검증(작은 막대 3~4px, 칸 176/146px, 칸 위쪽 hover 시 tip opacity 1).
- `v3.33` — **감사 후속 수정.** ① 모바일 '기간' 바텀시트가 `document.body`로 포탈된 상태에서 다른 화면으로
  `renderDetail`이 실행되면(예: 백그라운드 동기화 완료 후 영수증 상세 렌더) 반투명 백드롭이 안 지워지고 화면을
  덮던 잠재 버그 수정 — 백드롭 잔재 정리를 가계부 분기 전용에서 `renderDetail` 진입 시 **항상 실행**하도록 승격
  (Playwright 재현·수정 확인: `backdropOrphanAfterSelect` true→false). ② 죽은 CSS(`.pp-id-icon`, 아이콘 제거 후
  잔재) 제거. 계산·저장·거래 로직 불변.
- `v3.32` — **선불권 목록 카드 깨짐 수정 + 헤더 버전칩 추가.** ① 목록 카드를 `auto-fill` 그리드(좁은 ~350px 칸)에서
  **전체폭 세로 스택**(`.pp-cards{display:flex;flex-direction:column}`)으로 바꿔, 좁은 칸에서 남은 잔액(196,5/00원)·
  진행바 범례가 줄바꿈되던 것 수정(상세 카드와 동일 폭). ② 선불권 헤더가 공통 헤더 규칙을 안 지켜 **버전 표시가
  없던 것** 수정 — `.main-eye-row` + `.js-app-version` 추가해 다른 탭처럼 'RECEIPT DB v3.xx' 표시(init에서 주입).
- `v3.31` — **선불권 화면을 사용자 최종 시안에 맞춰 재정렬(`prepaid.js`·`prepaid.css`).** 계산·저장·거래
  (`ppTotals`·`ppSuggestedUseAmount`·`ppLatestUse`·`ppCommit`·`ppEventForm`·`ppWalletForm`) 전부 그대로.
  ⚠️ v3.30이 정보 구조가 시안과 달라(분리 카드·6타일·세그먼트·행별 휴지통) 다시 만들었다. **상단을 하나의 카드로 통합**:
  아이콘 박스+이름+카테고리 라벨+유효기간 pill(정체성 행) → **남은 잔액+진행바(왼쪽) · 3개 통계 박스(오른쪽,
  사용 횟수/최근 방문/1회 평균 각각 보조라벨: 약 N회 남음·N일 전·총 N회 기준)** → **아이콘 액션 버튼 행**
  (1회 사용[Primary]·충전·환불·만료 차감·정보 수정). **내역**: '사용 내역 N / 충전 내역 N' **탭**(밑줄, 표시 전용) +
  **[최신순 ▾] 정렬**(표시 전용, 원본·계산 불변), 데스크탑 **표**(날짜/구분 **컬러 칩**/내용/금액/실행 잔액 + 행별
  **••• 메뉴**[영수증 보기·기록 삭제]), 모바일 **compact 리스트**. **모바일 액션 = 아이콘 버튼 4개**
  ([1회 사용][충전][환불][더보기]), 더보기 메뉴에 만료 차감·정보 수정(사용자 선택: 탭/더보기 결합). 메뉴는 바깥
  클릭·ESC로 닫힘. **선불권 전체 삭제는 추가하지 않음**(사용자 선택 '안전' — 동기화 로직 보존, 개별 기록 삭제만 유지).
  카테고리 라벨·아이콘·색은 기존 토큰(진행바·Primary·탭 선택 = Signature Blue, 칩 = --blue/--green 저채도).
  변경 파일 `prepaid.js`·`prepaid.css`·`index.html`(버전), 새 의존성 없음.
- `v3.30` — **선불권 화면 UI/UX 개선(`prepaid.js`·`prepaid.css`).** 기능·데이터·계산은 전부 그대로 재사용
  (`ppTotals`·`ppSuggestedUseAmount`·`ppLatestUse`·`ppCommit`·`ppEventForm`·`ppWalletForm`·`ppOpen`), 새 기능·새
  데이터 없음. **목록**: '총 남은 잔액' 요약 + 각 선불권을 compact 카드로(매장명·카테고리 라벨·유효기간, 남은 잔액,
  **잔액 진행바**(총 충전=충전+기초 잔액 합이 양수일 때만, 사용%=사용누계/총충전), 사용 횟수·최근 방문·1회 평균).
  카드는 `repeat(auto-fill,minmax(320px,1fr))` 그리드라 데스크탑에서 빈 공간이 줄고, 모바일은 1열. **상세**:
  ① 화면 내 **뒤로가기 화살표 제거**(`.pp-back-btn{display:none}` — 헤더·헤더 하단 구분선은 그대로 유지, 목록
  복귀는 선불권 탭 재선택 = index.html `.tab` 클릭에서 `prepaidSelectedId=null`). ② **핵심 잔액 카드**(남은 잔액
  + 진행바 + 사용/총). ③ **통계 타일**(사용 횟수·최근 방문·1회 평균·예상 남은·총 충전·사용 누계 — 데이터 있는
  것만). ④ **Primary 액션 '1회 사용 · N'** 강조 + Secondary(충전·환불·만료 차감·정보 수정), 모바일은 2열 그리드.
  ⑤ **내역**을 전체/사용/충전 **세그먼트**로 구분(표시 전용, `kind`로 분류 — 환불·만료는 '전체'에만; 데이터 불변)
  + 데스크탑 표(날짜·구분·내용·금액·**실행 잔액**)·모바일 compact 리스트, 행별 **삭제는 작은 아이콘 버튼**으로 낮춤
  (기존 void 로직·확인창 그대로). 색은 기존 토큰(Signature Blue=진행바·Primary·세그먼트 선택), 카드=밝은 surface+
  얇은 border. Mobile 하단 네비 여백 확보(`padding-bottom:84px`). 데스크탑·모바일 검증, 회귀(잔액/충전/사용/횟수/
  최근/유효기간 계산) 불변. 변경 파일 `prepaid.js`·`prepaid.css`·`index.html`(탭 복귀 1줄+버전), 새 의존성 없음.
- `v3.29` — **기간 선택 UI 통합(데스크탑 팝오버 · 모바일 바텀시트).** 기존 4-pill 세그먼트
  `[이번 달][올해][전체][📅]`를 **하나의 트리거 버튼**으로 합쳤다. 새 필터 기능이 아니라 UI 통합 —
  `_ledgerTimeFilter`·`viewMonth`·`_ledgerRange`·`_statsPeriodReceipts`·`renderSide`/`renderDetail`
  **로직 전부 그대로 재사용**(계산·데이터·회귀 불변, Playwright로 총지출/건수 동일 확인).
  ① **트리거**(`#lpTrigger`): 데스크탑=현재 기간 라벨(`_ledgerPeriodLabel()`: '2026년 9월'·'2026년'·
  '전체 기간'·'2026.09.01 ~ 2026.09.10'), 모바일=고정 '기간'(폭 안 변함). `.lp-tr-label-d`/`.lp-tr-label-m`
  두 span을 미디어쿼리로 토글. 캘린더 아이콘만 Signature Blue, 버튼 전체는 surface(`--card`)+테두리.
  ② **데스크탑 팝오버**(`.lp-pop`, 320px, 트리거 아래 `right:0`): 제목 + 빠른 선택(이번 달·올해·전체 기간)
  + 구분선 + 직접 기간 선택(시작일/종료일 + 적용). 바깥 클릭·ESC로 닫힘(전역 핸들러, 트리거/팝오버 내부 제외).
  ③ **모바일 바텀시트**: 같은 마크업을 `@media(max-width:780px)`에서 하단 고정 시트로. ⚠️ 헤더에
  `backdrop-filter`(반투명 블러)가 있어 `position:fixed`가 헤더 안에 갇힌다(시트 bottom이 뷰포트가 아니라
  헤더 기준으로 잡힘) → **열 때 backdrop+시트를 `document.body`로 포탈**하고, `renderDetail`마다 body의 잔재를
  제거해 중복 id를 막는다. 시트 z-index 201 > nav 120라 하단 네비 위로 뜬다. 핸들·× 닫기·backdrop 탭으로 닫힘.
  ④ 빠른 선택은 즉시 실행 후 재렌더로 닫히고, 직접 기간만 [적용] 사용. 현재 선택된 빠른 기간은 `on`(파랑),
  range 상태면 빠른 선택 표시 없이 '직접 기간 선택' 라벨을 파랑으로 활성 표시. aria-haspopup/expanded/label 부여.
  검증: 데스크탑(1280) 팝오버 위치·이번 달/올해/전체/직접 기간·ESC·바깥 클릭 PASS; 모바일 360/390/430
  가로 overflow 없음·시트 하단 고정·backdrop 닫기·빠른 선택 PASS. 변경 파일 `index.html`만, 새 의존성 없음.
- `v3.28` — **기간 범위(📅) 팝오버를 요약 '가장 많이 간 곳' 칸에 정렬.** 팝오버를 열 때 요약 4번째 타일
  (`#detailBody .summary-grid--4 .sum-card:nth-child(4)`) 폭을 실측해 팝오버 폭에 반영(`pop.style.width`).
  팝오버는 `right:0`(오른쪽 끝 정렬)이라 폭=타일 폭이면 **왼쪽 모서리가 그 타일의 왼쪽 구분선에 정렬**된다.
  타일 폭이 150px 미만이면 기본 230px 유지(사용성). 데스크탑·모바일 공통. 컨트롤(4 pill)은 한 타일보다 넓어
  오른쪽 끝 정렬만 유지(별도 논의). 필터·계산·데이터 불변.
- `v3.27` — **기간 범위(📅) 팝오버 바깥 클릭/ESC 닫기.** 달력 버튼으로 연 `#lpRangePop`이 바깥을 눌러도 안
  닫히던 것 수정. 전역 `click`·`keydown` 리스너 1회 등록(팝오버는 `renderDetail`마다 재생성되므로 매번 live
  query). 달력 버튼 자신(`.lp-seg button.lp-cal`)·팝오버 내부 클릭은 자체 토글이 처리하므로 제외 → 다른 곳을
  누르면 닫힌다. 필터·계산·데이터 불변.
- `v3.26` — **도넛 구성: 범례 우측 정렬 + 도넛 중앙 여백 균등.** 범례를 오른쪽 끝으로 정렬하고, 도넛을
  (왼쪽 여분)=(도넛↔범례 여분)이 되도록 그 사이 정중앙에 배치. flex의 auto 마진 2개로 구현
  (`.donut{margin-left:auto}`, `.donut-legend{flex:0 1 auto;margin-left:auto}`, `.donut-wrap{gap:0}`) — 두 여분이
  항상 동일. 데스크탑·모바일 공통. 세로 중앙·7슬롯 균등·% 열 정렬·색·계산·데이터 불변.
- `v3.25` — **모바일도 데스크탑과 동일 조건으로 정제.** ① **요약 세로 간격 축소**: `.sum-card` padding 12→8, 값행↔
  보조정보 gap 12→3, `.sum-sub` margin-top 5→3. ② **덜 중요한 부분 크기·색을 데스크탑과 통일**: 라벨 11.5/600/none,
  이름(Secondary) 14→**15px**/600/`--sum-name`(=#4B5563 라이트), 보조정보 11.5/500/`--label3`. ③ **도넛 창을 데스크탑처럼**
  모바일에서도 도넛 세로 중앙 + 7슬롯 범례(154px) 중앙(위·아래 여분, `grid-auto-rows:154/7`, `align-content:start`라
  3개면 위쪽 슬롯부터). Primary(총 지출·영수증)·색·계산·데이터 불변.
- `v3.24` — **도넛 '창' 중앙 배치.** 도넛+범례 영역(`.donut-wrap`)을 데스크톱에서 추이 카드 높이(**231px**)에
  맞추고, 그 안에서 **도넛을 세로 정중앙**(위·아래 여분 61px씩), **7슬롯 범례 블록(183px)도 중앙 배치**(여분 24px씩,
  26px 간격)로. v3.23의 top-align(도넛 위선부터 시작)을 바로잡음. 범례는 여전히 `align-content:start`라 3개만
  있어도 블록 위쪽 슬롯부터 채워진다(검증: 7개 dot top [443,469,495,521,547,573,599] · 3개 [443,469,495] 일치).
  도넛 중심 526 ≈ 추이 plot 중심 516. 모바일은 기존 7슬롯(126px)·중앙 유지. 색·계산·데이터 불변.
- `v3.23` — **도넛 범례를 7슬롯 고정 + 위에서부터 균등 간격.** 범례(상위 6 + 기타 = 최대 7행)를 `display:grid` +
  `grid-auto-rows:calc(126px/7)` + `align-content:start` + 고정 `height:126px`로 만들어, 행이 항상 위에서부터
  같은 피치(18px)로 배치된다. 카테고리가 3개만 있어도 7개일 때의 위쪽 3슬롯과 **정확히 같은 위치**에 온다
  (검증: dot top 7개 [465,483,501,519,537,555,573] · 3개 [465,483,501]). 이름 왼쪽정렬·% 열 정렬·이름↔% ~28px·
  도넛과 가깝게는 유지. 색·계산·데이터 불변.
- `v3.22` — **[A] 전체 내역 미세조정 + [B] 왼쪽 목록 탐색 개선(재설계·리브랜딩 아님).** 기능·데이터·계산·아이콘
  형태·이름/로고/버전 보존. **A2/A4 Summary 위계**: Primary(총 지출·영수증 25px/700/#111) 유지, Secondary
  (카테고리명·방문처명)를 Primary의 약 60%인 **15px(모바일 14px)/weight600**·색 **토큰 `--sum-name`**(라이트 `#4B5563`,
  다크 `#A0A6B0`로 안전 — 하드코딩 금지 규칙 준수)로 축소·통일, ellipsis 유지. Metadata 11.5px 유지. **A3** 결과값에
  카테고리 Accent Color 미사용(그대로). **A5 지정 12종 선명 팔레트로 교체**(`CAT_COLORS` 한 곳): 술집 #F2B01E·외식
  #FF7A45·카페 #C58B68·쇼핑 #F06F9B·문화(영화) #6875E8·교통 #3EA5E8·숙박 #8B7CF6·노래방 #A56DE2·스파 #2FC7A7·
  경조(경조사) #9BA3AF·선물 #FF7D8B·외주용역비 #2DAAA6. **나머지 7종 유지**: 기타·(미분류) #858A90, 여행 #6E8FA8,
  골프 #7C9A6B, 운동 #B57F5E, 케이크 #B77E9E, 병원·약국 #6F94A0. **A6** 아이콘 bg 12%·progress·도넛·범례 동일색
  (getCatColor). **A7** Signature Blue `#4355E8`(nav·선택·기간)·추이 막대 `#60A5FA` 그대로(신규 blue 없음).
  **A8** 추이:구성 60:40→약 65:35(첫 자식 flex 1.5→1.9, 외부 폭 불변). **A9** 추이 plot 150→176px(모바일 124→146).
  **A10** 어두운 툴팁 → 밝은 흰 카드(자식 `.lp-tip`: 날짜 12/500 #6B7280·금액 14/700 #111827·건수 12/400 #6B7280;
  흰 배경+흰 글자 금지 준수). **A11** 도넛 중심을 추이 plot 중심에 정렬. **A12** 범례: 이름+% 한 쌍(이름 뒤 ~28px),
  %를 우측 끝까지 안 밀고 도넛과 가깝게(gap 14). v3.21 grid+justify-end → flex로 되돌림.
  **[B] 왼쪽 목록**: 검색창 아래 compact toolbar(현재 범위·건수 + 정렬 dropdown: 최신순/오래된순/금액 높은순/낮은순/
  매장명순). **기본 최신순**(loadAll의 date+time+id 내림차순 = 기존 기본값 그대로). 정렬은 **표시 직전 복사본만**
  (`_sortForList`, Array 안정정렬 — 원본 `receipts` 순서·데이터 불변). **날짜 정렬(최신/오래된)일 때만 날짜 그룹**
  (여러 달이면 월 헤더 + 일 헤더 `9월 18일`, 작은 secondary 스타일), 금액·매장명순은 flat list. 검색 지원 필드는
  매장명·품목·카테고리·결제자·참석자·메모·태그·날짜·초성(기존 그대로, placeholder도 이미 반영). 품목 등 목록에 안
  보이는 필드로 매칭되면 카드에 **`품목 · <품목명>`** 이유 표시(`_searchMatchReason` 읽기 전용, `getFiltered` 불변).
- `v3.21` — **도넛 범례 레이아웃 교정.** 범례를 그리드(`display:grid` 이름 열 왼쪽정렬·% 열 오른쪽정렬,
  `.dl-item{display:contents}`)로 바꿔 **이름+% 를 한 쌍으로 붙이고**, `justify-content:end`로 전체를
  오른쪽에 모아 **도넛과의 간격 확보**(도넛 wrap gap 14→18px). v3.20에서 %만 `margin-left:auto`로 밀어
  이름↔% 가 벌어지고 도넛↔이름은 좁던 것 교정. 데스크톱·모바일 공통.
- `v3.20` — **전체 내역 헤더/범례 정렬.** ① 기간 컨트롤(이번 달·올해·전체·📅)을 제목('2026년 9월') 줄과
  **같은 줄**로: 헤더 첫 블록에 `.main-title-row`(제목 왼쪽 · `#ledgerPeriodSlot` 오른쪽) 신설(기존엔 슬롯이
  눈썹 줄 높이에 붙어 제목보다 윗줄이었음). 데스크톱·모바일 공통. ② 도넛 범례 비율(%)을 **오른쪽 정렬**
  (`.dl-pct{margin-left:auto}`) — 도넛↔범례 간격(14px)은 유지. 색상은 별도 논의(이번 변경 없음).
- `v3.19` — **전체 내역 후속 정제(사용자 목업 반영, 그 화면만).** ① **지출 추이 차트 확장**: Y축 금액 눈금
  (0/…/nice max, `_niceCeil`+`_yTicks`) + 점선 그리드 + X축 라벨 최대 5개(`_pickAxis`) + 호버 툴팁에
  **'영수증 N건'** 추가(버킷별 건수 집계) + 세로 확대(데스크톱 150px·모바일 124px). **전용 클래스**
  `.lp-trend`/`.lp-yaxis`/`.lp-canvas`/`.lp-grid`/`.lp-bars`로 만들어 다른 화면 `sparkline`과 독립(그래서
  `.spark-bars` 높이는 v3.18의 66px→54px 원복). 집계 값 자체는 불변, 표시만 확장. ② **도넛+범례 한 그룹**:
  왼쪽 도넛·오른쪽 범례로(`.donut-wrap` `flex-wrap:nowrap`·간격 14px, 도넛 132→120px, 범례 `flex:1;min-width:0`).
  v3.18에서 40% 열이 좁아 범례가 도넛 아래로 접히던 것 수정. ③ **기간 컨트롤을 모바일에서도 헤더 우측**:
  `_useSlot=!!periodSlot`(v3.18은 데스크톱만)으로 데스크톱·모바일 모두 제목 행 우측 슬롯(`#ledgerPeriodSlot`)에
  배치 + 모바일 pill 축소. 색상은 v3.18 muted 팔레트 유지(사용자 확인). 데이터·계산·참석자 분담 로직·다른 화면 불변.
- `v3.18` — **전체 내역 데스크톱 미세 정제(그 화면에만, 지정 5개 항목만).** 첨부 시안은 방향 참고용이며
  그대로 복제하지 않음(SAZZI 리브랜딩·이름/로고 변경 없음). ① **Summary 위계**: 총 지출·영수증 타일은
  Primary(강한 강조) 유지, 최다 카테고리명·방문처명의 강조만 한 단계 낮춤 — 크기(23/21px)·ellipsis·보조정보
  색은 그대로, weight 550/500 + 색 `--label2`. ⚠️ 시안의 `#4B5563`은 라이트에만 맞고 기본 다크에서 묻히므로
  **하드코딩 대신 토큰 `--label2`**(라이트 #666≈#4B5563 / 다크 #7c7f90)로 두 테마 모두 안전(색은 토큰 규칙).
  ② **카테고리 컬러 시스템을 최종 muted 팔레트로 교체** — 아이콘 SVG **형태 불변, 색만**. `CAT_COLORS` **한 곳**에서
  관리(외식 #D9795F·술집 #A8734A·카페 #9A7665·쇼핑 #D77A91·문화(영화) #7475A8·교통 #718096·숙박 #77769A·
  노래방 #8E74B7·스파 #72A99B·경조(경조사) #8D8783·선물 #FCA5A5·외주용역비 #55A6A6·기타/미분류 #858A90 +
  여행/골프/운동/케이크/의료 muted 보완). getCatColor로 도넛·범례·카테고리별 막대·아이콘 배경이 자동 반영.
  `renderLedgerPanel` 도넛 '기타'(나머지) 슬라이스의 하드코딩 색(`#CBD5E1`)도 새 기타색 `#858A90`으로 통일
  (date-search용 `renderAllSummaryHtml`은 다른 화면이라 건드리지 않음). `CAT_FALLBACK_COLORS`도 muted로.
  ※ 활성 패널의 '카테고리별' 막대·아이콘 배경은 `catRow`가 `getCatColor`를 쓰므로(`background:${color}1f`·바 색)
  팔레트만 바뀌고 구조는 그대로다 — 아이콘·막대 신규 추가 없음(SVG 형태 불변).
  ③ **지출 추이 확대**: 추이+도넛 행 전체 폭 유지하며 추이 60%/카테고리 구성 40%(추이가 첫 자식 `flex:1.5`) +
  막대 플롯 높이 54→66px(+22%). X축·툴팁 텍스트 가독성 유지, **계산·축 라벨 불변**. ④ **도넛 범례 정돈**:
  이름↔% 간격이 우측 끝까지 벌어지던 것을 `grid`→`flex` + `.dl-pct{padding-left:20px}`로 ~28px로 좁혀 도넛과
  범례가 한 덩어리로 읽히게(도넛 크기 불변). ⑤ **기간 컨트롤 제목 행 우측**(`#ledgerPeriodSlot`)은 v3.17에서
  이미 적용 — 유지·확인만. 기능·데이터·계산·참석자 분담 로직·모바일·다른 화면 불변. 새 의존성 없음.
- `v3.17` — **전체 내역 미세 정제(타이포/기간 컨트롤 위치/차트 텍스트/여백).** ① Summary 한 단계 더 축소:
  금액 25px/700 · 최다 카테고리명 23px/700 · 최다 방문처명 21px/650(총액보다 약하게) · 라벨 11.5px/600 ·
  보조 11.5px/500. 이름은 `.sum-card:nth-child(3/4)`로 분리, ellipsis 유지(동적 축소 없음). ② 기간 컨트롤
  `[이번 달][올해][전체][📅]`을 제목 행 우측 헤더 슬롯(`#ledgerPeriodSlot`)으로 이동 — 왼쪽=현재 기간,
  오른쪽=기간 변경. **데스크톱만** 슬롯 사용, 모바일은 헤더 높이 보호로 기존처럼 본문 상단. 필터/계산 로직
  불변(위치만). ③ 지출 추이: 축 12px·색 `--label2`로 진하게, 툴팁 두 줄(날짜/금액) 12px·패딩·행간 확대.
  ④ 카테고리별↔참석자별 분담 사이 24px. 데이터·색·아이콘·차트종류·레이아웃·모바일 기능 불변.
- `v3.16` — **전체 내역 패널 타이포그래피/여백 정제(데스크톱).** 홍보용 대시보드 느낌을 줄이고
  업무용 데이터 UI로. 고정 scale: 금액 28px/700 · 최다 카테고리·방문처 이름 26px/700(총액보다 작게)
  · 라벨 12px/600 · 보조 12px · 섹션제목 14px/650 · 카테고리명 14px/600 · 비율 13px · 금액 14px/650.
  세로 여백 약간 축소. 이름은 **ellipsis 유지, 동적 축소 없음**(hover/title로 전체 확인). `@media(min-width:781px)`
  범위(데스크톱)로 한정 — 모바일·기능·색·아이콘·차트·레이아웃 불변.
- `v3.15` — **통합 패널에 '참석자별 분담'을 정식 섹션으로 되살림(모든 기간).** v3.14 통합에서 빠졌던
  기존 기능 복원. 계산부를 `_participantSplit(list)`로 분리(출력 동일 — `participantBreakdown(ym)`은
  이제 `_participantSplit(receiptsForMonth(ym))`)해 **선택 기간 recs로 재계산** → 이번 달·올해·전체·
  범위 모두 동일하게 갱신, 참석자 데이터 없으면 섹션 숨김. 계산 로직은 월 종속이 아님(영수증별 1/N
  합산이라 임의 기간에 의미 동일)이라 변경 없이 안전 재사용. '이달 패턴 인사이트'는 제외.
- `v3.14` — **'전체 내역' 분석 패널 확장.** ① 카테고리 색을 **밝은 파스텔 팔레트**로 교체
  (`CAT_COLORS` 한 곳, 앱 전체 동일 색). ② **모든 기간(이번 달·올해·전체·범위) 동일 리치 패널**
  통합(`renderLedgerPanel`) — 기간 변경 시 요약·추이·도넛·카테고리가 함께 갱신. ③ 기간 UI를
  `[이번 달][올해][전체][📅 범위]`로 정리(임의 과거 월/연도는 범위로). ④ **날짜 범위 직접 선택(신규)**:
  `_ledgerTimeFilter={type:'range',from,to}` + `_statsPeriodReceipts` 확장 + 달력 팝오버(시작/종료/초기화/적용).
  ⑤ **카테고리 정렬 드롭다운**(`_ledgerCatSort`: 금액 높은/낮은/이름). 금액순=비율순이라 비율순은 두지 않음.
  ⑥ 추이 막대 sky blue, 기간별 일/월 granularity 자동. 전역 Primary·이름/로고/버전·저장·검색·Dropbox·
  아이콘 자산 불변. 변경: `CAT_COLORS`·`_ledgerFilterPillsHtml`·`_statsPeriodReceipts`·신규 `renderLedgerPanel`
  /`_ledgerTrend`·renderDetail 가계부 분기. `_enhanceStats`는 미사용이 됨(삭제하지 않고 남김).
- `v3.13` — **'전체 내역' 데스크톱 분석 레이아웃 개선(그 화면에만).** ① 상단 요약 타일 4개
  (총 지출·영수증·가장 많이 쓴 카테고리·가장 많이 간 곳) — 전부 현재 데이터 계산(하드코딩 없음).
  ② 기간 세그먼트 필(전체·연도·월) + 세부 선택 드롭다운은 기존 `#ledgerFilterSel` 로직 재사용.
  **분기(Quarter)는 앱이 미지원이라 제외.** ③ 월별 지출 추이(최근 12개월)는 기존 `.spark-bars`
  재사용(새 차트 라이브러리 없음). ④ 카테고리별 지출 데스크톱 2열 + **기존 아이콘 `getCatSvg`
  그대로 재사용** + muted 색. ⑤ 순수 CSS `conic-gradient` 도넛(상위 6 + 기타). 카테고리 색은
  `CAT_COLORS`/`getCatColor` 한 곳에서 관리(앱 전체 동일 색 기반). 저장 구조·검색·Dropbox·아이콘
  자산·모바일·이름/로고/버전 방식 불변. 새 요소는 `@media(min-width:781px)` 밖에서 자동 1열.
  변경은 `renderAllSummaryHtml`·`_enhanceStats`(all-view 분기)·`_ledgerFilterPillsHtml` 한정.
- `v3.12` — **상세 화면 카테고리 팝오버 왼쪽 정렬.** `.detail-cat-popover`가 오른쪽 칸 기준으로
  `left:calc(-100% - 8px)`/`width:calc(200% + 8px)`였는데 그리드 gap(8px)과 어긋나 왼쪽 3px·
  오른쪽 1px 밀려 있었다(팝오버가 필드보다 살짝 오른쪽으로 들어감). `left -11px`/`width +12px`로
  그리드 폭에 딱 맞춤(Playwright 측정: 좌·우 여백 0px, 데스크탑 1280·모바일 390 동일). 겹쳐서 늘
  기본 규칙에 덮여 무효였던 `@media(max-width:520px)`의 `-10px` 규칙도 제거.
- `v3.11` — **지출 막대 툴팁 글씨를 뷰포트별로.** 데스크탑(2x) 9→8px, 모바일(`@media ≤780px`, 3x)
  7px. 모바일은 고해상도라 7px도 또렷하고, 데스크탑은 8px이 획이 흐려지지 않는 하한. 여백·굵기·
  배경·색은 그대로. 데스크탑/모바일 × 라이트/다크 재캡처 확인.
- `v3.10` — **지출 막대 툴팁 글씨 얇게.** `font-weight` 600→500, 자간 -.1px→0. 9px 작은 글씨의
  가독성은 지키되 더 산뜻한 느낌. 크기·유리질 배경·흰 글자는 v3.09 그대로.
- `v3.09` — **지출 막대 툴팁 한 단계 더 축소.** 카드와 값을 더 작게: 글씨 10→9px, 여백
  4/7→3/6px, 모서리 7→6px, 그림자 `0 6px 18px`→`0 5px 15px`. 반투명 유리질 배경·흰 글자는
  v3.08 유지. 데스크탑·모바일 × 라이트/다크 × 월간/연간 재캡처 확인.
- `v3.08` — **지출 막대 툴팁 디자인 다듬기.** 상자를 줄이고(글씨 11→10px, 여백 4/8→4/7px)
  불투명 `#2d3033` 배경을 반투명 `rgba(28,30,33,.82)` + `backdrop-filter:blur(10px) saturate(140%)`
  유리질 배경으로 바꿨다. 얇은 흰색 테두리(`.5px rgba(255,255,255,.1)`)와 더 부드러운 그림자로
  나브바 라벨 툴팁과 같은 결. 글자는 흰색 고정(v3.07의 가독성 규칙 유지). 데스크탑·모바일 공통.
- `v3.07` — **일별/월별 지출 막대(sparkline) 호버 툴팁이 안 보이고 잘리던 것 수정.**
  ① **색**: 툴팁 배경은 테마와 무관한 고정값 `#2d3033`(항상 어두움)인데 글자만 `var(--label)`이라,
  라이트 모드에서 검은 글씨(`#111`) + 어두운 배경으로 묻혔다(v2.60과 같은 함정). 글자를 고정
  `#fff`로 바꿔 두 테마 모두 흰 글씨로 읽히게 했다(`--red`/`--green`처럼 색 배경엔 흰 글씨 규칙).
  ② **잘림**: 툴팁이 막대 위(`bottom:calc(100%+4px)`)에 뜨는데 `.sparkline`이
  `.section-body{overflow:hidden}` 안이고 위 여백이 14px(연간은 인라인 8px)뿐이라 최고 막대의
  툴팁 윗부분이 잘렸다. `.sparkline` 위 패딩을 32px로 늘려 툴팁이 들어갈 자리를 확보하고, 연간
  '월별 지출'의 인라인 `padding-top:8px`도 제거해 같은 여백을 쓰게 했다. 데스크탑·모바일 공통
  CSS라 양쪽 다 적용(모바일 월간은 '자세히 보기'로 펼친 뒤 보인다).
  ③ 덤으로 연간 '월별 지출' 막대가 `data-day`(월인데 '3일')·`data-amt`에 '원'을 넣어 툴팁이
  '3일 500,000원**원**'으로 나오던 것을, 이미 있던 `data-lbl` 선택자를 써서 '3월 500,000원'으로 교정.
  ⚠️ 검증: 데스크탑(1280) · 모바일(375) × 라이트/다크 × 월간/연간 8종을 Playwright로 호버 캡처해 확인.
- `v3.06` — **완료본 파일 이름 자동 정리.** 맥 스크립트(`receipt_pdf_to_jpg.py`, repo 밖)가 옮겨 둔
  완료본은 앱 레코드에 `scanPath`가 없어서, 매장명·금액을 채워도 완료 JPG·완료 PDF의 파일 이름이
  원본 그대로(예: `20260912_01`) 남았다. 수동 '일괄 변경'(`renameScanFilesAll`)의 매칭·안전 규칙을
  `_buildScanRenamePlan`/`_execScanRenamePlan`으로 분리하고, 확인창 없는 `_autoRenameCompleted`를
  **영수증 저장 시**와 **동기화 시** 호출해 자동으로 `260912_영수증(금액)_매장명`으로 바로잡는다.
  안전 규칙은 수동과 동일(`scanPath` 매칭 또는 파일명 날짜의 **단일 후보**만, 매장명·금액이 있을 때만,
  `autorename:true`로 덮어쓰기 없음). 저장 시 완료본을 **먼저 채택해 `scanPath`를 확보**하므로
  `_dbxArchiveReceiptPhoto`가 보관본 사본을 새로 만들지 않는다. ⚠️ 맥 스크립트의 **자동 이름짓기(PDF
  텍스트 추출)는 repo 밖이라 손대지 않는다** — 되던 게 멈추면 맥 쪽 로그(`receipt_pdf_to_jpg.log`)를
  봐야 한다. 이 변경은 앱이 채운 정보로 완료본 이름을 **대신 정리**해 사용자가 매번 수동 실행하지
  않게 하는 것이다.
- `v2.97` — 완료본 재사용 시 Dropbox `content_hash`를 확인해 이름만 같은 다른 사진의 오연결을 막고, 충돌 시 영수증 ID가 포함된 고유 이름으로 보존. 중복 삭제 실패 건수도 사용자에게 표시.
- `v2.95` — **사진 오연결·완료본 중복의 근본 수정 (데이터 무결성, #17).**
  ① **영수증 ID를 기기 간 고유하게.** `_newId`가 `rec_YYYYMMDD_NNN`(NNN은 이 기기 안
  순번)만 쓰던 탓에 폰·데스크탑이 같은 날 각자 저장하면 둘 다 `_001`을 만들어 **ID가
  겹쳤다.** 겹치면 (a) 파생 `imageId`(`img_`+`id.slice(4)`)까지 겹쳐 사진이 서로 덮였고
  (**엉뚱한 사진**), (b) `_dbxMerge`가 ID로 합치므로 서로 다른 영수증인데 한쪽이
  `updatedAt` 비교로 통째로 사라졌다. `Math.random().toString(36).slice(2,6)` 난스를 붙여
  `rec_YYYYMMDD_NNN_<rand>`로 만들어 충돌을 원천 차단. NNN 순번은 그대로라 사람이 읽기
  좋고, `parseInt`가 `_<rand>`·`p해시`에서 멈춰 로컬 순번 계산도 유지되며, `rec_` 접두어만
  떼어 쓰는 기존 소비자(imageId 파생·캐시 정리)는 그대로 동작.
  ② **완료 JPG/PDF 업로드를 멱등으로.** `_dbxArchiveReceiptPhoto`가 `mode:'add',
  autorename:true`라 다른 기기가 `scanPath`를 아직 못 받았거나 재저장/재시도로 같은 파일을
  또 올리면 `' (1).jpg'` **사본이 계속 쌓였다.** 올리기 전에 `_dbxPathExists`(get_metadata)로
  같은 이름이 이미 있는지 확인해 있으면 그 파일을 `scanPath`로 채택하고, `autorename:false`로
  바꿔 조용한 사본 생성을 막았다. `_dbxRenameScanFile`도 원본 `not_found`일 때 `scanPath`를
  무작정 비우지 않고 새 이름에 파일이 있으면 채택(재업로드로 인한 중복 방지). 사진 원본은
  고유 ID로 `images/{imageId}.jpg`에 따로 보존되므로 완료본이 하나여도 유실이 없다.
  ⚠️ 이 수정은 **앞으로의** 충돌·중복을 막는다. 이미 만들어진 겹친 ID나 쌓인 완료본 사본
  정리는 별도 작업(파괴적이라 신중히). 앱은 `_photoErrorReason`이 '같은 사진이 다른 영수증에도
  연결됨' 등으로 기존 오연결을 계속 빨간 점으로 표시한다.
- `v2.86` — **카테고리 아이콘 가독성 보강.** SVG 자산은 변경하지 않고 선택기·필드·상세 카드의 표시 크기를 13~18% 확대. CSS 그림자를 0.22px씩 네 방향에 더해 얇은 원본 선을 라이트·다크 테마에서 또렷하게 표시.
- `v2.85` — **숙박 아이콘 단일 확인 적용.** 새로 전달된 24×24 침대 SVG를 재해석하거나 정리하지 않고 숙박 자산 한 곳에만 그대로 적용. 다른 카테고리 15종은 변경하지 않음.
- `v2.84` — **사용자 카테고리 SVG 원본 형태 복원.**
  v2.83에서 임의로 다시 그린 24×24 아이콘을 모두 폐기. 전달받은 Illustrator SVG마다
  현재 100×100 아트보드에 있는 실제 벡터 그룹을 그대로 추출하고, 흰 배경 사각형과
  작업 영역 밖의 다른 아이콘만 제거. 표시 순서·명칭·테마 마스크·오프라인 지원은 유지.
- `v2.83` — **사용자 제작 카테고리 아이콘 16종 적용.**
  카테고리 표시 순서와 명칭을 사용자 시안에 맞추고 SVG 자산·오프라인 셸 연결을 추가.
- `v2.82` — **동시 편집·백업 복원·오프라인·유지보수 안전성 보강.**
  Dropbox `rev`가 일치할 때만 sync JSON을 갱신하고, 충돌하면 최신 원격본을 다시 병합해
  최대 3회 재시도. 백업·동기화의 레코드 구조·개수·이미지 데이터·파일 크기를 검증하고
  비정상 항목을 격리. 온라인 최신 우선 서비스 워커와 릴리스 검사 스크립트를 추가하고,
  repo 안의 v1.02 중복 폴더와 대체된 미사용 함수 5개를 제거.
- `v2.81` — **사진 없음 아이콘·가져오기 안전성·접근성·초기화 안내 개선.**
  작은 카메라에서 아래로 처져 보이던 렌즈를 시각 중심으로 올리고, 필터와 목록 아이콘을
  동일하게 맞춤. 백업에서 가져온 영수증 ID를 HTML 속성에 안전하게 표시하고, 영수증
  행을 Enter/Space 키로도 열 수 있게 함. Dropbox 연결 중 로컬 초기화는 원격 기록이
  다시 내려올 수 있음을 설정 화면과 확인창에 명확히 안내.
- `v2.80` — **재설치 사진 복구와 JSON 백업의 레거시 사진 호환 보강.**
  `imageId` 참조가 빠졌어도 완료 JPG 경로가 남은 스캔 기록은 표준 이미지 ID로
  백그라운드 복구한다. IndexedDB의 iOS 호환 `data` URL 사진도 로컬·Dropbox 백업에
  포함하며, 손상된 이미지 한 건 때문에 전체 로컬 백업이 실패하지 않게 건너뛴다.
- `v2.79` — **영수증 상세 헤더의 '← N월 가계부' 뒤에 버전이 붙던 배치 수정.**
  상세 화면의 뒤로가기 줄에서는 버전 칩을 숨기고, 요약 화면으로 돌아오면 다시 표시.
- `v2.78` — **재설치 직후 Dropbox 사진을 아직 내려받지 않은 영수증을
  `사진 없음`으로 계산하던 것을 수정.** 미확인 항목은 누락 개수에서 제외하고,
  Dropbox 동기화 후 `images/`·`완료 JPG`에서 사진을 순차적으로 백그라운드 복구.
  실제 조회까지 실패한 항목만 사진 없음으로 표시.
- `v2.72` — **안드로이드 PWA 상태표시줄 배경·아이콘 명암 불일치 수정.**
  `viewport-fit=cover`·`black-translucent`를 제거해 상태표시줄을 브라우저에 넘기고,
  첫 페인트 전에 `theme-color`·`color-scheme`을 실제 헤더 배경이랑 맞춤.
  설치형 시작 색을 위한 `manifest.webmanifest`도 추가.
- `v2.67` — **모바일 당겨서 새로고침**(더치페이 v5.10 구현 이식). 헤더를 아래로 당기면
  인디케이터가 따라 내려오고, 임계값(70px)을 넘겨 놓으면 스피너 후 `location.reload()`.
  ⚠️ **이 앱은 문서가 아니라 `.main-body`/`.side-list`가 스크롤한다.** 더치페이처럼
  `window.scrollY<=0`으로 판단하면 항상 0이라 아무 데서나 발동한다 →
  **지금 화면에 보이는 스크롤러의 `scrollTop`**을 본다.
  ⚠️ **`.modal-overlay`/`.modal-card`는 항상 DOM에 있다.** `querySelector(BLOCK)` 존재만
  보면 늘 걸려서 기능이 아예 안 돈다. 게다가 `position:fixed`라 `offsetParent`로도 판별이
  안 된다 → **`getClientRects().length`** 로 실제 표시 여부를 본다.
  타이핑 중(키보드 열림)에는 발동하지 않는다. 데스크탑은 `ontouchstart` 없으면 설치조차 안 된다.
- `v2.66` — ① **헤더 눈썹을 모든 탭에서 `Receipt DB`로 통일.** 통계 '가계부' · 추가 '새 영수증 추가' ·
  설정 '설정'이 제각각이었다. 자간도 0.9px로 통일(폰트·크기·색은 원래 같았다).
  ⚠️ `#mainEye`는 JS가 12곳에서 바꿔 쓰는데 그중 **인물 검색 아이콘 3곳과 뒤로가기 버튼 1곳은
  기능이라 건드리면 안 된다.** 글자를 넣던 8곳만 바꿨다.
  ② 붙여넣기 안내 문구 한 줄로 축약(2줄 → 1줄).
  ③ **헤더가 상태바 아래로 들어가 되돌아오지 않던 문제.** 낡은 `.main.scrollIntoView()` 3곳
  (문서 전체가 스크롤되던 옛 레이아웃 시절 코드) 제거 + **문서 스크롤 되돌리기 가드** 추가.
  ⚠️ `html/body`의 `overflow:hidden`은 **손가락 스크롤만 막고 프로그램·시스템 스크롤은 못 막는다.**
  그래서 iOS가 입력칸을 키보드 위로 올리려고 문서를 밀면 되돌릴 방법이 없었다.
  가드는 타이핑 중에는 개입하지 않고(입력칸이 키보드에 가리면 안 되므로) `focusout` 뒤에 되돌린다.
  데스크탑(>780px)에서는 개입하지 않는 것을 확인했다.
- `v2.65` — 내역 탭 헤더의 **빈 공간 24px 제거**(124 → 100px). v2.64가 모든 탭을 124px로
  묶었는데 그 값은 **부제목이 두 줄인 추가 탭 기준**이라 내역 탭엔 그만큼 남았다.
  제목~월네비 간격 58 → 34px, 목록 영역 427 → 451px.
  ⚠️ **내역 탭 구분선(227)은 추가·설정(194)과 다르다 — 의도된 것.**
  내역은 헤더(내용 최소 100px) + 월 네비(57px) = 157px이 최소라, 구분선을 맞추려면
  추가·설정에 24px 빈 공간이 생긴다. 둘 다는 불가능해서 목록 공간을 택했다.
- `v2.64` — ① **상태바와 헤더 사이 여백 1/4로.** v2.59에서 넣은 standalone 54px 바닥값이
  `env`가 0인 기기에서 그대로 빈 공간이 됐다. 54 → 14px.
  ② **탭마다 다르던 헤더 높이 통일.** 내역 100 / 설정 107 / 추가 124px이었다
  (추가 탭은 부제목이 두 줄). `--mobile-head-h`를 새로 두고 `.side-top`·`.main-top`
  양쪽에 걸어 **모두 124px**. 눈썹 11px · 제목 23px · 버전 10px로 폰트도 이미 동일.
  ③ **저장/초기화 바를 `.main-body` 밖으로 이동.** `.view`의 직접 자식(flex 바닥 항목)이라
  `position` 없이 절대 스크롤되지 않는다.
  ⚠️ 이 바는 **sticky도 fixed도 답이 아니다.** sticky는 스크롤 컨테이너 안이라 iOS에서
  스크롤 중 따라 움직이고(v2.30~v2.63), fixed는 키보드가 열리면 밀려난다(v2.24).
  **스크롤 컨테이너 밖의 flex 형제로 두는 것이 정답이다.**
- `v2.63` — 네비 **말꼬리가 좌측 패널에 가리던 것** 수정. `.icon-nav`와 `.side`가 둘 다
  positioned + `z-index:auto`라 DOM상 뒤인 `.side`가 위에 그려졌다. 레일에 `z-index:100`.
  (`#viewList>.main-top`이 70이므로 그보다 위여야 한다.)
  ⚠️ 더치페이 `.app-rail`은 `position`이 없어 말꼬리의 `z-index:400`이 루트까지 올라가
  이 문제가 없었다. **값만 베끼면 안 되고 쌓임 맥락(stacking context)까지 봐야 한다.**
- `v2.62` — ① **추가·설정 탭 헤더의 빈 공간 제거.** `.main-top`의 `min-height`가
  `--mobile-main-head-h`(브랜드+월네비)여서, 월 네비가 없는 탭에서 39px이 빈 공간으로 남았다.
  모바일은 한 번에 한 화면만 보이므로 맞출 대상이 없다 → `min-height:0`.
  헤더 204 → 178px, 빈 공간 39 → 13px.
  ② **네비 레일을 더치페이(`.app-rail`)와 동일하게.** 말꼬리 위치(11→2px)·반투명+블러 배경,
  모서리 12px, hover translateY, 선택 시 inset 링을 모바일에도 적용.
  ⚠️ **선택 상태가 파란색이 아니라 회색이던 원인**: 네비 버튼은 `.nav-btn`과 `.tab` 클래스를
  함께 갖는데, `.tab.on{background:var(--card)}`이 `.nav-btn.on`보다 **뒤에 선언돼**
  같은 우선순위로 이기고 있었다. `.icon-nav .nav-btn.on`으로 우선순위를 올려 해결.
  → 네비 규칙을 만들 땐 반드시 `.icon-nav`를 앞에 붙일 것.
- `v2.61` — 헤더가 필요 이상으로 높던 것 조정. 상태바 아래 숨통 12→6px, 제목 아래 14→8px,
  헤더 아래 14→10px. **헤더 170 → 154px**(safe-area 62 기준), 윗여백 74 → 68px.
  ⚠️ 정정: v2.59의 54px 바닥값은 **env가 정상인 기기에선 아무 일도 하지 않는다**(`max`로 env쪽이 이김).
  사용자 기기는 env가 정상이었고, 11:24에 헤더가 잘려 보인 건 그때 **v2.55**였기 때문이다
  (v2.56이 이미 고친 상태). 54px 바닥값은 env가 0으로 오는 기기용 안전장치로만 남겼다.
  **헤더 높이를 바꿀 땐 반드시 이전/현재 수치를 재서 비교할 것** — 눈대중으로 원인을 지목하면 틀린다.
- `v2.60` — **토스트가 라이트 모드에서 읽히지 않던 것 수정.** 배경은 테마와 무관한 고정값
  `#252729`인데 글자만 `var(--label)`이라, 라이트에서 검은 글씨 + 검은 배경(**대비 1.26:1**)이 됐다.
  **규칙: 배경과 글자는 반드시 한 쌍의 토큰으로 묶는다.**
  ① 라이트 = 흰 배경 + 검은 글씨(18.9:1) ② 다크 = 어두운 배경 + 밝은 글씨(12.4:1)
  ③ 상태(오류·성공·경고) = 색 배경 + **흰 글씨**, 두 테마 공통.
  `--red`/`--green`을 그대로 쓰면 흰 글씨 대비가 2.1~4.1:1로 모자라
  토스트 전용 색(`--toast-err/ok/warn`)을 따로 뒀다 — 각각 5.6 / 5.0 / 4.8:1.
  ⚠️ 앞으로 색을 넣을 때 **배경만 고정값으로 두지 말 것.** 반드시 한쪽 테마에서 묻힌다.
- `v2.59` — **홈 화면 앱에서 헤더가 여전히 상태바에 가리던 것 수정.**
  v2.56은 `env(safe-area-inset-top)`이 제값을 준다는 전제였는데, iOS가 이 값을
  **0으로 주는 경우가 있어**(`viewport-fit=cover`를 줬는데도) 여백이 18px에 머물렀다.
  첫 페인트 전에 `navigator.standalone`/`display-mode:standalone`을 보고
  `<html>`에 `.is-standalone`을 달고, 그때만 **최소 54px** 여백을 깐다(env가 정상이면 max로 그쪽이 이김).
  브라우저 탭은 18px 그대로 — 브라우저 UI가 이미 상태바를 비켜 주므로 건드리면 안 된다.
  ⚠️ **헤더 여백을 env()에만 의존하지 말 것.** 이 앱에서 두 번(v2.56·v2.59) 같은 곳을 고쳤다.
- `v2.58` — **붙여넣기/링크만으로 결제수단까지 채운다.** 파서가 `결제수단:` 줄을 읽지 않아
  현금 영수증도 늘 기본값 '카드'로 남았고, 폰에서 매번 손으로 고쳐야 했다.
  `parseReceiptText`에 파싱을 넣고(카드/현금/계좌이체·이체·송금/기타) 폼 select에 반영한다.
  내장 프롬프트(`GPT_PROMPT`)에도 `결제수단:` 줄 추가 — 폰만으로 완결되도록.
  ※ 카테고리는 원래 `autocategorize()`로 자동 분류된다(학습 사전 `storeCatMap` 기준).
  빈 DB에서는 안 잡히므로 테스트 시 착각하지 말 것.
- `v2.57` — **스캔함으로 등록된 영수증에 결제자가 비어 있던 것 수정.** 수동 저장은
  `payerInp.value.trim()||getMyName()`으로 '내 이름'을 기본값으로 쓰는데,
  스캔 등록(`_dbxProcessScanbox`)만 `paidBy:''`로 하드코딩돼 있었다. 같은 기본값을 쓰도록 통일.
  ⚠️ `getMyName()`은 기기별 localStorage라 **스캔을 처리하는 기기에 '내 이름'이 설정돼 있어야** 채워진다.
- `v2.56` — **모바일 헤더가 상태바 아래로 잘리던 것 수정 + 버전을 모든 탭에서.**
  헤더(`.side-top`/`.main-top`)가 `height`로 **고정**돼 있는데 `padding-top`은
  `max(18px, safe-area-inset-top + 12px)`로 **가변**이었다. 두 값이 어긋나면 내용이 상자를 넘쳐
  윗부분이 잘린다 — safe-area가 0인 기기에서도 실제로 6px 잘리고 있었다(필요 114px vs 고정 108px).
  `height` → **`min-height`**로 바꿔 기준 높이는 지키되 필요하면 늘어나게 했다(`.main-top`은
  `flex:0 0 <basis>`도 `flex:0 0 auto`로). 높이 변수에도 safe-area를 더한다(노치 없으면 108px 그대로).
  **버전 칩**은 내역 탭 사이드바에만 있어 다른 탭에서 확인할 수 없었다. 각 탭 헤더 눈썹줄에
  `.main-eye-row` + `.js-app-version`을 두고 `querySelectorAll`로 주입한다.
  `#mainEye`는 JS가 textContent/innerHTML로 계속 덮어쓰므로 칩은 **그 안이 아니라 형제**로 둔다.
  같이 고친 것: **`.app` 높이가 `--cw-h`(미연결 경고 띠)를 빼지 않아** 띠가 뜨면 앱 전체가
  띠 높이만큼 밀려 **저장 버튼이 하단 nav bar 뒤로 숨던 v2.55 버그**.
- `v2.55` — **연결 안 된 기기를 알아볼 수 있게.** 모바일에서 저장했는데 내역에도 안 보이고
  완료 JPG로도 안 가던 일의 원인은 대개 **그 기기가 Dropbox에 연결돼 있지 않은 것**이다.
  localStorage는 기기마다 따로라 데스크탑에서 App key를 바꿔도 폰은 그대로인데,
  그 상태가 설정 탭에 들어가야만 보였다. 앱 껍데기(`.shell`) 위에 빨간 띠(`#connWarn`)를 두고
  어느 탭에서든 보이게 했다. 띠 높이(`--cw-h`)만큼 `.shell` 높이를 줄여 아래가 안 잘린다
  (모바일 목록 화면에서는 `.main`이 `display:none`이라 띠를 `.main` 안에 두면 안 된다).
  **`#k=<App Key>` 링크** — 데스크탑 설정의 '폰에서 연결할 링크 복사'로 만든 링크를 폰에서 열면
  키가 채워지고 Dropbox 인증이 바로 시작된다(폰에서 15자 키를 옮겨 적지 않아도 된다).
- `v2.54` — 앱에 저장한 사진이 완료 JPG·PDF로 가지 않던 것 보완. ① 동기화 때
  `_dbxArchivePending()`이 사진은 있는데 `scanPath`가 없는 영수증을 한 번에 최대 20건씩
  따라잡아 올린다(v2.52 이전에 저장한 것들). ② 저장할 때 결과를 토스트에 보여 주고,
  이 기기가 연결 안 됐으면 그 사실을 바로 알린다(`_warnNotConnectedOnce`, 세션당 1회).
- `v2.53` — **링크로 열면 추가 탭이 채워진 채 열린다.** `#r=<base64(UTF-8) 붙여넣기 형식 텍스트>`.
  모바일에서 가장 번거롭던 '복사 → 앱 전환 → 붙여넣기'를 링크 한 번으로 대신한다.
  사진만 붙이고 저장하면 된다.
- `v2.52` — 앱에서 붙인 사진도 완료 폴더에 사람이 알아볼 이름으로 올린다
  (`_dbxArchiveReceiptPhoto`, `rec.scanPath`). Dropbox 스캔함을 거치지 않아도 사진이 정리된다.
  나중에 매장명·금액을 고치면 `_dbxRenameScanFile`이 이름을 따라 고친다.
- `v2.51` — 앱이 지은 이름(`260809_영수증(5,900)_스타벅스 강남구청정문점`)을 되읽는다
  (`_parseOwnScanName`) — 이름만 규칙에 맞으면 스캔함에 넣는 것만으로 영수증이 통째로 완성된다.
- `v2.34` — **'위치 확인'이 App folder를 Full Dropbox로 오진하던 버그 수정.**
  판별이 "앱이 만든 이름" 목록을 하드코딩해 두고 그 밖의 항목이 있으면 Full Dropbox로 봤는데,
  목록에 옛 백업 파일(`receipt-db_2026-05-27_3items.json` 등)이 빠져 있어 App folder인데도
  Full Dropbox라고 답했다. 이름 패턴(`_APP_MADE_RE`)으로 앱 생성물을 걸러내고,
  **진짜 Dropbox 최상위에만 있는 앱 폴더 모음의 존재 여부**를 두 번째 근거로 함께 본다.
  ⚠️ 이 폴더 이름은 계정 언어를 따른다 — 한국어 계정은 `/앱`이라 `/Apps`와 함께 둘 다 확인한다.
  보고에 판단 근거(남의 항목 수 · /Apps 유무)도 같이 표시한다.
  ⚠️ Dropbox API에는 스코프를 직접 알려주는 호출이 없어 이건 여전히 **추정**이다.
- `v2.33` — **Dropbox 폴더 통합**: 저장 위치를 `/07_Apps/영수증(RECEIPT-DB)/`로 이동.
  스캔함 기본값도 그 폴더 안으로 되돌렸다 — v2.32가 밖으로 뺀 이유(경로가 너무 깊음)는
  데이터 폴더 자체가 최상위 두 단계로 얕아지면서 없어졌고, 영수증 관련 파일을 한 폴더에
  모으는 쪽이 찾기 쉽다. **경로를 설정에서 바꾸는 기능(v2.32)은 그대로 유지**한다.
  등록 완료 파일은 `등록완료/YYYY-MM/` 한 곳이 아니라 **`완료 JPG`/`완료 PDF`로 종류별 분류**
  (이름은 그대로 `YYYY-MM-DD_영수증.확장자`). 스캔함을 어디로 옮기든 완료본은 데이터 폴더에 모인다.
  맥 스크립트도 같은 스캔함·같은 완료 폴더를 쓰도록 통일. '위치 확인'에 데이터 폴더·이전 여부 추가.
- `v2.32` — **스캔함 위치 단순화**: 데이터 폴더 안(`…/영수증/Receipt_DB/스캔함`)에 있던 수신 폴더를
  **앱 최상단 `/스캔함`** 으로 옮김. App folder 스코프에서 경로가 두 번 중첩돼 Dropbox 앱에서
  매번 여러 단계를 타고 들어가야 했다. 설정에서 경로를 직접 바꿀 수 있고(`_K.SCAN_DIR`),
  **'위치 확인'** 버튼이 루트 목록을 읽어 App folder / Full Dropbox 를 판별하고 실제 위치를 알려준다.
  `_DBX_SCAN_DIR` 상수 → `_dbxScanDir()` / `_dbxScanDoneDir()` 함수로 변경.
- `v2.31` — 모바일 토스트가 하단 nav bar에 가려지던 문제 수정. `.toast-container`의 기본 `bottom:20px`이 nav bar(68px) 안쪽이라 메시지가 겹쳐 보였다.
  모바일에서 nav bar 위 12px로 띄우고, 일괄 전송 바가 떠 있을 땐 그보다 더 위로 올린다.
- `v2.30` — **모바일 저장 버튼이 사라지던 버그 수정**: 액션바를 `position:fixed`에서 `sticky`로 되돌림.
  `body`가 `overflow:hidden`이고 `.main-body`가 스크롤 컨테이너인 구조라, iOS에서 키보드가 열리면
  레이아웃 뷰포트는 그대로인 채 비주얼 뷰포트만 줄어 fixed 액션바가 화면 밖으로 밀려났다.
  붙여넣기는 반드시 키보드를 쓰므로 매번 재현됐다. sticky는 스크롤 컨테이너 기준이라 영향 없음.
  fixed 시절의 `padding-bottom:63px` 보정 제거, 모바일에서 `⌘+↵` 힌트 숨김(줄바꿈 깨짐).
- `v2.29` — 스캔함 폴더를 동기화 때 자동 생성. 폴더가 없으면 사용자가 파일을 넣을 곳을 찾을 수 없어
  기능이 시작조차 안 되던 문제. 설정 카드에 폴더 찾는 법(Dropbox 검색) 안내 추가.
- `v2.28` — **스캔함 (Dropbox 수신 폴더 자동 등록)**: `Receipt_DB/스캔함/`에 사진을 넣으면 동기화 때
  앱이 등록하고 `등록완료/YYYY-MM/YYYY-MM-DD_영수증.ext`로 이름을 바꿔 이동(충돌 시 `-2`, `-3`).
  날짜는 파일명 → EXIF 촬영일 → Dropbox 업로드 시각 순. EXIF는 외부 라이브러리 없이 APP1 직접 파싱.
  ID는 `rec_YYYYMMDD_p<내용sha1 6자리>`로 결정적이고 레코드에 `srcHash`(전체 sha1)를 남겨,
  폰·다른 컴퓨터가 동시에 처리해도 중복 레코드가 생기지 않음. PDF는 사진 없이 레코드만 생성.
  맥 스크립트도 `srcHash` 추가 + 이동 실패 시 배치 전체가 유실되던 문제 수정.
- `v2.27` — **월별 PDF 내보내기 (인쇄)**: 설정 탭에서 달·품목포함 여부를 고르면
  인쇄 전용 DOM(`#printRoot`)을 만들고 `window.print()` — 인쇄 창에서 'PDF로 저장'.
  외부 라이브러리 없이 `@media print`로만 구현. 요약·카테고리별·영수증 목록·품목 상세 순.
- `v2.26` — **한글 초성(자모) 검색**: 검색어가 자음만이면(`ㅎㄴㄹ`) 초성 인덱스로 매칭.
  가게명·카테고리·결제자·참석자·태그·메모·품목명 전부 대상. 쌍자음은 예사소리로 접어(`ㄲ→ㄱ`) `ㄱㅊㅈ`로도 `꼬치집`이 나옴.
  초성 질의는 IME 조합 중에도 즉시 반영(마지막 자음이 버퍼에 남아 한 글자 늦던 문제).
- `v2.25` — CLAUDE.md를 코드 실제 상태와 동기화: 다크 테마(기본)·테마 전환 섹션 신설,
  브레이크포인트 700→780px, 아이콘 원칙(인라인 SVG + PNG 4개), 카테고리 16종·`normalizeCategory` alias 구조,
  `capture` 함정 정정, v1.63~v2.07 changelog 공백 요약. **앱 동작 변경 없음.**
- `v2.24` — 모바일 액션바 `position:fixed`(하단 nav bar 위) 전환 → sticky 오작동 근본 수정. `.main-body` 하단 패딩 63px.
- `v2.23` — 모바일 `#viewInput .main-body` padding-bottom 56px (v2.24에서 63px로 재조정).
- `v2.22` — `.view.on`의 `overflow:hidden` 제거 → 카테고리 팝오버가 잘리던 버그 수정.
- `v2.21` — 저장/초기화 버튼 높이 36px·좌우 패딩 2배. `.side-foot` min-height 55px → 사이드바 구분선과 액션바 구분선 수평 정렬.
- `v2.20` — 액션바 gap 완전 차단: `#viewInput .main-body` padding-bottom 0 + 액션바 margin-bottom 0.
- `v2.19` — 저장 바 버튼 너비 auto·kbd 크기 확대·하단 클리핑 개선.
- `v2.18` — 저장 바 sticky 전환 + Cmd+Enter 저장 단축키 추가.
- `v2.17` — 합계 행 수직 정렬 middle로 통일.
- `v2.16` — 금액 확인 메시지 텍스트 간결화.
- `v2.15` — 모바일 상세내역 품목명 정렬 및 계산 확인창 위·아래 회색 여백 통일.
- `v2.14` — 카테고리 아이콘의 선 굵기를 통일하고 여행 아이콘 확대.
- `v2.13` — 상세내역 계산 확인창의 위·아래 여백 조정.
- `v2.12` — 다중 영수증 일회성 전송 묶음 안정화 및 네비게이션 설명 통일.
- `v2.11` — 교통 버스 아이콘 적용 및 카테고리 아이콘 시각 크기 통일.
- `v2.10` — 영수증 다중 선택·더치페이 일괄 전송 및 AI 인식 금액 이중 검증.
- `v2.09` — 카테고리 PNG 아이콘 교체 PR 릴리스 버전 반영.
- `v1.63`~`v2.07` — *개별 항목 누락 구간.* git 로그 기준 실제 반영분 요약:
  v1.66 진단 버튼(로컬 DB·deletedIds 상태) / v1.67 이미지 Dropbox 개별 파일 저장·자동 다운로드 /
  v1.68~v1.70 상세내역 프롬프트 복사 버튼 / **v1.71 다크 테마 도입** + 카테고리 SVG 아이콘 + Dutch Pay식 상세 헤더 /
  v1.72~v1.73 아이콘 네브 컬럼·가계부 아이콘 / v1.83~v1.95 상세·모바일 레이아웃 다듬기,
  카테고리 SVG 그리드·키워드 규칙, **v1.88 Dutch Pay 연동** / v2.00~v2.01 아이콘 더치페이 디자인 정렬.
  (v1.63~65, v1.74~82, v1.87, v1.96~99, v2.02~07은 git에도 없음 — 결번)
- `v2.08` — 제공받은 PNG로 주요 카테고리 아이콘 교체: 외식·카페·술집·노래·숙박·운동·골프·경조·의료·영화·스파.
- `v1.62` — ⚠️ *이후 크게 바뀜 — 현재 구조는 위 「카테고리 자동 분류」 섹션을 볼 것.
  이 항목의 19종·밥집·`catGrid`·`r-cat-thumb`·`migrateLegacyCategories`는 지금 코드에 없다.*
  **카테고리 아이콘 세트 (dutch-pay 통일)**: 고정 19종(밥집·카페·술집·마트·쇼핑·교통·노래방·병원·문화·스파·운동·골프·여행·숙박·선물·경조사·부의금·축의금·기타) + 직접 입력. 입력 폼은 아이콘 그리드(catGrid, 기본 '자동'), 사이드바 카드에 카테고리 아이콘 원(r-cat-thumb), 가계부 막대에도 아이콘. 상세 화면 카테고리는 select. 구 카테고리 자동 마이그레이션(외식·배달→밥집, 병원·약국→병원, migrateLegacyCategories — 멱등, init 시 실행). BASE_CATEGORIES는 CATEGORIES에서 파생.
- `v1.61` — **Dropbox 스캔함**: `Receipt_DB/스캔함/` 폴더에 PNG/JPG를 넣으면 동기화 때 앱이 자동 등록(사진 첨부, 파일명→날짜 추출), 처리된 파일은 `스캔함/등록완료/`로 이동. ID `rec_YYYYMMDD_s+content_hash6` — 기기 간 결정적이라 중복 등록 없음. 맥 스크립트 없이 모바일에서도 동작. 실제 Dropbox 경로: `01_Personal/Apps/앱/Receipt_DB_v1/01_Personal/영수증/Receipt_DB/스캔함/` (App folder 스코프 매핑 주의).
- `v1.60` — **상세 화면 품목 붙여넣기**: 상세내역 헤더에 '붙여넣기' 버튼 추가 — GPT 품목 표(또는 응답 전체)를 붙여넣으면 parseReceiptText로 품목만 추출해 한 번에 적용. 기존 품목이 있으면 교체 확인. 총액은 유지(불일치 시 기존 경고 표시). 자동등록(품목 없음) 영수증 채우기용.
- `v1.59` — **스캔 자동화 수신함(inbox) 머지**: 동기화 다운로드 시 `Receipt_DB/receipt-db_inbox.json`을 추가로 읽어 새 레코드·사진을 머지. inbox는 맥의 영수증 스캔 자동화 스크립트(receipt_pdf_to_jpg.py --receipt-db)만 쓰고 앱은 읽기 전용 — 파일별 단일 쓰기 주체로 동기화 경합 제거. 오래된 inbox 항목 정리는 스크립트 책임(14일).
- `v1.49` — Dropbox 폴더 정리 반영: 자동 동기화 파일을 `/01_Personal/영수증/Receipt_DB/receipt-db_sync.json`, 수동 백업을 `/01_Personal/영수증/Receipt_DB/backups/`에 저장. 삭제된 SVG 아이콘 대신 PNG 아이콘 링크 명시.
- `v1.50` — Dropbox 동기화 실패 수정: 중첩 폴더를 부모부터 생성하도록 `_dbxEnsureFolder`를 보강하고, 새 저장 경로에 맞게 Dropbox 앱 접근 유형을 `Full Dropbox`로 안내.
- `v1.51` — Dropbox 한글 경로 오류 수정: `Dropbox-API-Arg` 헤더 안의 한글 경로를 ASCII-safe JSON으로 변환해 백업/복원/자동 동기화 fetch 실패를 방지.
- `v1.57` — 사진 입력 `capture="environment"` 제거: 아이폰에서 카메라 강제 실행 대신 사진 보관함 선택도 가능하도록 수정.
- `v1.52` — 모바일 사진 동기화: 자동 동기화 JSON에 사진 base64를 포함하고, 모바일/다른 기기에서 누락된 사진 blob만 IndexedDB에 복원.
- `v1.00` — Phase 1 MVP: 영수증 추가/목록/상세/검색/JSON 백업
- `v1.01` — Phase 1.5 가계부 화면: 월 네비, 요약 카드 3장, 카테고리 막대, 일별 sparkline, 전월 대비
- `v1.02` — 시간 필드 UI 제거, 카테고리 자동 분류(기본 9개 + 사용자 학습 사전), 좌측 상단 버전 칩
- `v1.03` — 미리보기를 편집 가능한 폼으로 (매장명·일자·총액·품목 직접 수정 가능, 품목 추가/삭제 버튼).
  파서가 빈 품목명 라인도 살려서 보여줌. 품목 없는 영수증(노래방·주유·병원)도 warning만 띄우고 저장 가능.
- `v1.04` — **합계 자동화**: 수량×단가 → 금액 자동, 모든 금액 합 → 총액 자동. **GPT 응답의 총액 줄은 무시**(`_gptTotal`로 참고용 보존만).
  실제 영수증 총액이 자동 합계와 다를 땐 (봉사료·할인·세금) 사용자가 총액 input에 **수동 입력** → `_totalManual=true` 플래그, 자동 갱신 정지.
  자동 복귀는 ↺ 버튼. 수동 모드에서 자동 합계와 다르면 warning.
- `v1.05` — **레이아웃 재구성**: 좌우 2단 그리드 → 위→아래 4행 (붙여넣기·사진 / 미리보기 전체 폭 / 옵션 그리드 / 저장).
  품목명 input이 넓어져서 긴 품목명도 잘 보임. 금액 셀은 `readonly` div (수량×단가 자동, 수정 불가) → Tab 흐름 자연스럽게 다음 행으로.
  일자 input은 클릭/포커스 시 `showPicker()`로 달력 즉시 열림 (Chrome/Edge).
  단가·금액·총액 모두 천단위 쉼표 표시 (`_fmtN/_parseN` 헬퍼, `type="text" inputmode="numeric"`).
  포커스 시 쉼표 제거 + select(), blur 시 쉼표 복귀.
- `v1.07` — **Dropbox OAuth 연동 (Phase 3)**: Authorization Code + PKCE (서버·client_secret 불필요).
  설정 탭에 연결 가이드 + App Key 입력 → Dropbox 인증 → 콜백에서 자동 토큰 교환.
  refresh_token으로 자동 갱신 (access_token 4h, refresh_token 영구). 토큰·계정 localStorage 보관.
  수동 백업 버튼 (기존 JSON export와 동일 포맷 → Dropbox /receipt-db_날짜_N건.json 업로드).
  Dropbox에서 복원: 파일 목록 모달 → 파일 선택 → 기존 import와 동일 방식 복원.
  `_dbxBindEvents()` 1회 바인딩, `renderDbxSettings()` 설정 탭 전환 시 자동 호출.
- `v1.08` — **결제자(`paidBy`) 필드 추가**: 입력 폼 (결제자·카테고리 row-2), 상세 화면 kv, 검색 필터, 사이드바 카드 meta.
  사이드바 카드 썸네일(r-thumb) 제거 — 텍스트·금액 정보만 표시.
- `v1.09` — **상세 화면 레이아웃 재구성**: 품목 테이블 최상단(전체 폭) → 그 아래 2단 그리드(좌=영수증 사진 / 우=매장명·일자·카테고리·결제수단·결제상세·결제자) → 하단 메모·태그. 모바일에서는 단일 열 전환.
- `v1.15` — **결제자 검색 전용 요약 패널**: "결제자 홍길동" 입력 시 오른쪽 패널에 결제 건수·합계 히어로 카드 + 카테고리 분포 막대 + 영수증 목록 테이블 표시.
- `v1.16` — **품목명 기반 카테고리 보조 추정**: 가게명으로 카테고리를 못 잡을 때 품목명 키워드 투표(CAT_ITEM_RULES)로 fallback. 술집·카페·교통·병원·문화·외식·마트 7개 규칙, 최소 2점 이상 시 채택.
- `v1.17` — **식품 동의어 사전(FOOD_TAXONOMY)**: 치즈→하바티/고다/체다, 맥주→테라/카스/기네스 등 14개 분류 양방향 확장 검색. **품목 검색 통계 개선**: 구매횟수·총수량·총지출 히어로 카드 + 단가 기준 최저/평균/최고 + 구매이력 테이블에 수량·단가 컬럼 추가.
- `v1.18` — **사이드바 sticky 고정**: position:sticky + max-height:100vh으로 영수증 목록이 길어져도 "+ 추가" 버튼 항상 하단 고정. **자동 결제자 감지**: "결제자 " 접두어 없이 이름만 검색해도 전체 결과 paidBy 일치 시 결제자 요약 패널 자동 표시.
- `v1.19` — **Dropbox 자동 동기화**: 영수증 저장·수정·삭제 시 백그라운드로 `receipt-db_sync.json` 자동 업로드(사진 제외 경량, 수십 KB). 앱 시작 시 Dropbox에서 자동 다운로드 후 로컬과 머지. 머지 전략: 같은 ID → updatedAt 최신 우선, 새 ID → 추가. 삭제 추적(`deletedIds`) → 양방향 삭제 동기화. 사이드바 하단에 마지막 동기화 시각 뱃지 표시. 사진은 수동 풀백업에서만 포함.
- `v1.20` — **± 부호 전환 버튼**: 미리보기 폼 품목 금액 셀 좌측에 원형 빨간 `±` 버튼 추가. 클릭 시 금액 부호 반전(할인·환불 품목 입력용). 단가도 함께 반전해 수량·단가 수정 후에도 부호 유지.
- `v1.21` — **참석자 필드**: 입력 폼·상세 화면에 `participants: string[]` 추가(쉼표로 구분). 상세 화면에서 참석자 2명 이상이면 1인당 분담금 표시. 가계부 월 요약에 '참석자별 분담' 막대 섹션 추가(1/N 균등 배분). 검색(이름 포함, "참석자 X" 접두어 지원) · CSV 내보내기에도 포함.
- `v1.23` — **접이식 섹션 토글**: 결제자/참석자/검색 요약 패널의 구매 이력·자주 함께한 멤버 섹션 + 가계부의 일별 지출·참석자별 분담 섹션을 chevron 버튼으로 접고 펼치기. 열림/닫힘 상태 `localStorage`에 저장(`tog_*` 키).
- `v1.24` — **섹션 토글 버그 수정**: SVG `className` 직접 할당 → `setAttribute('class', ...)` 변경. `section-body` 인라인 padding을 내부 div로 이동(max-height:0 완전 붕괴). closed 상태 `pointer-events:none` 추가.
- `v1.25` — **± 부호 전환 버튼 제거**: 품목 금액 셀의 원형 빨간 ± 버튼 삭제 (CSS·HTML·JS 전체).
- `v1.26` — **품목 드래그&드롭**: 미리보기 폼 품목 행 왼쪽 ⠿ 핸들, 포인터 이벤트 기반(마우스+터치 통합). **중복 감지**: 날짜·가게명·금액 일치 시 저장 전 확인 다이얼로그. **결제자+참석자 통합 대시보드**: 이름 검색 시 두 역할 모두 있으면 결제 총액·참석 분담 히어로 카드 + 각 내역 섹션 함께 표시.
- `v1.27` — 결제자·참석자·통합 패널 테이블에서 카테고리 컬럼 제거 (막대 그래프로 충분).
- `v1.28` — 통합 대시보드 중복 계산 수정: 참석 내역에서 본인이 결제자인 영수증 제외.
- `v1.29` — **내역 화면 수정 확인 버튼**: 품목·메모·참석자·태그 변경 후 "수정 확인" 버튼으로 한 번에 저장. blur 자동저장 제거 → 명시적 확인 UX. 되돌리기 버튼으로 변경 취소. **내역 화면 품목 드래그&드롭**: ⠿ 핸들로 품목 순서 변경, 확인 버튼으로 저장.
- `v1.30` — **모바일 인물 검색 레이아웃**: 결제자/참석자/통합 패널 검색 시 요약 패널이 영수증 목록 위에 표시 (헤더·검색창은 유지). CSS `display:contents` + `order` 트릭, DOM 변경 없음.
- `v1.31` — **검색 버그 수정**: 영수증 선택 상태에서 검색창에 타이핑하면 선택된 영수증 상세가 그대로 보이던 버그. 검색어 입력 시 `selectedId` 즉시 초기화.
- `v1.32` — **정보 필드 상시 편집 가능**: 매장명·일자·카테고리·결제수단·결제 상세·결제자를 click-to-edit 대신 항상 보이는 입력창으로 변경. "수정 확인" 버튼 하나로 품목·메모·참석자·태그·정보 필드 모두 저장.
- `v1.33` — **추가 탭 탭 순서 정렬**: 결제수단→결제상세→참석자→결제자→카테고리→태그→메모 순으로 DOM 재배치. 결제상세를 동적 드롭다운으로 전환(카드/현금/계좌이체/기타별 옵션), 결제수단 변경 시 자동 갱신.
- `v1.34` — **날짜 검색**: 검색창에 `전체`(전체 연도 요약) · `2026년`(연간 요약, 월별 막대) · `2026년 5월`(월 가계부) · `5월`(교차연도 5월 비교) 입력 시 맞춤 통계 패널 표시. `_parseDateQ` 파서 + `renderAllSummaryHtml` / `renderYearSummaryHtml` / `renderCrossYearMonthHtml` 렌더러 추가.
- `v1.35` — **인물 검색 시간 필터**: 결제자/참석자/통합 대시보드 패널 상단에 pill 버튼(전체·연도별·월별) 표시. 연도 pill 클릭 시 해당 연도 내 월 pill 추가 노출. 검색어 변경 시 필터 자동 초기화.
- `v1.12` — **일자 kv 달력 즉시 열림** (상세 화면 클릭 시). **사용방법 가이드 제거** (프롬프트 복사 버튼만 우측 배치). **기기별 초기 탭**: 데스크탑→추가, 모바일→내역. **모바일 UX**: 목록 높이 42vh 제한 + 영수증 선택·저장 시 상세 패널로 자동 스크롤. **엑셀(CSV) 내보내기**: 일자·매장명·카테고리·결제수단·결제자·총액·품목목록 포함, UTF-8 BOM으로 엑셀 한글 정상 표시.
- `v1.11` — **탭 순서 변경**: 추가→내역→설정. **천단위 쉼표**: 상세 화면 품목 단가·금액 입력 (포커스 시 쉼표 제거, blur 시 복원). 수량 input type=text 전환(스피너 제거). 프리뷰 폼 헤더 우측 패딩 정렬.
- `v1.10` — **드래그&드롭 사진 추가**: 입력 폼·상세 화면 모두 이미지 파일 드래그&드롭 지원 (터치 기기 자동 감지, 데스크톱만 힌트 표시).
  **카테고리 확장 검색**: "술" 입력 → 술집 카테고리 키워드(소주·맥주·진로·테라·카스 등) 품목명·가게명에서도 매칭.
  **결제자 접두어 검색**: "결제자 홍길동" 입력 시 paidBy 필드만 필터링. 검색창 placeholder 힌트 추가.

## 데이터 모델
```js
Receipt {
  id: "rec_20260519_001_lz5y",    // rec_YYYYMMDD_NNN_<rand> (NNN=기기 내 순번, <rand>=기기 간 고유 난스 v2.95~)
                                  //   스캔 등록분은 rec_YYYYMMDD_p<내용sha1 6자리> (결정적)
  date: "2026-05-19",        // YYYY-MM-DD
  time: "14:30",             // 선택, HH:MM
  store: "하나로마트 청담점",
  category: "마트",          // 사용자 정의 (Phase 2에서 자동 분류)
  paymentMethod: "card",     // card | cash | transfer | other
  paymentDetail: "현대카드",
  total: 27020,              // 정수, 원 단위
  items: [
    {
      name: "P오플레 클래식 플레인 1+1 680.0g",
      quantity: 1,
      unitPrice: 3980,
      amount: 3980,          // 음수면 할인/쿠폰
      category: ""            // Phase 2
    }
  ],
  imageId: "img_xxx",        // 이미지 store의 별도 키 (Blob)
  notes: "",
  tags: ["식료품"],
  createdAt: ISO,
  updatedAt: ISO
}
```

## 저장소 (IndexedDB)
- DB 이름: `receiptdb`, **버전 2** (v1 → v2 마이그레이션: settings store 추가)
- Object stores:
  - `receipts` (keyPath: `id`) — 영수증 메타데이터
  - `images` (keyPath: `id`) — `{id, blob, mime}` 이미지 Blob 분리 저장
  - `settings` (keyPath: `key`) — `{key, value}` 형식. 카테고리 학습 사전 등
- 마이그레이션은 `onupgradeneeded`에서 idempotent하게 처리 (`if(!contains)`)
- localStorage는 UI 설정 정도만 사용 — Blob 때문에 메인 데이터는 IndexedDB

## GPT 텍스트 포맷 (사용자 → 앱 입력)
```
매장명: 하나로마트 청담점
일자: 2026.05.19
총액: 27,020원

품목명 | 수량 | 단가 | 금액

P오플레 클래식 플레인 1+1 680.0g | 1 | 3,980 | 3,980
테라 4.6%(캔) 453ml*8 | 2 | 12,720 | 25,440
[쿠폰]테라 453ml 8캔 | 1 | -2,400 | -2,400
```
- 쉼표는 천 단위 구분만
- 할인/쿠폰은 금액에 `-` 부호
- 파싱 후 자동 검증: `sum(items.amount) === total` 일치 확인,
  불일치 시 빨간 경고 표시 (저장은 가능 — 사용자 판단)

## 프롬프트 (앱에 "복사" 버튼)
사용자가 ChatGPT 등에 사진과 함께 붙여넣을 프롬프트:
```
이 영수증을 정확히 아래 형식으로만 정리해줘. 형식 외 다른 설명·문장 금지.

매장명: [가게 이름]
일자: YYYY.MM.DD
총액: ##,###원

품목명 | 수량 | 단가 | 금액

품목1 | 1 | 1,000 | 1,000
품목2 | 2 | 500 | 1,000

쉼표는 천 단위 구분만 쓰고, 품목명은 영수증에 적힌 그대로 유지해줘. 할인/쿠폰은 금액에 - 붙여서.
```

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
- **표시 라벨은 따로** — 저장 데이터 호환성을 유지하면서 화면에는 케이크→기념, 영화→문화, 병원·약국→의료, 경조사→경조로 표시
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
- **시간 필드**: 데이터 모델엔 `time` 유지 (마이그레이션 안전), UI에서만 제거.
  파서는 시간 인식 가능하지만 현재 GPT 프롬프트엔 시간 항목 없음.
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

## 알려진 함정 (작업 시 주의)
- IndexedDB Blob 저장: `imageId`만 receipt에 두고 Blob은 분리 store에 — JSON export 시 base64로 직렬화 필요
- `JSON.stringify` 결과를 HTML 속성에 그대로 넣지 말 것 → 별도 escape 헬퍼
- 이름·품목명 파싱: 파이프(`|`)가 구분자, 품목명에 파이프 들어오면 깨짐 — 사용자가 GPT한테 받는 거라 실용적으로 무시
- 사진 첨부 input은 `accept="image/*"`만 — `capture="environment"`는 v1.57에서 제거했다.
  다시 넣으면 아이폰에서 카메라가 강제 실행돼 사진 보관함 선택이 막힌다.
- IndexedDB 트랜잭션은 microtask 안에 다 끝내야 — async/await 중간에 외부 await 끼면 트랜잭션 종료됨

## 현재 상태 (2026-08-31 기준)
- **버전 `v2.57`** — main에 push 완료. 로컬 = origin.
- 로컬 경로: `~/Documents/Codex/2026-08-26/new-chat/work/receipt-db`
- 배포: `git push origin main` (GitHub `sh4sh-ux/receipt-db`)

### 최근 작업 (2026-08-31)
- `v2.56` 모바일 헤더 잘림(height 고정 ↔ padding 가변) + 버전을 모든 탭 헤더에 표시.
  `.app` 높이에서 `--cw-h` 누락돼 저장 버튼이 nav bar 뒤로 숨던 v2.55 버그도 함께 수정.
- `v2.57` 스캔 등록 영수증의 결제자 기본값을 '내 이름'으로 통일.
- 데이터 정리: 스타벅스(2026-08-09) 중복 2건 삭제, 완료 JPG의 해당 사진도 삭제.

### ⚠️ 저장소 밖(맥 로컬) 변경 — 이 repo에 없음
`receipt_pdf_to_jpg.py`(경로: `~/Documents/Codex/2026-06-02/pdf-jpg/scripts/`)와
LaunchAgent 2개가 **v2.33 이후에도 옛 경로(`/01_Personal/영수증`)를 보고 있어** 고쳤다.
- plist `--root`/`WatchPaths` → `/07_Apps/영수증(RECEIPT-DB)`(주), `…/서류(A4)변환`(A4)
- 스크립트 `RECEIPT_DB_DIR`, `default_dropbox_root()` → 새 경로 우선
- `_STORE_NORMALIZERS`에 쉼표 교정 추가(`다이소,강남구청역점` → `다이소 강남구청역점`).
  한글 인접 쉼표만 바꾼다 — 숫자 천단위(`1,000`)를 망가뜨리면 안 되므로.
- 백업: `~/Library/LaunchAgents/_backup_20260831_102959/`
- **사진(`스캔함`)용 `receipt_png_to_receipt_db.py`는 LaunchAgent가 아직 없다.** 수동 실행만 가능.

### 알아둘 것 (이번에 확인된 동작)
- **앱은 사진 속 글자를 읽지 않는다(OCR 없음).** 스캔함에서 매장명·금액을 얻는 유일한 단서는
  **파일 이름**이다. 규칙에 안 맞는 이름이면 날짜는 `파일명 → EXIF → 업로드시각` 순으로 추정하는데
  이건 영수증 날짜가 아니라 **사진 날짜**다. 그래서 넣기 전에 이름을 규칙대로 바꿔야 한다.
- **스캔 등록분을 지우면 같은 사진을 다시 넣어도 재등록되지 않는다.** ID가 `rec_{date}_p{내용sha1 6}`
  라 `deletedIds`에 걸린다(v2.28의 의도된 동작). 현재 `rec_20260809_pc3ed40`이 여기 들어가 있다.
- **붙여넣기 파서가 읽는 필드는 매장명·일자·날짜·시간·총액/합계·품목 줄뿐이다.**
  `카테고리`·`결제수단`·`결제자` 줄은 무시된다. 결제자는 저장 시 `getMyName()`으로 채워지고,
  결제수단은 폼에서 직접 골라야 한다.
- `#r=<base64url(UTF-8)>` 링크로 추가 탭을 채운 채 열 수 있다(v2.53). 실제 동작 확인함.

### 미결
- **`#r=` 링크로 열면 카테고리가 자동 분류되지 않는다**(`카테고리 선택`으로 남음).
  `autocategorize()`가 '스타벅스 강남구청정문점'에서 카페를 못 잡는지, 링크 경로에서
  자동 분류 호출이 빠지는지 확인 필요. 사용자 테스트 결과 대기 중.

### 작업 흐름
브랜치 생성 → 커밋 → main으로 squash merge → `git fetch origin main && git rebase origin/main` → push → 브랜치 삭제.
`gh` CLI는 이 환경에 없으므로 PR 없이 로컬 squash merge로 진행.

## 다음 작업 후보
- PWA 마무리 — **절반은 이미 되어 있음**: `apple-mobile-web-app-*` / `mobile-web-app-capable` 메타태그와
  `icons/icon-192.png`·`icon-512.png`·`apple-touch-icon.png`는 있고, **`manifest.json`과 서비스워커만 없다**.
- `receipt-db/` 화석 폴더(v1.02 사본) 삭제
