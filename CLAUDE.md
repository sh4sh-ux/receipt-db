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
- `v3.89` — **사람 요약 레이아웃 재구성(배치만 — 계산·값 불변, 새 계산 없음).** 같은 숫자가 3곳(한턱 밸런스·함께한 씀씀이·지출 비교)에 반복되고 헤더와 '함께한 기록'이 같은 개수를 보이던 것을 정리. 우선순위 순서: ① **결제 밸런스**(한 카드 + `[전체·단둘이·여럿이]` 전환 `_psnSeg` — 문장 '○○이 N원 더 냈어요' + 막대 하나 + 두 금액·%, 전체=기존 전체 결제(`#relDetailPay`)·여럿이=기존 여럿이(`#relDetailGrp`)·단둘이=tgtDuo/myDuo 실결제) ② **만남**(횟수 → 만남 목록 `#relMtgConfirmed`, 단둘이/여럿이, **마지막 만남 날짜·N일 전**, 최근 12개월 함께한 영수증 막대, 자주 간 곳 상위 3(2회↑), 함께한 영수증·장소 수, 묶이지 않은 영수증 `#relMtgOrganize`) ③ **한턱**(단둘이 한턱 문장+막대+상대/나 → 기존 `data-duo` drill, 전체 내가 한턱 `#relDetailTreat`, 단둘이 일반 분담·결제자 미상) ④ **참석 부담액**(`#relDetailShare`) ⑤ 최근 함께한 내역 ⑥ 한턱 내역(v3.75 그대로) ⑦ 관계. 데스크탑(컨테이너 700px↑) = 왼쪽 결제 밸런스·한턱·최근 내역 / 오른쪽 만남·참석 부담액·한턱 내역·관계, 좁으면 위 순서로 한 열. 헤더 소제목 `만남 N회 · 마지막 만남 M월 D일 (N일 전)`, 사람 목록 `만남 N회 · 최근 M월 D일`. 제거: 지출 비교·함께한 씀씀이·주요 항목 2×2·함께한 기록 칸(내용은 위 카드로 이동). 이름 색 없음(v3.88), 숫자·막대만 상대 `--amber`/나 Blue. **검증**(실데이터 151, 1280·390·430): 값 = v3.78 검증 숫자(신유철 전체 431,900/2,453,500 · 여럿이 0/1,948,500 · 단둘이 한턱 320,900/265,000 · 전체 내가 한턱 399,600/8 · 참석 595,884), 전환 3종, drill-down 8종 열림, 헤더·목록 문구, 뒤로가기(v3.84)·만남 차수(v3.83·v3.87) 회귀 PASS, overflow 0·콘솔 에러 0. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.88` — **이름에는 색 없음.** 사람 화면(씀씀이 행 이름·'○○이 더 한턱' 문장·최근 내역 '○○ 결제')과 추가 화면(참석자 행·결제자 select·사람 picker·선택된 사람)의 이름 색(주황/파랑)을 기본 글자색으로. 색은 숫자·막대·범례 점에만 남김(숫자 규칙 섹션에 명시). 목록의 선택 항목 강조·상세 분담 chip의 결제자 표시(v3.79 그대로)는 상태 표시라 유지. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.87` — **영수증 상세에서 연 만남 시트에서도 차수 변경.** 시트에 `[순서 변경]` → ≡ drag(마우스·터치·키보드 ↑↓) → `[완료]`. 만남 편집과 같은 `_mtgBindReorder`(공통 함수로 추출)·`_mtgSaveOrder`(atomic·rollback). 순서 변경 중에는 row 탭(영수증 열기)·'만남에서 분리' 숨김. 보기 모드는 기존 그대로. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.86` — **영수증 상세 결제자 = 드롭다운.** v3.84에서 v3.79 입력칸으로 되돌리며 결제자가 자유 텍스트였던 것을, 같은 칸 위치·모양 그대로 select로(후보 = 현재 참석자 + 참석자 밖 현재 결제자 + `+ 다른 사람…` → 회사·가족 등 직접 입력 picker, 참석자에 강제 추가 없음). 참석자 칸을 고치면 후보가 즉시 갱신, 빈 결제자는 '결제자 선택'(자동 지정 없음). 저장은 hidden `paidBy` input(기존 경로·DIRTY/CLEAN 그대로). 추가 화면과 같은 `_payerSelectRender`/`_payerSelectBindChange` 공유. 상세 kv select(결제자·결제수단)에 ▾ 표시. 한턱 안내 조사 수정('조상현가' → '조상현이', `_psnJosa`). 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.85` — **레일 아이콘 색 통일.** 통계·사람만 흐리게 보이던 원인: 기본 `.nav-btn{color:--label3}`을 뒤에 선언된 `.tab{color:--label2}`가 **탭 버튼(내역·추가·선불권·설정)만** 덮어써, 탭이 아닌 통계·사람 버튼만 흐린 색으로 남았다. `.icon-nav .nav-btn{color:--label2}`로 6개 모두 같은 또렷한 기본색, hover = `--label`(한 단계 진하게)+옅은 배경, 선택 = 기존 Blue. 데스크탑 레일·모바일 하단 nav 공통. ⚠️ 레일 규칙은 반드시 `.icon-nav`를 앞에 붙일 것(v2.62 교훈 — `.tab` 등 다른 규칙과 우선순위 충돌). 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.84` — **뒤로가기 3단계 점프 수정 + 영수증 상세 입력칸 v3.79 복원 + 숫자 규칙(Dutch Pay와 동일). ⚠️ 계산·schema·저장 경로·Dropbox·Dutch Pay 불변.**
  ① **뒤로가기**: 오버레이(만남 요약·만남 시트·사람 drill-down 등)에서 영수증을 열면 '오버레이 닫기(history.back) → 영수증 열기' 순서인데, 닫는 순간 popstate가 대기 중이던 route 기록을 취소해 **영수증이 history 없이 열렸다** → 다음 Back이 밑의 화면(사람 상세)까지 건너뛰고, 한 번 더 누르면 앱을 벗어났다(재현: 사람→만남→요약→영수증→Back = 사람 탭 이전, Back 2 = 앱 이탈). 수정: popstate 오버레이 분기에서 after(이동)를 `_recordNavAround`로 감싸 **화면 이동(selectedId·tab·person)만** 기록(기간·필터 적용은 기록 안 함 — v3.73 불변). **돌아갈 곳 = 연 곳**: 만남 요약/시트에서 연 영수증은 이전 엔트리 route에 `mtg`(데이터 정리함 v3.76과 같은 route 방식)를 남겨 Back 시 그 만남 화면을 다시 연다(복원 뒤 route의 mtg는 지워 중복 열림 방지). 만남 관리 안의 **요약 단계도 history 엔트리 1개**(`dEntry`) — Back = 요약→목록→사람 상세 한 칸씩, 오버레이 전체 닫기는 `history.go(-2)`로 두 엔트리를 함께 소비. 영수증 상세 breadcrumb = `‹ 9월 29일의 만남`(route.crumb).
  ② **영수증 상세 입력칸 = v3.79 그대로**(사용자 요청): 결제자(텍스트)·결제수단 / 참석자(쉼표 텍스트) / 분담 방식(🎉 한턱 설명 bar + 분담 chip + 안내). v3.82의 상세 결제자 select·참석자 compact row는 상세에서만 되돌림(**추가 화면은 v3.82 compact 유지**).
  ③ **숫자 규칙**(위 「숫자 규칙」 섹션): 전역 `font-feature-settings:'tnum'` 제거(쉼표가 넓어지던 원인) · `fmtMoney` = `toLocaleString('ko-KR')`(Dutch Pay `fmt`와 동일, 출력 동일) · 관계 분석 상대 숫자 = 순수 `--amber`(어두운 주황 color-mix 제거).
  변경 파일 `index.html`·`CLAUDE.md`.
- `v3.83` — **만남 차수(Order) — 같은 만남에 묶인 영수증의 순서를 1차·2차…로 기록, '만남 편집'에서만 drag로 변경. 정산 기능 아님(그날의 흐름 기록용). ⚠️ 계산(total·paidBy·participants·splitExclude·treat·treatBy·Person·Meeting count·단둘이/여럿이·Relation Group·사람별 분담·통계)·Dutch Pay payload·Meeting List(Blue Bar·'N건 묶음 · 대표매장')·Add/Receipt Detail/Quick Confirm/Person/Review Inbox 전부 불변, migration 없음.**
  **필드**: optional `receipt.meetingOrder`(양의 정수). `_validateReceiptRecord`가 정수만 보존(손상 값은 키 제외) → Dropbox merge(`{...raw}`·updatedAt 최신 우선)·백업 export/import roundtrip 그대로. **runtime 순서 `_mtgOrdered`**: 값이 없으면 기존 순서(`_mtgSortByDate`), 있으면 오름차순(중복·null·손상도 화면은 1..N으로 정상, DB 자동 수정 없음). 같은 meetingId에 실제 2건 이상일 때만 차수 표시(1건 만남·독립 receipt는 표시 0).
  **표시**: 만남 상세(관리 화면 detail + 영수증 상세의 만남 시트)는 `1차 | 매장 … 금액` 보기 전용. **편집**: 만남 편집 row = `[선택] 1차 | 매장 … 금액 | ≡`. ≡ handle(44px, `touch-action:none`)만 drag — row 탭(선택)과 역할 분리라 drag 중 상세 열림·선택 토글 0. drag 중 DOM 재배치 없이 `translateY`로 미리보기(끄는 row 그림자·나머지 한 칸씩 비킴·차수 라벨 즉시 갱신, 가장자리 자동 스크롤) → 놓는 순간 재배치 + `_mtgSaveOrder`(바뀐 receipt의 meetingOrder만 `_mtgApply` atomic·rollback). 키보드 ↑/↓도 지원. ⚠️ drag 중 요소를 DOM에서 옮기면 pointer capture가 풀려 move/up을 잃는다(첫 구현 실패 원인).
  **편집 연동**(`_mtgApplyPlan` — 여러 receipt 변경을 한 번에): 추가·다른 만남으로 이동 = 대상 만남 기존 순서 1..N 확정 + 새 receipt 마지막 차수 · 분리·이동의 원래 만남 = 남은 receipt 재번호(순서가 기록된 만남만) · 분리·전체 풀기·영수증 상세 '분리' = meetingId와 함께 meetingOrder 제거(stale 0) · 새 만남 묶기 = 차수 미기록(runtime 날짜 순서).
  **검증**(실데이터 151 + 5건/2건/1건 만남 fixture, Desktop 1280·Mobile 390·430 각 18항목 ALL PASS): A 순서 없음 → 1~5차(DB 미기록) · B drag 5차→2차(1280 mouse·390/430 CDP touch) → 1~5 재번호 저장 · drag 중 상세 열림/선택 0 · handle 44×57px · Edit→Back→Detail 새 순서 · C 3차 분리 → 1~4 · D 추가 → 마지막 · E 이동 → 원래 재번호·대상 마지막 · F 전체 풀기 stale 0 · G 1건 만남 차수 0 · 손상 order(1,1,4,null) 화면 1~4·DB 불변 · 계산 영향 0(meetingOrder 변경 전후 `_participantSplit`·`_receiptShare` 동일) · Dutch Pay 전송 함수 meetingOrder 없음 · validator/JSON/merge roundtrip · swipe-back 오버레이만 닫힘·reload 0 · overflow 0 · 콘솔 에러 0. iPhone Safari 실기기 drag 미검증. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.82` — **사람 UI 최종 정리 — 결제자 select · 참석자 compact · '(나)'/avatar 제거 · 관계 분석 상대 Orange · keyboard-safe 사람 추가. ⚠️ `parseReceiptText`·schema·계산(`_participantSplit`/`_receiptShare`/Person/Meeting)·저장 경로·Relation Group·Review Inbox·기간 Filter·Dropbox·Dutch Pay·migration 전부 불변(표시·입력 UI만).**
  ① **결제자 = 일반 select field**(`_payerFieldHtml`, Add는 참석자 아래·Detail은 기본 정보 칸 — 같은 컨트롤). 후보 = 현재 참석자(+ 참석자 밖 현재 결제자, 참석자 0명이면 나) + `+ 다른 사람…`(→ picker, 회사·가족 등 직접 입력). 💳·큰 payer card 없음, 1명만(paidBy 단일 — 복수 결제 미도입). 빈 결제자: Add=저장 규칙대로 나 표시, Detail='결제자 선택'.
  ② **참석자 = compact row**: 헤더 `참석자 · 분담  N명  + 추가` + 행 `[이름 · 분담 badge · ×]`(행 36px·badge 22px/탭 영역 32px·× 28×32, flat 구분선·radius 없음, 폭 따라 2~4열 — 6명도 390px에서 3줄). 0명이면 `[+ 나][+ 사람]`(자동 참석 없음). badge 탭 = 분담↔깍두기(기존 `splitExclude`).
  ③ **'(나)'·이름 앞 avatar/icon 제거**(참석자·picker·결제자·Person 한턱 밸런스·사람 목록 이니셜 `.pl-av`·`psn-side-ic`·`rel-duo-ic`·지출 비교 점). 저장 이름은 그대로(표시만).
  ④ **색**: Add/Detail = 나 Blue · 그 외 neutral(Green 제거). **관계 분석만** 상대 = Dutch Pay Orange(`--psn-t`=`--amber` — 라이트 #FF9500·다크 #FF9F0A, dutch-pay `--txn-amber`와 동일), 나 = Blue.
  ⑤ **사람 추가 시트 keyboard-safe**: 모바일에서 backdrop을 `visualViewport`(키보드 위 보이는 영역)에 맞추고 시트를 flex column으로 — 키보드가 열려도 검색칸·입력값·선택된 사람·결과가 보이고 결과 목록만 스크롤(iOS layout viewport 함정, v2.30과 같은 원인). 구조 = 헤더(사람 추가 N명·완료) → 검색 → 선택된 사람(× 빼기) → 결과/직접 입력. **쉼표 여러 명**(`김승환, 박지훈, 이민수` → `3명 추가`, Enter 가능 — 참석자 input과 같은 split 규칙 + 정규화 중복 제거).
  ⑥ **한턱** = 한 줄 compact(`한턱` + 스위치), 참석자 2명↑일 때만. 개인/공동 주체 선택 그대로.
  **검증**(실데이터 151 + 관계 그룹 fixture, Desktop 1280·Mobile 390·430 각 29항목 ALL PASS): A 참석자 없음 · B 나만 · C 둘 다 분담 · D 깍두기 · E 개인 한턱(결제자 불변) · F 공동 한턱 · G 결제자 select 왕복(분담 불변)+다른 사람 '회사'(참석자 강제 추가 없음) · H 결제자 삭제(재지정 없음) · I 6명·긴 이름(행 ≤36px·이름 1줄·badge/× 안 밀림) · J 쉼표 3명 — 각 저장 → DB 일치 → Detail 재오픈 = Add. Detail에서 select/깍두기/한턱 → DIRTY → 저장 → 재오픈 CLEAN. keyboard-safe(visualViewport 508px 시뮬레이션: 시트 하단 508·입력 391·결과 2행 보임). 관계 분석 bar rgb(255,149,0)·나 Blue·'(나)' 0·avatar 0. overflow 0·콘솔 에러 0. iPhone Safari 실기기 미검증. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.81` — **Add / Receipt Detail 참석자·결제자·분담 UX 통일 — 세 개념 분리(A 참석자+분담 = 사람 단위 · B 결제자 = 영수증 속성 1개 · C 한턱 = 이벤트). ⚠️ `parseReceiptText`·schema·계산(`_participantSplit`/`_receiptShare`)·저장 경로(`saveBtn`·상세 `_doConfirm`)·Person·Meeting·Relation Group·Review Inbox·기간 Filter·Dropbox·Dutch Pay·migration 전부 불변.**
  ① **v3.80의 '이름 탭 = 결제자' 폐기.** 참석자 칩 = `[이름(나=Blue·상대=Green) | 분담 badge | ×]` 한 줄 — 이름은 표시만, **badge 탭 = 분담↔깍두기**(기존 `splitExclude` 토글, 한턱이면 전액/0원 고정), ×=참석자 빼기. badge 색은 identity와 겹치지 않게 **분담=neutral(fill2)·깍두기=secondary gray 점선**. 0명=`[+ 나][+ 사람]`(자동 참석 없음), 1명↑=`[+]`.
  ② **결제자 = 별도 row** `결제자 💳 조상현(나) ›` → 결제자 picker(`_qcOpenPicker('payer',c)`): 기본 후보=현재 참석자 radio(선택 💳) + **`+ 다른 사람`**(참석자 밖 결제자 — 검색·초성·최근·직접 추가, 참석자에 강제 추가 없음). 참석자 밖이면 row에 '참석자 아님'. 결제자 × 삭제 시 **자동 재지정 없음**(paidBy 유지). 빈 결제자: Add는 저장 규칙대로 `getMyName()` 표시, Detail은 '결제자 선택'.
  ③ **🎉 한턱**은 칩 밖, 참석자 2명↑일 때만(켜져 있으면 유지). 주체 선택(개인/공동, 관계 그룹 후보만·자동 공동 없음) 그대로.
  ④ **Add와 Detail이 같은 코드**: `_peopleBlockHtml(prefix)`(markup) + `_bindPeopleUI(c)`(칩·+나·+사람·결제자 row) + `_makeSplitUI({cards:true})`. Detail의 결제자 kv·참석자 kv는 hidden 저장용 input(`#dPayerInp[data-field=paidBy]`·`#dParticipants`)으로 남겨 기존 저장·`_detailSnapshot`(DIRTY/CLEAN)을 그대로 탄다. Add 순서 = 기본 정보 → 참석자·분담 → 결제자 → 한턱 → 추가 정보 → 저장. Desktop/Mobile 동일 interaction(데스크탑 전용 select 없음).
  **독립성**: 결제자 변경 → 분담 상태 불변 / 분담 변경 → paidBy 불변 / 한턱 ON → 결제자 불변(Add·Detail 모두 검증). `_setAddSaveState`(v3.79)·상세 저장 바 ghost 수정(v3.80) 유지.
  **검증**(실데이터 151 + 관계 그룹 fixture, Desktop 1280·Mobile 390·430 각 33항목 ALL PASS): A 참석자 0 · B 나만 · C 나+신유철 · D 신유철 결제(picker 후보=참석자+다른 사람) · E 깍두기 · F 개인 한턱 · G 공동 한턱(treatBy) · H 결제자 왕복(분담 불변) · I 분담 왕복(paidBy 불변) · J 결제자 삭제(재지정 없음) · K 참석자 밖 결제자 — 각 Add 저장 → DB 값 일치 → **Detail 재오픈 표시 = Add 표시**(칩·결제자 row·한턱·+버튼). Detail에서 같은 조작(결제자/깍두기/한턱/×) → DIRTY → 저장 → 재오픈 CLEAN. hit area 겹침 0(badge 30px·× 34×38px), 6명·긴 이름 wrap, 이중 저장 바 0, overflow 0, 콘솔 에러 0. iPhone Safari 실기기 미검증. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.80` — **추가 화면 compact — '항상 펼쳐놓기' → '필요할 때 선택' + 참석자 중심 결제자/분담(모바일 세로 공간 축소, 기능 삭제 없음). ⚠️ `parseReceiptText`·`validateParsed`·저장 경로(`saveBtn`)·`_setAddSaveState`(v3.79 fix)·Receipt schema·계산(`_participantSplit`/`_receiptShare`/splitExclude/treat/treatBy)·Person·Meeting·Relation Group·Review Inbox·Dropbox·기간 Filter·migration 전부 불변.**
  ① **함께한 사람 = 참석자 카드**: 기본 화면엔 선택된 사람만. 각 카드 hit area 3개 분리 — **이름 영역 탭=결제자 💳 지정**(항상 1명·`paidBy` 하나의 값, 다른 이름을 누르면 💳 이동), **상태 영역 탭=분담↔깍두기**(기존 `splitExclude` 토글, 한턱이면 전액/0원 고정), **×=참석자 빼기**. 결제자 카드 상태에는 '결제 · 분담' 보조 표기. 색은 identity만(**나=Signature Blue·상대=Green**) — 결제자라고 색을 바꾸지 않고 💳로만 표시. 구현은 공통 `_makeSplitUI`의 **opt-in 모드**(`onPickPayer`·`onRemove`·`meName` 옵션을 넘길 때만 카드 렌더) → 상세 화면은 옵션을 넘기지 않아 기존 칩 그대로(계산·getState 동일). 참석자 0명=`[+ 나][+ 사람]`(나 자동 참석 없음, 제품 구매 등 참석자 없는 영수증 허용), 1명 이상이면 `[+]`. `+ 사람`/`+` = 사람 picker(`_qcOpenPicker`, 기존 `_mtgSheetOpen` 재사용 → overlay history/swipe-back 계약 그대로; 검색·초성·최근 순·**목록에 없는 이름 '직접 추가'** — 기존 직접 입력 기능 이동). 최근 추천 chip은 기본 화면에 없음.
  ② **별도 결제자 row 없음.** 결제자가 참석자에 없을 때(참석자를 뺐거나 회사 등)만 한 줄 안내 `💳 결제 신유철 · 참석자 이름을 누르면 결제자가 바뀌어요 [다른 사람]`(참석자 밖 결제자는 picker로). **결제자를 빼도 자동 재지정 없음**(payerInp 값 유지 = 기존 paidBy 규칙, 비어 있으면 저장 시 `getMyName()`).
  ③ **🎉 한턱**은 사람 카드 밖, 참석자 2명↑일 때만 표시(이미 켜졌으면 유지). ON이면 기존 개인/공동 주체 선택(관계 그룹 후보 있을 때만, 기본 개인·자동 공동 없음).
  ④ **추가 정보**(접힘 1 row, 요약 `카드 · 카페 · 메모 · 태그 N`) → 결제수단·카테고리(같은 row grammar, 기존 select·카테고리 팝오버 그대로)·경조사 필드·메모·태그.
  ⑤ **상세 모바일 저장 바 ghost 수정**: 상세에서 수정 후 저장 안 하고 추가 탭으로 가면 body 고정 `#mobileSaveBar`(상세 전용)가 추가 화면 저장 버튼 위에 남았다 → `switchTab`에서 내역 탭이 아니면 `.off-tab`으로 숨김(상세 DIRTY 상태는 유지, 내역으로 돌아오면 다시 보임). unsaved-change 정책은 만들지 않음.
  **Legacy 조사(sync.json 151건)**: 참석자 있는 113건 중 **paidBy가 참석자에 없는 영수증 0건**(paidBy 비어 있음 2건·참석자 없음 38건) — 데이터 변경 없음. **효과**: 붙여넣기 후 입력 영역 높이 390px 1317→약 730px. Desktop은 레일·왼쪽 영수증 목록·오른쪽 추가 화면 3단 그대로(같은 interaction, 카드가 한 줄에 더 많이). **검증(실데이터 151 + 관계 그룹 fixture)** Desktop 1280·Mobile 390·430 각 20항목 PASS: A 참석자 0 저장, B 나만→결제자, C 신유철 결제자, D 신유철 깍두기(결제자 불변), E 개인 한턱, F 공동 한턱(treatBy), G 결제자 조상현→신유철→조상현(💳 항상 1개), H × 제거(자동 재지정 없음) — 각 저장 후 상세 재오픈 시 paidBy·participants·splitExclude·treat·treatBy 복원 일치, hit area 겹침 0(이름 30·상태 26·× 56px), 6명·긴 이름 wrap(이름 1줄 ellipsis·상태 안 잘림), 저장 바 ghost 0, overflow 0, 콘솔 에러 0. iPhone Safari 실기기 미검증. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.79` — **영수증 입력 Quick Confirm — 'OCR=초벌 입력, 틀린 값만 tap 수정 후 저장'. ⚠️ 파서(`parseReceiptText`)·검증(`validateParsed`)·저장 경로(`saveBtn`)·Receipt schema·계산·Person·Meeting·Relation Group·treat/treatBy·사람별 분담·Review Inbox·기간 Filter·Dutch Pay·Dropbox·schema/migration 전부 불변.**
  ⚠️ 이 앱에는 OCR 엔진이 없다(OCR·외부 API 금지 원칙) — 'OCR 결과'는 사용자가 AI로 정리해 붙여넣은 텍스트를 `parseReceiptText`가 읽은 값. 엔진·파서·신뢰도 모델은 건드리지 않음.
  ① **영수증 확인(Primary 3)**: 미리보기 상단을 매장·날짜·총액 3 row로. **row 전체가 `<label>`이라 tap = 그 자리 input 편집**(모달·modal chain 없음). 빈 값은 `매장명 입력`·`날짜 선택`·`금액 입력` CTA(Signature Blue) — **가짜 0원·오늘 날짜·알 수 없는 매장 자동 입력 없음**. 파서는 총액 줄이 없어도 `total:0`을 돌려주므로(불변) 원문에 숫자 총액 줄이 없으면 `p._totalMissing`(UI 표시 전용, 저장 안 함)으로 '금액 입력'을 보이고, 실제 `총액: 0원`만 0원. **✓·확실/의심 같은 confidence 표시 없음**(파서에 신뢰도 정보가 없어 추정하지 않음). 매장/총액 blur 시 포커스가 확인 영역 안에 남아 있으면 전체 재렌더 대신 부분 갱신(`_qcRenderIfIdle`) → 다음 row를 바로 tap해 고칠 수 있음.
  ② **품목(Secondary)**: 굵은 구분 뒤 `품목 N개 · 합계 일치 / 금액 확인 필요 / 품목 없음` 한 줄, **기본 접힘** → 펼치면 같은 자리의 **기존 item editor**(수량·단가·금액·추가·삭제 그대로). 새 validation 없음 — '금액 확인 완료' 초록 alert·필수값 error alert는 row 상태로 대체(표시만), 금액 불일치 alert·저장 직전 확인창은 그대로.
  ③ **누구와 함께했나요? / 결제자 chip**: 후보 = 나 → (사람 화면 `+ 영수증 추가`로 왔을 때) 그 사람 → 이미 입력된 사람 → 최근 영수증에 등장한 사람 6명(runtime 계산·캐시 없음). **자동 선택 없음**. chip은 기존 `participantsInp`/`payerInp` 텍스트를 바꾸고 input 이벤트를 보낼 뿐(저장은 기존 경로가 그대로 읽음), 직접 입력칸도 유지. 결제자 후보 = 나 + 선택한 참석자, **나=Signature Blue·상대=Green**(사람 화면 identity와 동일), 결제자 칸이 비면 저장 규칙(`getMyName()`)대로 '나'를 선택 표시.
  ④ **분담 방식**: 접힌 요약 row(`일반 분담`/`한턱 · 김영석 · 이종현 공동`/`N명 분담 제외`) → 펼치면 `[일반 분담|한턱|분담 제외]` + 기존 `_makeSplitUI`(분담 chip·한턱 주체). 한턱 주체는 한턱일 때만(기존 Relation Group 후보 로직 그대로).
  ⑤ **Mobile**: 붙여넣기 후 원문·사진 영역을 84px 한 줄로 접어(원문 편집·사진 추가 그대로) 확인 영역이 첫 화면에 옴. 순서 = 영수증 확인 → 품목 → 사람 → 결제자 → 분담 방식 → 추가 정보(결제수단·카테고리·태그·메모). 금액 `inputmode=numeric`·16px(iOS 확대 없음), 저장 바는 기존 `.main-body` 밖 flex 형제 그대로(키보드·nav 충돌 없음). Desktop은 레일·왼쪽·오른쪽 3단 구조 그대로, 붙여넣기 후 원문·사진 영역만 148px로 낮춤.
  ⑥ **기존 버그 수정(v3.51부터)**: 추가 화면의 `_setSaveState(disabled,msg)`가 v3.51 상세 화면 `_setSaveState(state)`와 **이름이 같아 뒤의 선언이 덮어써**, 붙여넣기·직접 입력이 유효해도 **추가 화면 저장 버튼이 켜지지 않았다** → 추가 화면 쪽을 `_setAddSaveState`로 이름만 변경(상세 저장 UX 불변).
  **미도입**: correction learning·매장/품목 alias·영수증 유형 자동 분류·'나중에 확인' flag(기존 Review Inbox가 담당)·AI 추천·자동 참석 처리. **검증(실데이터 151 + 관계 그룹 fixture, 영향 범위만)**: 붙여넣기→확인 3 row·품목 접힘·저장 활성, row tap 수정(모달 0)·총액≠품목 합계 시 '금액 확인 필요', 품목 펼침→단가 수정→접힘, 사람/결제 chip(자동 선택 0·나 Blue/상대 Green), 공동 한턱(주체 후보 2개 → treatBy 저장), 저장→상세 재오픈 값 일치, 총액·날짜 없음 → '금액 입력'/'날짜 선택'(0원 아님), 사람 화면 context 후보, 직접 입력 저장 활성, Desktop 1280·Mobile 390/430 overflow 0·저장 버튼 화면 안·콘솔 에러 0. iPhone Safari 실기기 미검증(WebKit 설치 불가). 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.78` — **사람(Person) 화면 UI/UX 재구성 — UI composition만. ⚠️ Receipt·Person 계산·단둘이 한턱·여럿이·전체 결제·전체 내가 한턱·참석 부담액·개인/공동/전체 한턱·Meeting·meetingId·Relation Group·사람별 분담·기간 Filter·Review Inbox·Dutch Pay·Dropbox·schema·migration 전부 불변.**
  ① **레일 '사람'** 신설(single-person icon, `#navPersonBtn` — 통계와 같은 비-tab nav 버튼이라 `.icon-nav .nav-btn` 크기·위치 그대로). **'관계'는 사람 상세 안의 분석 용어로만** 사용(§1·§23). 장소·품목은 이번 STEP 밖이라 가짜 메뉴를 만들지 않음(§7·§31). 모바일 하단 nav가 6개가 되면서 64px 고정폭이면 390px에서 넘쳐(6×64+36=420) **폭만 균등 축소(`flex:1 1 0; max-width:64px`)** — 430px 이상은 기존 64px 그대로.
  ② **좌측 패널 = 영수증 목록 grammar 그대로(`.side` 재사용, 새 sidebar 없음 §2·§22)**: 사람 모드(`.side.person-mode`)에서 제목 '사람' · **month-nav 자리에 범위 행 `#personScope`[전체]**(`class="month-nav"`라 박스·하단선이 같아 **좌/우 헤더 하단선 정렬 유지** — 1280/1536 차 0px) · **같은 `#searchInp`**(사람 모드에선 `_personListQ`로 사람 목록만 거름·초성 지원, **영수증 `searchQuery`와 분리**) · list-toolbar `사람 N명` + `#personSortSel`[함께한 순|최근순|이름순](`#listSortSel` 스타일 공유) · **`.r-card` flat row**(패딩·divider·hover·선택 동일, 작은 이니셜·관계 그룹 라벨만) · side-foot 그대로. 목록 값 `함께한 영수증 N건 · 만남 N회`는 **renderDetail 인물 분기와 같은 파이프라인**(부분일치 payer/part → `_personRelation` → `together`·`_personMeetingStats`)이라 **상세 헤더와 동일**(`_personIndex`, 데이터 signature 바뀔 때만 재계산). ⚠️ **배포 전 정리**: 처음 넣었던 '자주 만난(만남 3회↑)/최근 만난(90일)' 필터는 제품 정책이 확정되지 않은 임의 기준이라 **제거** — 목록은 `전체` + 정렬만. '자주 보는 사이' 같은 자동 관계 표현 없음(§4). **Meeting 경로 감사**: 사람 목록·상세 헤더·함께한 기록의 만남/단둘이/여럿이는 전부 기존 `_personMeetingStats`(v3.61 정의: unique meetingId(grouped, `_mtgReceiptsById`+`_mtgPeopleUnion` 전역 union) + meetingId 없는 receipt(independent))를 그대로 호출 — v3.78은 이 helper를 수정하지 않았고 새 fallback도 없음(diff 확인).
  ③ **우측 Person Detail = 기존 '인물 검색' 분기를 `_personSel`로 그대로 통과**(effective query — 헤더·기간 slot·drill-down 바인딩 재사용, 사람 이름은 날짜/접두어 해석 안 함) → **숫자 동일**. `renderPersonDashboardHtml`은 **계산 줄을 하나도 바꾸지 않고** me 분기에서 이미 계산한 컬렉션을 `psn`으로 넘겨 `_psnLayoutHtml`이 재배치('내 이름' 없으면 기존 구성 그대로): 탭 **[요약 | 상세 내역]**(상세 내역=기존 결제·참석 내역·자주 함께한 멤버, 표시 전환만·history 없음) + **+ 영수증 추가**. 요약 = **한턱 밸런스**(이름 우선 '신유철 / 조상현(나)', Green/Blue, %, runtime 차이 문장 — 주체·조사 동적, 동일하면 '서로 비슷하게') · **함께한 씀씀이**(여럿이·전체 결제, Green/Blue bar) · **주요 항목 2×2**(전체 내가 한턱·참석 부담액·묶이지 않은 영수증·일반 분담) · **최근 함께한 내역**(flat, 결제자 색 identity, 5건+전체 보기, row→기존 영수증 상세). **Insight(컨테이너 700px↑일 때 오른쪽, 1280부터)**: 함께한 기록(만남·영수증·장소 N곳·가장 많이 간 곳 — together 매장 표시 집계, 저장 없음) · 지출 비교(행마다 나 vs 상대) · 한턱 내역(v3.75 renderer 그대로) · 관계(관계 그룹 설정 그대로). 좁으면 한 열 **§17 순서**(한턱 밸런스→함께한 기록→씀씀이→주요 항목→최근 내역→한턱 내역→관계, 지출 비교는 중복이라 숨김). **drill-down 계약 전부 유지**: `data-duo`(tgt/me/normal/unknown)·`#relDetailGrp/Pay/Treat/Share`·`#relMtgConfirmed/Organize`·`#pgTreatSolo/Co/All`·`[data-rgedit]/[data-rgnew]`·`.srch-row[data-id]`(+ `div[role=button][data-duo]` Enter/Space 위임 추가).
  ④ **색 identity(§5)**: 상대 = Green(`--green`), 나 = Signature Blue — Hero·비교 bar·지출 비교·최근 내역 결제자 전부 같은 규칙, 상대별 랜덤 색 없음. 0원은 강조색 대신 muted.
  ⑤ **+ 영수증 추가(§16)** = 레일 '추가'와 같은 경로(사람 모드 종료 후 추가 탭). ⚠️ 선택한 사람을 참석자 후보로 넘기는 **기존 안전 경로가 없어 새로 만들지 않음**(자동 participant 저장 없음).
  ⑥ **Navigation**: route에 `personMode`·`personSel` 추가 → 사람↔영수증 상세 Back·swipe-back 복귀(영수증 상세 breadcrumb도 '‹ 신유철'). 모바일 = 목록→상세(`mobile-list/detail-view`, v3.41 `mob-person-view`는 영수증 검색 전용으로 유지), `‹ 사람`은 `#backToSummaryBtn` 재사용이라 history.back(). 영수증 탭·통계·홈으로 나가면 사람 모드 종료·좌측 원복(선택한 사람은 기억). 사람 화면 안의 이름 클릭(`data-ppname`)은 그 사람 상세로. 관계 그룹 저장 후 사람 목록·상세 갱신.
  **검증(실데이터 151건 · 나=조상현, 영향 범위만 §29)**: **v3.77(이름 검색) vs v3.78(사람 탭) 계산 결과 동일 26/26명**(한턱·여럿이·전체 결제·전체 내가 한턱·참석·한턱 내역·만남 id·헤더) · 기간 9월 선택 시 동일 scope(41→3건) · 표시=계산(신유철 320,900/6 vs 265,000/5·55/45%·'신유철이 55,900원 더'·여럿이 0/1,948,500·전체 결제 431,900/2,453,500·전체 내가 한턱 399,600/8·참석 595,884/32·일반 분담 9) · 목록 row=상세 헤더 · drill-down 12종 열림·Back=오버레이만 닫힘 · 최근 내역→영수증 상세→Back 복귀 · 영수증 추가 · 목록 검색/초성/필터/정렬·영수증 검색어 불변 · Desktop 1280/1536(Insight 오른쪽·헤더 하단선 차 0px) · Mobile 390/430(목록→상세·§17 순서·nav 6개 화면 안·마지막 섹션 nav 위·긴 이름/매장명 ellipsis) · overflow 0 · 콘솔에러 0. ⚠️ 이 스냅샷엔 meetingId가 없어 만남=영수증 수(신유철 41회) — 실기기(만남 14회)는 사용자 확인. iPhone Safari 미검증(WebKit 설치 불가). 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.77` — **데이터 정리함(Data Review Inbox) 최종 UI/UX 폴리시 — 표시만. ⚠️ 새 기능 없음 — `reviewIssues` 판정·6조건·count·Receipt 계산·Person·한턱·Relation Group·사람별 분담·Meeting·기간 Filter·Dutch Pay·Dropbox·schema/migration 전부 불변, Quick Fix 없음.**
  ⚠️ **§2 조사(0원 의미)**: `reviewIssues`의 amount(총액 없음)는 `total`이 `null`/`undefined`/`''`/NaN일 때만 잡힌다 — **`0`은 유한수라 '총액 없음' 미판정**(실제 총액 0원). 따라서 정리함에 뜨는 '0원'은 사실상 **case B(총액 없음/invalid)**를 가짜 0원으로 렌더한 것이었다 → **없음/invalid면 강조된 볼드 0원을 만들지 않고 muted `—`**로 표시(`hasTotal=Number.isFinite(Number(r.total))`)하고 그 receipt는 아래 '총액 없음' 사유로 안내. 실제 total=0(유한)이면 그대로 '0원'. ① **0원 정렬**(전 뷰포트 right edge 통일): 각 row를 `grid-template-areas`(icon|store|amt|chev / icon|date|chev / icon|issue|chev)로 재구성, `.review-row-amt{justify-self:end}`로 짧은 금액/`—`도 우측 X축 통일. ② **문구 친화화**(§3): `reviewIssues(i).short` = 매장명 없음/날짜 없음/총액 없음/품목 합계 불일치/수량·단가 확인/사진 확인(기존 6사유만·새 issue 없음), row는 `.short` join. ③ **헤더 위계**(§4): 장문 요약 제거 → `확인이 필요한 영수증 N건`(primary, `.review-sub b`), 유형 count는 기존 필터 chip(secondary)로만. ④ **Flat List + 작은 유형 icon**(§5): `_reviewTypeIcon(type)` 인라인 SVG(store/date/amount/photo/warn), 문제별 큰 Card 없음. ⑤ **색 절제**(§6): icon만 muted amber(`--amber`), 문제 설명 neutral(`--label2`), 금액·매장명 primary(`--label`), Red/Orange 남발 제거. ⑥ **3줄 row**(§7): [icon] 매장명 … 금액 › / 날짜 / 문제 사유, 긴 매장명 ellipsis, 금액/chevron wrap 없음, row 클릭=기존 `selectReceipt`(Receipt Detail). ⑦ **정렬**(§8): 최신순 `_sortForList` 유지(issue 2개+ 우선 노출은 정렬 의미가 바뀌므로 **제안만·미구현**). ⑧ Empty(§10): `확인할 영수증이 없습니다.`(애니메이션/카드 없음). ⚠️ 저장 후 즉시 재평가·하단/정리함 count 감소·reload 0(v3.76 그대로 §9), open/close write 0. **검증(영향 범위만 §13, 합성 fixture)**: 없음/invalid total row = muted `—` + 정상 금액과 같은 right edge(Desktop 1280/390/430 최대차 0~1px), 실제 total=0은 '0원' 유지, 친화 문구·유형 icon 존재, 필터 chip, row→Receipt Detail, 저장→count 감소(회귀), 가로 overflow 0·콘솔에러 0. ⚠️ **실 Production IndexedDB는 개발환경 미접근 — 합성 fixture만 검증, iPhone Safari 미검증(WebKit 설치 불가)**. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.76` — **'확인 필요 N건'을 「데이터 정리함(Data Review Inbox)」으로 발전(불완전 영수증을 유형별로 파악·바로 수정해 하나씩 0건으로). ⚠️ 새 검증 항목 없음 — 기존 `_receiptCheckReasons` 6조건 그대로라 count 불변, 기존 Receipt 계산/Person/Meeting/Relation Group/Dutch Pay/Dropbox 의미 전부 불변.**
  ⚠️ 조사(§2): 하단 '확인 필요 N'의 진실원은 runtime `_receiptCheckReasons(r).length>0`(저장 field 아님), **전역 `receipts`** scope(기간/Person 검색과 무관 §28·§29), 6조건 = ①수량×단가≠금액 ②품목합계≠총액 ③사진 문제(`_photoErrorKind==='problem'`, '사진 없음'=missing과 별개) ④매장명 없음 ⑤일자 오류 ⑥총액 없음. **paidBy 누락·참석자·meetingId·OCR은 미포함** → 이번에도 추가 안 함(§17·§19·§20·§21·§23). **단일 진실원 `reviewIssues(r)`** 신설(타입별 `[{type,label}]`, type=store/date/amount/photo) → 하단 count·정리함 count·유형 count·row label 공유(§16). `_receiptCheckReasons=reviewIssues().map(label)`로 하위호환(라벨·순서·dedup 동일 → **count byte-identical** §3·§38). **정리함**: '확인 필요' 칩 클릭 → `_openReviewInbox`(mtg-sheet overlay grammar 재사용·Desktop 중앙/Mobile full-height). Header `확인 필요 · N건 · 유형 summary`, compact 필터 `[전체 N][매장명 N][일자 N][금액 N][사진 N]`(count>0만), unique receipt 목록(최신순 `_sortForList`, row=날짜·매장·금액·유형 label). **한 receipt 다중 issue 가능** → Header N=unique receipt 수, 유형 count=해당 issue 가진 receipt 수(§7). row 클릭 → 기존 `selectReceipt`(Receipt Detail, 새 Editor 없음 §11·§14). **저장 후 즉시 재평가**(§12): 기존 저장 경로로 수정→Back 시 `_updatePhotoFilterUi`+`reviewIssues` runtime 재계산 → 하단/정리함 count 즉시 감소(reload 0). **일부만 해결**되면 receipt는 남고 해결된 issue만 사라짐(§13). **navigation**: receiptNavigation route에 `reviewInbox`(boolean) 추가 → open/close/receipt sub-route를 **popstate로 관리**(v3.72~73과 동일 history 시스템, 새 시스템 없음 §5). 정리함 open→swipe-back/X/backdrop/ESC=정리함만 닫힘·route 유지·reload 0(§31), 정리함→Receipt→back=정리함 복귀(type/scroll module 상태 복원 §30·§32). 필터 변경은 history 엔트리 안 만듦(list만 재렌더). **'사진 없음'(missing) 칩은 기존 목록 필터 그대로**(정리함과 분리 §18). ⚠️ 자동 receipt 수정 없음(§36)·새 저장 field 없음(`needsReview` 등 미도입, runtime 판별 §15)·Dropbox 계약 불변(review index 저장 안 함 §33·§34)·schema/migration 없음. 정리함 열고 닫기만으로 write 0(§33). Data Health %·AI 검증·OCR 변경 미도입(§35·§43). 검증(합성 fixture): 정상 issue 0·payer는 미포함(현 정의 유지)·store 누락 issue 1·store+date 2 issue(unique 1)·1개 해결 시 unique 유지 issue 1·전부 해결 시 unique 0·기존 count 일치(reviewIssues=_receiptCheckReasons)·open push +1·swipe-back 정리함만 닫힘·정리함→Receipt→back 복귀·reload 0·Desktop/390/430 overflow 0·회귀 0·콘솔에러 0. ⚠️ **실 Production IndexedDB는 개발환경 미접근 — 합성 fixture만 검증, 실제 '확인 필요' 목록/건수는 사용자 확인 필요**. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.75` — **개인/공동/전체 한턱 Drill-down 의미 정리(표시만). ⚠️ 새 한턱 계산 없음 — v3.70~71의 paidBy/treat/treatBy/개인·공동·전체 한턱/Relation Group 정의를 더 명확히 보여줄 뿐.**
  Person Detail '한턱' 3 row(개인/공동/전체)·계산은 v3.71 그대로: **개인 한턱**=`treat && !_isCoTreat && _treatSubjects 포함`(공동 treatBy.members는 개인에 미포함), **공동 한턱**=`treat && treatBy.type==='relationGroup' && members 포함`(receipt.total 전액·members 수 N분할 없음), **전체 한턱**=개인 ∪ 공동(`receipt.id` 유니크·중복 합산 없음). ① **전체 한턱 drill**에 각 receipt의 **개인/공동 종류 chip**(`_isCoTreat` 기준, 작고 조용한 secondary — 개인=neutral·공동=soft Signature Blue, 금액보다 약하게·큰 badge/새 색 없음 §12) + **헤더 breakdown '개인 X원·N건 · 공동 Y원·N건'**(동적 §13). **불변식 개인+공동=전체**(금액·건수, receipt.id 유니크 §14). ② 개인/공동 drill은 제목이 종류라 chip 없음(§10). ③ 공동 주체 표시는 **`receipt.treatBy.members` snapshot**(현재 relationGroup.members 아님 → 그룹에 자녀 추가·`active:false`여도 과거 '김영석 · 이종현 → 조상현' 유지 §17·§18). row 클릭 → 기존 `selectReceipt`(§15). 공통 shell `_openPersonDetailShell`에 optional `row.tagHtml`·`cfg.metaExtraHtml`만 추가(다른 drill·grp/pay/treat/share/gsolo/gco 전부 불변). ④ **전체 결제(paidBy)와 한턱(treat/treatBy)은 별개 축**(§20·§21 — 갈포갈비: 전체 결제 김영석 208,000 포함 + 공동 한턱 김영석·이종현 208,000 포함, 둘 다 정상). '전체 한턱'≠'실제 카드 결제 전체'. ⚠️ paidBy/전체 결제/참석 부담액/단둘이 한턱/사람별 분담 개인·그룹(v3.74)/Relation Group Detail(v3.74)/받은 한턱 helper/기간 filter/overlay history(v3.72~74)/Meeting/Dutch Pay/Dropbox 전부 불변. Person별 double count(김영석·이종현 각 화면 공동 208,000 표시)는 v3.71 불변식대로 전역/그룹 통계에서 receipt.id 유니크(§19). 받은 한턱 Dashboard·동행률·자동 추천·migration 미도입(§23·§37). 검증(합성 fixture: 갈포갈비 공동 + 개인 한턱 혼합): 김영석 개인 0/0·공동 208,000/1·전체 208,000/1, 이종현 동일, 조상현 준 한턱 0(받은 대상), 혼합 시 개인 100,000/1+공동 208,000/1=전체 308,000/2·breakdown 합=전체 PASS, chip 개인/공동·row→Receipt·기간 filter·개인 보기/사람별 분담 회귀 0·overlay Back/swipe-back·Desktop/Mobile 390·430·콘솔에러 0. **함께 수정한 v3.74 버그 2건**: ① **공동 한턱 drill 제목 HTML entity 노출**(`김영석&amp;이종현 공동 한턱`) — 근본 원인은 **이중 escape**(caller가 `escapeHtml`한 title/subtitle을 `_openPersonDetailShell`이 다시 escape). shell이 title·subtitle을 **1회만 escape**하는 계약으로 통일하고 모든 caller(그룹 공동 한턱·구성원 근거·전체 결제·참석 부담액·전체/개인/공동 한턱)의 pre-escape 제거(subHtml/rightHtml/tagHtml/metaExtraHtml은 기존대로 caller가 escape·raw 주입). 공동 한턱 제목은 **공동 주체 표기(`members ' · ' join`)로 통일** → `김영석 · 이종현 공동 한턱`(저장된 `relationGroup.name` 강제 수정·migration 없음, 표시 계층만). XSS 안전(`<img onerror>`·`A&B` → text로만 표시, entity 미노출). ② **Relation Group Detail chevron이 금액 아래로 wrap**되던 것 — absolute positioning이 2줄 row 전체 세로중앙을 기준삼아 발생. `.gd-mrow`/`.gd-corow`를 `grid-template-columns:1fr auto auto`로, chevron을 amount와 같은 `grid-row:1`의 grid item으로 배치 → 금액과 같은 줄·오른쪽 끝·모든 row X축 통일(긴 금액 1,234,567,890원에도 wrap/overflow 없음). 검증 Desktop/390/430 PASS. ③ **문구 수정(계산 불변)**: Relation Group Detail 공동 한턱 row 보조문구 `총 부담에는 포함되지 않음` → **`위 총 부담에 이미 포함된 금액`**. 오해 방지 — 실제 의미는 '공동 한턱 208,000이 총 부담 328,000에 **이미 반영돼 있다**'(treat=true라 결제자 member 부담액에 이미 계산됨)이지 '별도로 안 더한다'가 아니다. 여전히 `328,000+208,000=536,000` 식으로 더하면 안 됨(double count 0). ⚠️ **실 Production IndexedDB(갈포갈비 실제 숫자)는 개발환경 미접근 — 합성 fixture만 검증, 실데이터 최종값은 사용자 확인 필요**. 변경 파일 `index.html`·`CLAUDE.md`.
- `v3.74` — **사람별 분담 「개인 / 그룹」 보기 전환 + 관계 그룹 부담 상세(v3.70~71 Relation Group을 분담 분석에 처음 활용). ⚠️ 개인 부담 계산은 진실원 그대로 — 결과를 관계 그룹 단위로 aggregate해 다른 관점으로 보여줄 뿐, 새 계산 없음.**
  '사람별 분담' 헤더에 compact toggle `[개인 | 그룹]`(기본 **개인**, `_splitViewMode` — 탭 세션 유지·영구 저장 안 함, active 그룹 0개면 toggle 숨김·개인 보기와 완전 동일 §33). **그룹 보기**: active Relation Group에 속한 사람들을 **한 unit**으로 합치고, 무소속은 개인 row 유지(§5 — '그룹만 보는 화면' 아님). 새 헬퍼 `_splitUnits(list)`: `_participantSplit`(개인 계산 진실원) 결과를 unit으로 재구성 — **각 사람은 정확히 하나의 unit**(그룹 소속이면 첫 active 그룹, 아니면 개인)이라 **double count 0**, 비율 분모=개인 보기 전체 부담액 그대로 → **SUM(개인)=SUM(그룹) 불변**(§15). 그룹 amount=구성원 개인 부담액 합계(§7), aggregate 후 순위 재계산(§14). `dup`=한 사람이 여러 active 그룹에 동시 소속(있으면 첫 그룹 귀속·조용한 중복 합산 아님·완료 보고 §10). **그룹 row**(data-rgid, 이름+작은 구성원 secondary·큰 badge/카드 없음·Clean Modern progress 재사용 §16·§19) 클릭 → **`_openRelationGroupSplitDetail`**(`_mtgSheetOpen` 재사용): 총 부담(=구성원 부담 합계) + 구성원별 row(→ `_openGroupMemberEvidence` 근거 receipt=`_receiptShare>0`·최신순·row→`selectReceipt` §23·§24) + **공동 한턱 row**(`_relGroupCoTreat(groupId)` 재사용·기간 scope·treatBy.members snapshot §25·§28 → `_openGroupCoTreatDrillScoped`). ⚠️ **공동 한턱은 총 부담에 더하지 않는다**(§26 — treat=true라 이미 결제자 member 부담액에 포함, 별도 관계 정보). 모든 drill은 `_openPersonDetailShell`/`_mtgSheetOpen`으로 v3.72~73 **overlay history 계약 준수**(open→history +1, UI/swipe-back Back→오버레이만 닫힘 §42). **참석만·부담 0원 칩**은 그룹 보기에서 그룹 member 흡수 시 중복 노출 안 함(개인 보기에서만 §18). 기간 filter 그대로 따름(§29), 그룹 편집/비활성화는 다음 render에 즉시 반영(별도 캐시 없음·진실원=relationGroups+개인 split §31·§32). ⚠️ `_receiptShare`/`_participantSplit`/`receiptPeople`/`normalizeName`/`treat`/`treatBy`/`splitExclude`/`_relGroupCoTreat`·개인 보기(순위·금액·%·Top5·더보기·참석만)·Person Detail·Meeting·Dutch Pay·Dropbox 전부 불변. 동행률·가족 만남 통계·자녀 포함률·자동 추천·Person ID/Dutch Pay migration·Meeting 계산 변경 **미도입**(§2·§44). 검증(합성 데이터: 갈포갈비 co-treat + 다그룹 dup 케이스): SUM(개인)=SUM(그룹) PASS·member row/amount 중복 0·공동 한턱 총부담 미합산·Group→member→evidence→Receipt·기간 filter·개인 보기 회귀 0·overlay Back/swipe-back·Desktop/Mobile 390·430·콘솔에러 0. ⚠️ 실제 김영석 가족 수치는 사용자 기기 relationGroups 기준(repo에 사용자 실 그룹 데이터 없음). 변경 파일 `index.html`만.
- `v3.73` — **기간 선택 시트(`#lpBackdrop`)를 v3.72 오버레이 history 공통 계층에 연결(남은 swipe-back 예외 1건). ⚠️ 새 history 시스템·기간 계산·UI 디자인 없음, 계산/데이터 전부 불변.**
  v3.72에서 5개 오버레이는 공통 계층(`_ovPush`/`_ovDismiss`/popstate)에 연결됐으나 **기간 선택 시트만 예외**로, 열린 채 edge swipe-back 시 시트만 닫히지 않고
  밑의 ledger route가 pop될 수 있었다(문서 reload는 아님). **수정**: `_lpOpenPop`에서 `_ovPush(_lpTeardown)`로 history 엔트리 +1, 실제 hide는 멱등 `_lpTeardown`으로
  분리. 모든 UI 닫기(X·backdrop·ESC·트리거 토글·빠른선택·적용)는 `_lpClosePop`→`_ovDismissById`로 자기 엔트리 1개만 소비(→popstate→`_lpTeardown`[+after]).
  빠른선택/적용은 `_lpClosePop(after)`로 필터 적용을 after 콜백에 실어 double teardown 없이 처리(적용 순서 유지). **backdrop 이중 발화**(backdrop 리스너 + 전역
  outside-click → `_lpClosePop` 2회)로 인한 double pop은 `_lpOvId`를 즉시 null로 비워 방지. 백그라운드 재렌더로 시트가 제거되면 renderDetail 정리부에서
  `_ovForget`로 stale `_lpOvId` 정리(재열기 차단·유령 stack 방지). 당겨서 새로고침 `BLOCK`에 `.lp-pop-backdrop` 추가(시트 열린 중 세로 당김 reload 차단, **edge
  swipe-back 자체는 미차단**). **부수 수정(v3.29부터 있던 모바일 버그, 검증 중 발견)**: 직접 기간 **[적용]**이 날짜 input을 `pslot`(=periodSlot)에서 조회했는데
  모바일은 시트가 `body`로 포탈돼 조회 결과가 null → 시작/종료일이 빈값으로 읽혀 **모바일에서 range 적용이 아예 안 됐다**(토스트 후 return). 트리거 핸들러와 동일하게
  `document.getElementById`로 바꿔 복구. 기간 계산·UI·데스크탑 동작 불변(데스크탑은 포탈 안 해 원래 정상이었음). ⚠️ 기간 필터 계산(`_ledgerTimeFilter`/`_ledgerRange`/
  `_statsPeriodReceipts`)·기간 UI 디자인·Foundation·SW·Receipt/Person/Meeting/Relation Group/treatBy/공동 한턱/Dutch Pay/Dropbox·v3.72 오버레이 계약 전부 불변.
  **검증**: 기간 시트 open push +1·UI close(빠른선택/적용/취소/backdrop/ESC) 자기 엔트리 −1·swipe-back single-pop(route/기간 유지·reload 없음)·10회 open/close listener
  누적 0·ghost 0·double pop 0·**모바일 range 적용 복구(패널 14,000 반영·36,000 아님)**, 기간 range 계산(4건·14,000)/전체(8건·36,000) 불변, v3.72 오버레이(공동 한턱/
  Meeting/관계 그룹) 회귀 없음, 갈포갈비 불변, Desktop/Mobile 390·430·콘솔에러 0. 변경 파일 `index.html`만. ⚠️ 실제 iPhone Safari는 사용자 Production 확인(에이전트 환경 WebKit 미설치).
- `v3.72` — **iPhone Safari edge swipe-back 시 앱이 새로고침/초기화되던 문제 수정(오버레이 history 통합). ⚠️ 기능·계산·데이터·기존 라우트 back 전부 불변.**
  ⚠️ **진단(UI Back vs Safari swipe-back 별개 계측)**: Drill-down(공동 한턱/전체 결제 등 `.mtg-sheet-backdrop`)·Meeting 관리(`.org-backdrop`)·
  Meeting 상세(`.mtg-sheet`)·관계 그룹 편집(`.rg-ov`)·공동 한턱 상세 오버레이가 열릴 때 **history 엔트리를 쌓지 않았다**. 그래서 swipe-back(=history
  back)이 (a) 밑의 **라우트를 pop → `switchTab+renderSide+renderDetail` 전체 rerender**(리셋처럼 보임, personSection이 사라짐) 또는 (b) 스택이
  얕으면 **초기 엔트리를 넘어 문서를 이탈 → 실제 document reload**(계측: sessionStorage boot 카운터 증가·`switchTab` undefined로 확인)를 유발.
  **BFCache 복원도, 자발적 전체 rerender도 아니었음** — 순수하게 '오버레이가 history에 없어서 back이 밑을 건드린' 문제. **수정**: 오버레이 open 시
  `_ovPush`로 history 엔트리 1개 push → 첫 back(swipe/UI)은 popstate에서 **스택 top만 teardown 후 return**(라우트 복원 skip) = **오버레이만 닫힘**.
  UI 닫기(X·backdrop·ESC·취소·저장·행선택)는 `_ovDismiss`가 **`history.back()`으로 같은 엔트리를 소비**(이중 정리·라우트 pop 없음). 행선택은
  `close(()=>selectReceipt(id))` after 콜백으로 닫고 이동. 중첩(관계그룹 모달→공동한턱 drill)은 모달을 `close(after)`로 먼저 소비 후 drill open.
  당겨서 새로고침 `BLOCK`에 새 오버레이 3종 추가(오버레이 열린 중 비-가장자리 세로 당김 reload도 차단). ⚠️ 기존 receiptNavigation(라우트 back·
  scroll 복원)·`_receiptShare`/`_participantSplit`/treatBy/Person·Meeting·관계 그룹 계산/저장/Dropbox/Dutch Pay 전부 불변(회귀 없음).
  **검증**: 5개 오버레이 × {swipe-back(goBack), UI-close} — 모두 '오버레이만 닫힘·라우트 유지(personSection 보존)·문서 reload 없음(boot 불변)·JS
  살아있음', 행선택 시 영수증 상세 이동, 중첩 back, 기준선(오버레이 없이 back=기존 SPA 라우트 pop 유지). Desktop 1280 + Mobile 390·430, 콘솔에러 0
  (39 check/뷰포트 PASS). ⚠️ **WebKit 바이너리는 이 컨테이너에서 설치 불가**(Playwright 브라우저 CDN이 프록시 allowlist에 없음) → Chromium 모바일
  에뮬레이션 + 코드 분석으로 검증(history/pushState/popstate 시맨틱은 엔진 불변, 수정도 엔진 비의존). 변경 파일 `index.html`만.
- `v3.71` — **관계 그룹 + 공동 한턱 — STEP 2/2: treatBy를 Person 분석·관계 그룹에 연결(표시/집계만). ⚠️ 기존 계산 전부 불변, migration 없음.**
  v3.70의 `treatBy`를 기존 Person Detail·관계 그룹에 안전 연결. **불변식**: `paidBy`(실결제)≠`treat`(한턱 여부)≠`treatBy`(한턱 주체). 공동 한턱=`treat && _isCoTreat`
  (treatBy.type=relationGroup·members 2명↑) → **receipt.total 전액이 한턱 금액, members 수로 N분할 안 함**(§1·§3, 208,000을 104/104로 쪼개지 않음).
  **새 헬퍼**: `_isCoTreat(r)`·`_personTreatGiving(name,pool)`(그 사람이 '준' 한턱을 solo=개인(treatBy 없음 & 결제자)·co=공동(treatBy.members 포함)·all=solo∪co로 분류,
  **receipt.id 유니크 → double count 0** §5)·`_personTreatReceived(name,pool)`(받은 한턱 helper §9)·`_relGroupCoTreat(groupId)`(그룹 id 기준 전역 receipt, 중복 합산 없음 §11).
  **UI**: ① **Person Detail '{이름} 한턱' 섹션**(개인/공동/전체 3 row — 검색된 그 사람이 '준' 한턱, 기간 pool 기준). ⚠️ 이는 기존 me기준 **'전체 내가 한턱'**(myTreat=내가 결제+상대 참석한
  한턱, 관계 hero의 insight row)과 **의미가 다른 별개 지표**로 둘 다 유지(§7 — 기존 숫자 조용히 안 바꿈). 각 row는 건수>0면 drill-down(`_openPersonDetail` gsolo/gco/gall,
  공동은 '주체 → 받은 사람' 표시 §8, 기존 `_openPersonDetailShell` 재사용). ② **관계 그룹 편집 모달**에 '공동 한턱 N원·N건 ›' 요약 + drill-down(`_openGroupCoTreatDrill`, 그룹 id 기준).
  **과거 snapshot 보존**(§12·§13): 공동 한턱 표시는 receipt의 `treatBy.members`(당시 주체)를 그대로 쓰고 현재 그룹 members로 재계산 안 함 — 그룹 members 변경·active:false여도 과거 기록 불변.
  **Person stable ID 없음 한계**(§14): 이름 문자열 식별 유지, 대규모 Person migration 안 함(별도 STEP). **Dutch Pay**(§15·§16): 커플 계산·payload 손대지 않음(relationGroup 전면 migration 안 함, 향후 settlement group 변환 가능 구조만 확인).
  **미도입**: 관계 그룹별 사람별 분담 Ranking·가족 총지출 Dashboard·자동 추론·Person ID migration·Meeting 변경(§21). **검증(갈포갈비 + 합성)**: paidBy 김영석·실결제 208,000·개인 한턱 김영석 0/0·
  공동 한턱 김영석 208,000/1·이종현 208,000/1·김영석 가족 208,000/1·recipient 조상현·조상현 부담 0·전역 공동 한턱 208,000/1·**double count 0**·기존 treatBy 없는 한턱/`_receiptShare`/`_participantSplit` 회귀 없음·
  Desktop/Mobile 390·430·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.70` — **관계 그룹(Relation Group) + 공동 한턱(treatBy) — STEP 1/2. ⚠️ paidBy·treat·_receiptShare·_participantSplit 계산 전부 불변.**
  ⚠️ **조사 결과**: Dutch Pay '커플'은 `_coupleNames`(정확히 2명·이름 문자열·localStorage `dutchpay_couple`+그룹별 `data.couples`+Dropbox `coupleNames`)로,
  **별도 앱·별도 저장소**라 Receipt DB와 데이터 공유 불가·stable ID 없음. → 개념(커플/공동 한턱)만 차용하고 **2명 이상 지원 Relation Group**으로 일반화.
  Receipt DB Person도 **이름 문자열 식별(stable Person ID 없음)** — 이번 기능 때문에 대규모 Person migration은 하지 않고 members도 이름 문자열로 둔다(한계 명시).
  **저장**: settings store `relationGroups`(storeCatMap과 동일 계약) + sync JSON `relationGroups`(_dbxMerge에서 id·updatedAt 최신 우선 머지, 백업 export/import 포함).
  schema `{id(불변 identity), name(사용자 수정 가능·계산 identity 아님), type(couple/family/other), members:[이름], active, createdAt, updatedAt}`. **해제=active:false**(hard delete 아님 → 과거 treatBy 보존).
  Person은 **절대 병합 안 함**(개인 검색/결제/Detail/Meeting/부담액 전부 그대로) — 그룹은 순수 관계 계층. **Receipt**: optional `treatBy={type:'relationGroup',groupId,members}`(당시 실제 공동주체 **snapshot** — 나중에 그룹에 멤버 추가해도 과거 기록 불변 §16). `_validateReceiptRecord`에 `_validTreatBy` 정규화 추가(손상 값 차단, 없으면 undefined→JSON 제외, 기존 Receipt에 기본값 안 씀·migration 없음). treat OFF 저장 시 treatBy 제거(§19). **paidBy 불변**(§26 — 공동 선택해도 결제자는 그대로), **receipt.total N분할 없음**(§15·§27 — 208,000을 104/104로 쪼개지 않음, 받은 사람 0원 기존 treat 의미 유지). 기존 `treat`(treatBy 없음)=개인 한턱으로 runtime 해석.
  **runtime 헬퍼**: `_treatSubjects`(treatBy members 2명↑=공동, 아니면 paidBy 개인)·`_treatRecipients`(receiptPeople−주체, 별도 recipient 필드 없음)·`_treatSummarySentence`(동적 문장).
  **UI**: ① 설정>**사람 및 관계**(관계 그룹 목록·+추가, 그룹명/유형/구성원 체크리스트 모달) ② **Person Detail '관계' 섹션**(속한 그룹 표시·같은 그룹 편집·없으면 '관계 그룹 설정' — Settings와 동일 relationGroups 편집) ③ **Receipt Detail 한턱 주체**(`_makeSplitUI` 확장: 한턱 ON 시 `[결제자 개인](기본)`/`[결제자·동행 공동]` 후보 — **현재 참석한 그룹 멤버만·paidBy 포함**, 불참 멤버 자동 포함 안 함 §21, 부분집합 폭발 없음 §22) + 요약 문장(§25). 관계 그룹이 없으면 주체 선택 UI는 숨기고 요약만.
  **미도입(STEP 2/2)**: 사람별 분담 관계 Ranking·관계 그룹별 통계·가족 총지출·자동 관계 추론·Meeting 계산 변경·Dutch Pay UI 개편. **갈포갈비 검증**: paidBy=김영석·treat=true·treatBy=김영석·이종현 → 실결제 김영석 208,000원(불변), 공동 한턱 김영석·이종현→조상현, `_receiptShare`(김영석 208,000·나머지 0)·`_participantSplit` 불변, treatBy 백업 roundtrip 보존, 3명 모두 독립 Person 유지. 변경 파일 `index.html`만.
- `v3.69` — **'사람별 분담' 영역 Clean Modern UI 정제(표시만, 계산·명단·금액·한턱·제외·참석만 판정 전부 불변).**
  기존 `.cat-bar-row.pp-row`(카테고리 막대 공유·rank별 파랑 음영) 구조를 전용 Flat List로 교체. 공통 헬퍼
  **`_personSplitSectionHtml(list)`**(renderLedgerPanel·renderMonthSummaryHtml 공통): 헤더=제목 '사람별 분담' + 보조설명
  '함께한 사람들의 부담 금액' + 우측 요약 `N명 · 한턱 N · 제외 N`(⌄, 기존 섹션 collapse 재사용). 본문=`rank | 이름 | progress |
  금액 | 비율` 5열 grid. **rank** 22px 원(top1만 Signature Blue·나머지 neutral, 메달 emoji 없음), **이름** 고정폭(96px)이라
  progress 시작점 정렬, **progress** track=`--fill`·fill=Signature Blue 단색(gradient 없음)·7px·모든 bar 시작/끝 X 정렬,
  **금액** 우측정렬 `tabular-nums`, **비율**=amt/전체부담액 **동적 계산**(top1만 Blue). **기본 상위 5명** + `더보기 N명`/`접기`
  (위임 토글, `.psplit-list.expanded`). top1은 큰 카드/그림자 없이 연한 `--blue-bg` surface만. 참석만·분담 0원 chips는 divider로
  분리·더 작고 조용하게(`.psplit .pp-ao-chip`). row 전체 클릭 → 기존 `[data-ppname]` 위임(인물 검색) 유지. **Mobile(≤780px)**
  은 `rank | 이름 | 금액·비율 / progress` 2단 grid(390·430 overflow 없음). ⚠️ `_participantSplit`/`_receiptShare`/`_attendedOnly`/
  `treat`/`splitExclude`/`normalizeName`/`receiptPeople`/기간 filter·다른 Dashboard·Meeting·Person Detail·Dutch Pay·Dropbox 전부
  불변. 검증(실데이터): Top5 순위/금액 = 기존 동일, 비율=amt/총부담액, 참석만 명단 동일, 더보기/접기, Desktop 컬럼 정렬,
  Mobile 390·430 겹침·overflow 없음, 콘솔에러 0. 변경 파일 `index.html`만.
- `v3.68` — **만남 목록 UI 2건 정제(표시만, 구조·계산·필터로직·클릭·Meeting Management·데이터 전부 불변).**
  ① **grouped secondary metadata 순서 변경**: `대표매장 외 N곳 · N건 묶음` → **`N건 묶음 · 대표매장 외 N곳`**. sub는 한 줄
  `nowrap`+ellipsis라 **앞의 'N건 묶음'은 긴 매장명에도 항상 노출**되고 뒤의 매장 요약만 잘린다(핵심 상태 정보 우선). Blue Bar
  높이/폭/색(v3.66)·참석자 줄 미침 그대로. ② **상단 위계 정리**: 1번째 줄 `[만남 N][묶이지 않음 N]`=Management primary tab(기존
  크기 유지), 2번째 줄 `[전체 N][묶인 만남 N]`=현재 목록 안 secondary filter를 **한 단계 작게**(`.mm-subfilter .mm-tab` font 12.5→11.5·
  weight 600→500·padding 6/14→4/11, container gap 8→6). **새 색 없음**(선택 시 기존 `--blue-bg`/`--blue-txt` 그대로), 과한 segmented
  control 아님, Desktop/Mobile 동일 hierarchy. ⚠️ Meeting 계산·Blue Bar 의미·Meeting count·grouped/independent 판정·Management
  (추가/분리/이동)·Flat List·straight divider·클릭·데이터·Dropbox/Dutch Pay 전부 불변. 검증(김영석+합성): 'N건 묶음' 항상 노출·긴
  매장명만 ellipsis·secondary filter가 primary보다 작음·bar/필터/클릭 동작 불변·Desktop/Mobile 390·430·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.67` — **만남 목록 표시 문구 최종 정제(표시만, 계산·필터·클릭·Meeting Management·데이터 전부 불변).**
  ① **묶인 만남**(실제 2건 이상) 3단 구조로 통일: 제목=`M월 D일의 만남`, 2번째 줄=**`대표매장 외 N곳 · N건 묶음`**(기존 '영수증 N건'→
  **'N건 묶음'**, `nowrap`+ellipsis 1줄 유지), 3번째 줄=참석자 union. Blue Bar(v3.66)는 title+2번째 줄 높이에 맞고 참석자 줄로
  안 내려감. ② **독립 만남**: bar 없음·제목=`YYYY.MM.DD · 매장`, 보조='영수증 1건' 반복 제거(참석자만). ③ **meetingId가 있어도
  실제 동일 meetingId receipt가 1건뿐인 만남**은 **독립 만남과 완전히 동일하게 렌더** — bar 없음, `'meetingId'`·`'1건 묶음'` 미노출,
  개발/테스트성 문구 `'1건meetingId · 영수증 1건'` 제거(렌더 분기 조건을 `m.type==='g'` → `m.type==='g'&&rc.length>=2`로 좁힘;
  1건 grouped unit은 독립 렌더 경로로). ④ 상단 `[전체 N][묶인 만남 N]` 필터·클릭(`m.type` 기준, 1건 meetingId 클릭 시 기존대로
  Meeting Detail)·straight divider·radius 0 불변. ⚠️ Meeting count/grouped/independent 정의·meetingId·`_mtgReceiptsById`·금액·
  Dutch Pay·Dropbox 전부 불변. 검증(김영석+합성): 묶음 'N건 묶음'·2번째 줄 1줄 ellipsis·bar 두 줄 높이·독립 및 1건 meetingId
  동일 간결 표시('meetingId'/'N건' 미노출)·Desktop/Mobile 390·430·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.66` — **묶인 만남 Blue Bar 높이를 title+grouped metadata 두 줄 블록에 맞춤(표시만, 계산·필터·클릭·데이터 전부 불변).**
  v3.65의 bar가 고정 `height:32px`라 두 줄(제목+보조정보)보다 짧아 '작은 상태표시'처럼 보이던 것 수정. **고정 height 폐기** →
  목록 row의 제목(`.mm-row-top`)+grouped 보조정보(`.mm-row-sub`)를 새 wrapper **`.mm-row-head`**(position:relative)로 묶고,
  bar를 `.mm-row[data-linked] .mm-row-head::before{top:0;bottom:0}`로 걸어 **wrapper 실제 높이를 그대로 따라간다**(두 줄이면 두 줄,
  보조정보가 줄바꿈되면 그만큼 늘어남). 참석자 줄(`.mm-row-ppl`)은 head **바깥**이라 bar가 그 줄로 내려가지 않고, `left:-10px`
  (row padding-left 12px 보정)로 좌측 2px에 놓여 row/아래 divider와 분리된다. Desktop/Mobile 공통 규칙(고정 px 대신 line-height
  기반이라 뷰포트별 typography에 자동으로 맞음). ⚠️ width 3px·`border-radius:0`(양끝 직선)·Signature Blue·독립 만남/1건 meetingId
  bar 없음·[전체][묶인 만남] 필터·Meeting 계산/클릭/편집/데이터 전부 불변. 검증(김영석 실데이터+합성): 2건/3건 묶음 bar 있음·bar가
  head 두 줄 높이에 정렬(참석자 줄 미침)·긴 매장명 ellipsis·divider 미접촉·독립 bar 없음·Desktop/Mobile 390·430·콘솔에러 0.
  변경 파일 `index.html`만.
- `v3.65` — **만남 목록에서 묶인 만남 vs 독립 만남 시각 구별(표시/필터만, 계산·기능 불변).** ① **묶인 만남**(같은 meetingId에
  실제 receipt **2건 이상**, 전역 `_mtgReceiptsById(mid).length>=2` §3·§8)에만 왼쪽 짧은 **Signature Blue 세로바**(width 3·height 32,
  `.mm-row[data-linked]::before`, row 안·divider와 분리 §1). **독립 receipt(meetingId 없음)·meetingId 1건뿐인 만남은 바 없음**(§2·§3).
  ② 묶인 만남만 보조정보 **'대표매장 외 N곳 · 영수증 N건'**(§4), 독립 만남은 반복 '영수증 1건' 노이즈 **생략**(제목=날짜·매장, 참석자만).
  ③ 만남 탭 상단 compact 필터 **[전체 N][묶인 만남 N]**(기본 전체). 전체=grouped+independent=Person Dashboard '만남 N회'와 동일값(§5).
  ④ 기간 scope로 일부만 보여도 전역 meetingId 2건+면 묶인 만남 유지(§8). ⚠️ 카드/파란 배경/rounded/shadow/큰 badge 없음,
  straight divider·radius 0 유지(§6). 클릭·Meeting 계산·Organizer·생성/추가/분리/이동·사람 비종속·Person Detail·금액·Dutch Pay·
  Dropbox 전부 불변(§9). 검증(김영석 실데이터): 전체=묶인+독립 불변식 PASS·바 규칙(2·3건 있음/독립·1건 없음)·필터·Desktop/Mobile
  390·430·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.64` — **Meeting Management 완결: CREATE/READ/UPDATE/UNLINK/RECOVERY. ⚠️ 진실원=receipt.meetingId, 금액 계산 전부 불변.**
  기존 '묶기'만 강했던 것을 "잘못 묶어도 부담 없이 수정"까지 완결. **공통 mutation layer**(§103): `_mtgApply`(dbPutMany atomic +
  updatedAt + 실패 시 in-memory 롤백 + `_mtgBusy` 경쟁방지, meetingId 외 field 불변 §105) 위에 `_mtgCreateMeeting`(새 만남)·
  `_mtgAddToMeeting`(기존 추가)·`_mtgDetach`(선택 분리)·`_mtgUnlinkAll`(전체 풀기)·`_mtgMove`(다른 만남 이동)를 통일. 통합 surface
  **`_mtgManageOpen(tab)`**(org-backdrop full-screen, 내부 뷰 list/detail/edit/addReceipts/pick + 예측 가능한 back §80): Dashboard
  '만남 N회'→meetings 탭 / '묶이지 않은 영수증'→unlinked 탭(둘 다 `_mtgManageOpen` wrapper, 기존 `_mtgOrganizerOpen`/
  `_mtgConfirmedListOpen`는 wrapper로 보존). meetings 탭=grouped+independent flat 목록(grouped→detail·independent→receipt 상세),
  unlinked 탭=기존 Organizer(날짜 grouping·모두 선택·여러 건 날짜만·참석자 동일/일부 변경) + Action Bar 2버튼 [기존 만남에 추가]
  (1건+ §12·§42)·[새 만남으로 묶기](2건+ §14). detail=조회(union·합계·목록·더치페이)+[편집]. edit=[선택 분리]/[다른 만남으로 이동]+
  [영수증 추가]/[만남 전체 풀기(danger)]. addReceipts=전역 묶이지 않은 receipt 선택 추가. pick=다른 만남 선택(현재 만남 제외 §73).
  모두 확인창·atomic·변경 후 renderSide+renderDetail로 `_personMtgData` fresh 재계산 → 사람 비종속 즉시 반영(§53·§87). RECOVERY:
  잘못 분리→묶이지 않음 재추가 / 잘못 묶음→일부 분리·전체 풀기·다른 만남 이동(§108). ⚠️ Meeting count(=grouped+independent=
  단둘이+여럿이)·receiptPeople union·단둘이 한턱·일반 분담·여럿이·전체 결제·전체 내가 한턱·참석 부담액·`_receiptShare`·treat·
  splitExclude·Dutch Pay payload·Dropbox·Person Detail·기간 필터 전부 불변. 새 schema/migration/자동 병합/round/payee/treatBy 없음(§109).
  Flat List·straight divider·radius 0 유지. 검증(실데이터 151+합성 6명): CREATE(2 independent→만남 −1)·ADD(−1)·DETACH(+1)·RECOVERY
  재추가·MOVE·UNLINK ALL·데이터 안전(총액·receipt 수 불변, 삭제·손실·중복 0)·불변식·사람 비종속(6명 union·각 화면 반영)·atomic·
  Desktop/Mobile 390·430·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.63` — **Meeting Organizer receipt row 직선 divider 실제 렌더 완성. ⚠️ CSS 1줄 제거만, 계산·기능 전부 불변.**
  v3.62에서 radius는 제거했으나 **divider가 실제로 안 보였다**(사용자 캡처가 1건 날짜 group). ⚠️ 근본 원인 = v3.59의
  `.org-row:last-child{border-bottom:none}` — 날짜 group이 1건이면 단일 row가 `:last-child`라 divider가 사라졌고, 여러 건
  group도 마지막 row는 divider가 없었다(일반 카드/리스트 관행). 이 앱 Flat List 원칙(§10 — 1건·group 마지막 행도 반드시
  직선으로 닫음)과 충돌하므로 **그 규칙 삭제**. 이제 selected/미선택·hover 모두 각 row 하단 1px 직선 divider(`--divider`) 렌더.
  Date Header(`border-bottom`)·Action Bar(`border-top`)는 기존대로 straight. ⚠️ Meeting 계산/independent 정의/meetingId/
  Organizer selection/날짜 grouping/여러 건 날짜만/참석자 비교/만남 생성/사람 비종속/Person Detail/Dutch Pay/Dropbox 전부 불변.
  검증(computed style + screenshot): 1건 날짜·2건·3건 전체선택 모두 각 row 하단 직선 divider 존재(blue block으로 안 뭉침),
  Action Bar 상단 divider 표시, Desktop/Mobile 390·430 동일·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.62` — **① 구분선 직선 규칙 완성 + ② 공통 Person Detail(요약→근거→영수증) Drill-down. ⚠️ 계산·데이터 전부 불변, UI/네비만.**
  **① Divider 직선화**: ⚠️ 근본 원인 = 클릭 가능 Flat Row(`.rel-li-tap`·`.org-row`)에 `border-radius`가 있어 그 행의 하단
  `border-bottom`(divider) 양끝이 곡선으로 보였다(전수 조사로 확인). radius 제거(`.rel-li-tap` radius 삭제·`.org-row` radius 0)
  → 만남/묶이지 않은 영수증·Organizer receipt row 모두 완전 직선 divider. hover는 radius 없는 full-width 사각 tint만. Foundation
  불변식을 CLAUDE.md 디자인 원칙에 명문화("Dividers are always straight…"). radius 유지 요소(Card·Modal·Sheet·Input·Select·Button·
  chip·badge·selection circle)는 그대로. **② 공통 Person Detail**: chevron=navigation 통일(클릭 가능 row에만 trailing chevron,
  절대 위치 우측중앙 — 크기/위치/색 통일 §57·§58; `.rel-li-go`→`.rel-li-chev`). 4개 요약 row(**여럿이 함께할 때·전체 결제·
  전체 내가 한턱·참석 부담액**)를 Drill-down에 연결. 공통 shell `_openPersonDetailShell`(`_mtgSheetOpen` 재사용, flat row `.pd-row`·
  straight divider·radius 0) + `_openPersonDetail(type)`. **진실원 = `_personDetailData`**(Dashboard 요약을 만든 그 컬렉션 그대로:
  grpAll=together 3명+ / tgtWith·myWith / myTreat·myTreatDuo·myTreatGrp / partRecs) → **Summary=Evidence 보장**, 새 계산·유사 filter
  복제 없음(§35·§71). 전체 결제 filter [전체/신유철/나], 전체 내가 한턱 filter [전체/단둘이/여럿이], 참석 부담액 row 우측=`_receiptShare`
  (강조·합계=참석 부담액 total §25). row 클릭 → 기존 `selectReceipt`(§27). 금액은 receipt.total 또는 `_receiptShare`만(새 귀속 계산
  없음 §10·§24). 0건 row는 chevron 숨김·비클릭(§59). 기존 단둘이 Hero drill(상대/내 한턱·일반 분담)·만남 목록·Organizer는 그대로
  (§67~§69 — 무리한 통합 안 함, 단둘이 drill은 `.mtg-drow` gap 스타일 유지·향후 통일 가능). ⚠️ receiptPeople/normalizeName/
  `_receiptShare`/`_participantSplit`/`_personRelation`/treat/splitExclude/단둘이 한턱/일반 분담/여럿이/전체 결제/전체 내가 한턱/참석
  부담액/meetingId/Meeting count(v3.61)/Organizer/Meeting Detail/사람 비종속/Dutch Pay/Dropbox/기간 필터 전부 불변. 검증(실데이터
  신유철 + 1건/0값 사람 + 합성): 여럿이/전체 결제/전체 내가 한턱/참석 부담액 각 Detail 건수·합계 = Dashboard(불변식 PASS: 전체
  한턱=단둘이+여럿이, 참석 부담액 SUM(_receiptShare)=595,884), chevron 8종 전부 동작, divider 직선(radius 0), Desktop 1280 +
  Mobile 390·430 overflow 없음·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.61` — **Meeting 정의 개념 수정: receipt 1건(meetingId 없음)도 '독립 Meeting 1회'. ⚠️ 금액 계산 전부 불변, 만남 count 의미·용어만.**
  기존엔 사실상 'meetingId 있음=만남, 없음=미분류'로 셈했으나, 영수증 1건 자체가 이미 실제 만남 1회다. `meetingId`는 **'Meeting 존재
  여부'가 아니라 '여러 receipt를 같은 Meeting으로 연결하는 ID'**로 재정의. **Meeting count = unique meetingId 수(grouped) + meetingId
  없는 receipt 수(independent)**. 불변식: count = grouped + independent = 단둘이 + 여럿이(§45). ① `_personMeetingStats` 재작성:
  grouped(같은 meetingId 전역 `_mtgReceiptsById` union) + independent(together 중 meetingId 없는 receipt 각각, `receiptPeople`이 곧
  Meeting people §59) 합산, 각 단둘이(union/receiptPeople 정확히 {나,대상})/여럿이 판정. ⚠️ **§56 순서 유지**: 전체 receipt → Meeting
  unit → 나+대상 관계 필터(사람 receipt 먼저 필터하면 grouped union이 잘려 단둘이 오분류 §57). ② **용어 정비**(§6·§7·§8·§20·§48):
  '확정된 만남'→**'만남'**, '미분류 영수증'/'미분류만'→**'묶이지 않은 영수증'/'묶이지 않음'**, **'M/T건 정리됨' 진행률 제거**(독립
  Meeting은 미완성·오류 아님 §50). ③ Dashboard 만남 영역: `만남 N회 ›`(→ 만남 목록: grouped+independent 둘 다, grouped→Meeting
  Detail·independent→receipt 상세 §32·§33·§55) + `묶이지 않은 영수증 N건 ›`(→ Organizer). 헤더 소제목 `함께한 영수증 N건 · 만남
  M회`(receipt≠meeting 혼합 금지 §46). ④ 묶이지 않은 영수증은 이미 만남 count에 포함된 **보조 상태 정보**(중복 합산 아님 §18·§47).
  ⚠️ receipt schema·meetingId·migration 없음(§64), 기존 데이터 자동 병합 없음(§63), 단둘이 한턱/일반 분담/여럿이/전체 결제/전체
  내가 한턱/참석 부담액/`treat`/`splitExclude`/`receiptPeople`/`normalizeName`/Dutch Pay/Dropbox/Meeting Detail(분리·union·범위)·
  **사람 비종속 Meeting(v3.59)** 전부 불변. Organizer flat list·날짜 grouping·모두 선택·여러 건 날짜만·참석자 동일/일부 변경(v3.60) 유지.
  ⚠️ **김아름 사례**: 사용자 실기기 화면은 '확정된 만남 2회 / 미분류 1건'(= grouped meetingId 2개 + 독립 1건)이었는데, 새 정의로는
  **만남 = 2 + 1 = 3회**(묶이지 않은 영수증 1건은 그 3회에 포함). 참고로 repo 검증 sync.json에는 meetingId가 하나도 없어 그 데이터
  기준 김아름은 grouped 0 + independent 9 = **만남 9회**(단둘이 0·여럿이 9)로 표시됨(둘 다 정의상 정상). 검증(실데이터 신유철 41=0+41=
  20+21·이영환 21=0+21=7+14·김아름 9=0+9=0+9 불변식 PASS + 합성 A~E[1건 독립→만남1, 독립 3건→만남3, 묶은 후→1, union 합류→여럿이,
  묶음+독립→2] + 사람 비종속 6명 각 만남1 + 만남 목록 rows=count + 금액 320,900/265,000/399,600/595,884 불변 + Desktop/Mobile 390
  용어·overflow 없음·콘솔에러 0). 변경 파일 `index.html`만.
- `v3.60` — **Meeting Organizer 보조 기능 2종(추천 보조 — 자동 묶기 절대 없음) + 날짜 헤더 문구 정제. ⚠️ 계산·meetingId·생성 로직 불변.**
  ① **'여러 건 날짜만' 필터**(`multiOnly` 토글 칩): 현재 표시 중인 receipt를 날짜 grouping한 뒤 **count≥2인 날짜 group만** 표시.
  미분류만/전체와 **조합**(각각 독립 작동). 묶어볼 후보 날짜를 빠르게 찾는 용도 — meeting 판정 아님. 해당 날짜 없으면
  '묶어볼 만한 여러 건 날짜가 없어요' empty state. ② **참석자 구성 힌트**: 같은 날짜 group(2건 이상)의 `receiptPeople`(정확일치
  normalized Set)이 전부 같으면 **'참석자 동일'**, 하나라도 다르면 **'참석자 일부 변경'**(`_orgSamePeople`). 날짜 헤더 아래
  **중립 caption**(`.org-dmeta` — Text Secondary/Tertiary, success/warning색 금지, 날짜보다 약하게). ⚠️ **판정이 아니라 힌트**:
  '동일'=같은 만남 확정 아님, '변경'=다른 만남 확정 아님(1차 2명→2차 3명도 같은 만남일 수 있음). **1건 날짜는 표시 없음**,
  **날짜 내부에서만 비교**(cross-date 비교 없음, 누가 합류/이탈인지 분석 안 함). ③ **날짜 헤더 문구**: 2건 이상 group만
  **'N건 모두 선택 / N건 선택 해제'**(전체 선택 상태 반영), **1건 group은 버튼 없이 row tap만**. 헤더를 2줄(`.org-dhd-top` +
  `.org-dmeta`)로. ④ cross-date 선택·자정 넘김·selection 유지(필터 토글 시 선택 receipt.id 안 지움, Action Bar 'N건·합계' 정확)·
  Action Bar·backdrop 분리·기간 필터 scope 전부 그대로. ⚠️ **Meeting은 사람 비종속**(meetingId 전역) — union 전원 화면에 즉시
  반영, 다른 사람 미분류에서 즉시 제외(v3.59 불변식 유지). 자동 meeting/시간판단/round/1차2차/payee/treatBy/AI 추천 **미도입**.
  검증(실데이터 151 + 합성): 칩 3개(multi 기본 off)·여러 건 날짜만 ON 시 모든 group≥2·미분류/전체 조합·참석자 동일(2026-09-07/
  09-19)/일부 변경(6·4·2명 2026-09-06)·1건 metadata 없음·'3건 모두 선택↔3건 선택 해제'·일부 해제 복귀·1건 버튼 없음·cross-date
  2건 선택·selection 유지·**사람 비종속 회귀(신유철에서 6/4/2명 3건 생성 → 김영석·정대원·양승모·김아름 각 확정 만남 +1, 본인
  포함 receipt만 집계)**·Desktop 1280 + Mobile 390·430 필터/가로 overflow 없음·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.59` — **meetingId 생성 UX를 [선택] 혼재 방식 → '만남 정리 전용 작업 공간(Meeting Organizer)'으로 분리 — 계산·meetingId 계약 불변.**
  문제: Person Dashboard에서 [선택]을 누르면 결제/참석 목록에 체크박스가 섞이고, 하단 액션 UI와 기존 콘텐츠가 겹쳐 보였다. →
  **조회(Dashboard)와 만남 정리(Organizer)의 역할을 분리**한다. ① Dashboard의 **[선택] 버튼·체크박스·툴바·액션바 전부 제거**
  (결제/참석 목록은 조회 전용, '만남' 태그는 표시 유지). ② 만남 영역 2 row를 **클릭 진입점**으로: **'확정된 만남 N회 ›'**(→ 만남
  목록 시트 → row 클릭 시 기존 Meeting Detail 재사용) / **'미분류 영수증 N건 ›'**(→ Meeting Organizer). 미분류 row에 **진행률 sub**
  `M/T건 정리됨`(=meetingId 있는 함께한 receipt / 함께한 전체, 동적; 0이면 '모든 영수증 정리 완료'). 각 0건이면 비클릭. ③ **Organizer**=
  full-screen overlay(`.org-backdrop` z-index 300, backdrop로 Dashboard와 완전 분리 — 데스크탑 중앙 560px 패널·모바일 100% full-height):
  **[고정 헤더(← 이름 · 만남 정리 · subtitle)]** + **[고정 필터(미분류만/전체, 기본 미분류만)]** + **[스크롤 날짜그룹 리스트]** +
  **[고정 Action Bar(선택 N건 · 합계, ≥2건 활성)]**. 영수증은 **날짜별 grouping(최신순)** + 날짜 헤더 **'모두 선택'(토글)** + **row 전체
  tap**(연한 selected surface + 원형 check indicator, checkbox 작은 원만 누르는 UX 아님). **다른 날짜도 함께 선택** 가능(날짜는 탐색 UI일
  뿐 차단 없음), 자동 묶기 없음 — [만남으로 묶기]를 눌러야 저장. 참석자 표시, meetingId 있는 receipt는 '만남' badge(전체 필터). ④ **생성=
  `_mtgCreateMeeting` 재사용**(v3.48 경고 2종[날짜차 3일↑·공통 참석자 없음]·v3.46 '이미 다른 만남' 확인·`dbPutMany` 원자적 저장·롤백
  전부 불변). 성공 후 `renderSide`+`renderDetail`로 fresh 재계산 → Organizer 미분류 즉시 감소, Dashboard 확정 만남 +1·미분류 −N.
  ⚠️ **Meeting은 사람에 종속되지 않는다** — `meetingId`는 receipt 전역 필드라, 같은 meetingId union에 포함된 **모든 사람 화면(다른 사람
  포함)에서 즉시 미분류에서 빠진다**(사람별 캐시 없음, 어느 화면에서 만들었는지 무관, 재생성 불필요). Organizer는 '작업 대상 목록'만
  현재 사람의 together로 좁힐 뿐 생성 결과는 전역. ⑤ '자주 함께한 멤버'는 Organizer에서 제외(Dashboard엔 유지). ⚠️ meetingId 의미/
  생성 규칙·`dbPutMany`·receipt schema·`receiptPeople`/`normalizeName`/`_personRelation`/`_receiptShare`/`treat`/`splitExclude`/단둘이 한턱/
  일반 분담/전체 결제/참석 부담액/Dutch Pay payload/Dropbox merge·sync·Meeting Detail(분리·union·Dutch Pay 범위) 전부 불변. 자동
  meeting/시간판단/round/1차2차/meetingName/별도 Meeting DB/payee/treatBy 미도입. 검증(실데이터 151건 신유철 + 합성 크로스퍼슨):
  [선택]·체크박스 제거, Organizer 진입·날짜 grouping(15그룹/41행)·모두선택/일부해제·2건 생성(동일 meetingId 전역 globalCount=2)·미분류
  즉시 41→39·**김테스트에서 묶음 → 박테스트 화면 미분류 0·확정 만남 1**·확정 목록→Meeting Detail, Desktop 1280 + Mobile 390·430
  full-height·backdrop 분리·Action Bar 고정·가로 overflow 없음·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.58` — **Person Dashboard 시각 위계 정제: 'B안 핵심 Hero + A안 절제 정보구조' — 계산·데이터·drill·정보량 전부 불변, UI만.**
  ① **Hero(B 밸런스)**: 양쪽 한턱(상대/나)을 **중앙정렬 + 위에 작은 person 아이콘 칩**(`.rel-duo-ic` — 상대=soft blue·
  나=Signature Blue, §22 새 색 없음). 중앙 이모지·감성문구·사진·gradient·ratio Bar 없음(§6·§29 — 금액이 주인공, 장식이
  숫자보다 먼저 보이면 FAIL). 금액/라벨/건수·`_duoSideHtml`·drill 그대로. ② **Hero 아래(A 절제)**: 컬러 카드/2열 insight
  박스(`.rel-insights`/`.rel-ins`) + `.rel-srow`/`.rel-mtg` 제거 → **작은 좌측 아이콘 + 우측 값의 통일 리스트**
  (`.rel-metrics`/`.rel-li`, 소형 인라인 SVG `_relIco`: group/card/gift/cal/doc). 여럿이·전체 결제는 **신유철·나 두 값 그대로
  유지**(정보 손실 없음, `.rel-li.two`+기존 `.rsv` 재사용, 모바일 값 아래로 wrap), 참석 부담액도 plain row(§14 — 큰 컬러
  카드 금지). ③ **§13 라벨**: 아래 '내가 한턱'(단둘이+여럿이 전체) → **'전체 내가 한턱'**으로 명확화(Hero '내가 한턱'=
  단둘이만과 구분), sub에 '단둘이 N·여럿이 N' 분해(계산 불변). ④ 만남 지표는 **'만남 · meetingId 기준' caption + 확정된
  만남/미분류 2 row**로 리스트 grammar 통일(§17 — 큰 공간 안 씀). ⑤ 비클릭 row엔 chevron 안 붙임(§8 — Hero 3개만
  클릭, 오해 방지). ⚠️ **단둘이 판정·treat 의미·상대/내 한턱·일반 분담·`receiptPeople`/`normalizeName`/`_receiptShare`/
  `_participantSplit`/`splitExclude`/여럿이/전체/`meetingId`/만남 통계/Dutch Pay/Dropbox/schema/기간 필터/사람 renderer
  통일(§25) 전부 불변.** v3.57 drill-down(한턱 tgt/me·일반 분담 normal·미상 unknown) 그대로. 검증(실데이터 151건 신유철):
  단둘이 20 = 상대 320,900/6 + 내 265,000/5 + 일반 9 + 미상 0, 전체 내가 한턱 399,600/8·참석 595,884/32·여럿이 나
  1,948,500/17·전체 나 2,453,500/27 불변, drill 합계=Hero, 아이콘 칩·A 리스트·§13 라벨·만남 caption PASS,
  Desktop 1280 + Mobile 390·430 금액 잘림/가로 overflow 없음·2값 row 안 넘침·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.57` — **단둘이 Hero 주지표를 '실결제액'→'단둘이 한턱(treat)'으로 변경 — treat 의미·계산 전부 불변, Hero 표현/분류만.**
  사용자 의도: "단둘이 있을 때 누가 누구에게 순수하게 한턱을 냈는가". 일반 1/N 분담은 한턱 금액에서 **완전히 제외**한다.
  ① **단둘이 receipt**(`receiptPeople`가 정확히 {나,대상} 2명)를 **4분류**: **상대 한턱**(`treat===true && paidBy===대상`)·
  **내 한턱**(`treat===true && paidBy===나`)·**일반 분담**(`treat!==true`)·**한턱 결제자 미상**(`treat===true`인데 paidBy가
  나·대상 아님 — 빈값 포함, 판단 불가). **불변식: 단둘이 전체 = 상대 한턱 + 내 한턱 + 일반 분담 + 한턱 결제자 미상.**
  단둘이는 2명 1/N이므로 한턱 금액 = `receipt.total` 전액을 결제자→상대에게 귀속. ② **Hero 주지표 교체**: '○○이 낸 금액/
  내가 낸 금액'(실결제) → **'○○이 한턱 / 내가 한턱'**(단둘이 treat만, 동적 계산). 문구 '단둘이 만났을 때 / **서로에게 한턱낸
  기록**'(받을돈·줄돈·순수 표현 금지). ③ **여럿이 treat 제외** — 이 Hero는 **단둘이만**(3명↑ 자리 treat는 +0원, 기존 아래
  '내가 한턱' 통계에 그대로 남음). ④ **일반 분담·한턱 결제자 미상**은 Hero 하단 **건수만** 보조 row(`_duoSecondaryHtml`,
  기존 `.rel-duo-unknown` 토큰 — 경고색·카드 없음, 한턱 금액과 총액 안 섞음). 각 ≥1건일 때만 노출. ⑤ **ratio Bar 제거**
  (한턱 관계에 경쟁적 비율 Bar 불필요 — Hero 재디자인 없이 Bar만 삭제). ⑥ **drill-down v3.54/55 패턴 재사용**
  (`_openDuoDrill`: `tgt`=상대 한턱·`me`=내 한턱·`normal`=일반 분담·`unknown`=한턱 결제자 미상). 상대/내 한턱은 제목
  '○○이 나에게 한턱'/'내가 ○○에게 한턱'·합계 foot. **일반 분담 drill**은 날짜 줄에 **결제자 · 1인 부담액**(기존 `_receiptShare`
  1/N, 불변) 표시·foot '총액 합계'(§8 — 한턱 금액에 포함 안 함). 결제자 없으면 '미상'. ⑦ **실결제 helper/data 보존**
  (`_personRelation`의 `tgtDuo`/`myDuo` 그대로, Hero 로컬 `duoTgt`/`duoMe`도 계산은 유지 — 향후 상세 분석용). ⚠️
  `_receiptShare`/`_participantSplit`/`receiptPeople`/`normalizeName`/**treat 의미**/`splitExclude`/여럿이·전체 결제/meetingId·
  만남 통계/**아래 '내가 한턱'(단둘이+여럿이) insight**/Dutch Pay/Dropbox/receipt schema 전부 불변(삭제·변경 없음).
  ⚠️ **라벨 혼동 주의**(§18): Hero '내가 한턱'(단둘이만·265,000/5)과 아래 insight '내가 한턱'(전체·399,600/8, 단둘이 265,000
  sub)이 같은 라벨 — 전체/단둘이/여럿이 정보구조 정리는 향후 사용자 결정. 검증(실데이터 151건 신유철): 단둘이 20 =
  상대 한턱 320,900/6 + 내 한턱 265,000/5 + 일반 분담 9 + 미상 0(불변식 PASS), drill 합계=Hero, 실결제 431,900/9·505,000/10
  재현(보존), 아래 '내가 한턱' 399,600/8 불변, 합성 A~F(내결제 일반→내한턱0·일반+1 / 내결제 한턱→내한턱 100,000 / 상대
  한턱→상대 100,000 / 상대 일반→일반+1 / 3명 한턱→+0 / paidBy없음 한턱→미상+1) PASS, Desktop/Mobile 390·430 overflow
  없음·시트 하단·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.56` — **사람 검색 renderer 일관성: 데이터 유무·건수와 무관하게 항상 같은 Person Dashboard(계산 불변, 분기/이관만).**
  ⚠️ **근본 원인**: 평문 이름 검색이 **데이터 유형에 따라 다른 화면**으로 갈렸다 — `hasPayer&&!hasPart` → 결제자 전용 view,
  `hasPart&&!hasPayer` → 참석자 전용 view(예: 김승환은 참석 기록만 있어 '김승환 참석 내역'), `hasPayer&&hasPart` → 통합
  대시보드(예: 김영석). **수정**: 명시 접두어(`결제자 X`/`참석자 X`)만 전용 필터 뷰로 남기고, **평문 이름 검색은
  `(hasPayer||hasPart)`면 무조건 통합 대시보드**(`renderPersonDashboardHtml`)로 라우팅. 이 renderer는 `payerRecs`/`partRecs`
  한쪽이 비어도 안전(결제 내역/참석 내역 섹션이 각자 `length>0`일 때만 렌더, Hero는 `_personRelation`이 빈 배열도 처리).
  §5 **데이터 보존**: 참석 전용 view에만 있던 **'자주 함께한 멤버'**를 재사용 헬퍼 `_coMembersHtml`로 통합 대시보드에
  이관(참석 receipt 동행자 빈도 top5 — 집계 로직 동일, 칩은 기존 `[data-ppname]` 위임으로 클릭 시 인물 검색). 참석 횟수·
  참석 부담액·참석 목록은 대시보드가 이미 제공. ⚠️ `normalizeName`/`receiptPeople`/`_receiptShare`/`_participantSplit`/
  `_personRelation`·단둘이 실결제·여럿이·한턱·참석부담·meetingId/만남 통계·Dutch Pay·기간 필터·v3.54~55 drill-down/결제자
  미상 전부 불변. 명시 접두어 필터 뷰(`renderPayerSummaryHtml`/`renderParticipantSummaryHtml`)는 그대로 유지(별도 기능).
  검증(실데이터 151건): 신유철·김영석·김승환 + 1건/참석만/결제만/결제+참석 사용자 모두 `renderPersonDashboardHtml` 단일
  사용(헤더 구조 동일 person icon·이름·소제목·기간 slot·divider), '자주 함께한 멤버' 표시, drill-down·미상·계산 회귀 없음,
  Desktop/Mobile 390·430 overflow 없음·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.55` — **단둘이 Hero 데이터 표현 정제: 전체 건수 정정 + 결제자 미상 그룹 노출(계산 로직 불변, 단둘이 표현만).**
  ① Hero 우측 '영수증 N건'을 `tgtDuo+myDuo`(결제자 확인분, 19)에서 **단둘이 전체**(`receiptPeople`가 정확히 {나,대상}인
  모든 receipt, paidBy 유무 무관 = `duoAll`, 20)로 정정 — 동적 계산(하드코딩 없음). ② 단둘이를 **3그룹**으로 분류:
  상대 결제(`paidBy===대상`)·내 결제(`paidBy===나`)·**결제자 미상**(paidBy가 빈값이거나 어느 쪽도 아님). **불변식
  전체 = 상대 + 나 + 미상**. ③ 미상 **≥1건일 때만** Hero 하단에 secondary row(`결제자 미상 N건 · N원 ›` — 경고색·카드·
  배경 없이 기존 `--divider`·`--text-tertiary` 토큰만, 0건이면 숨김). 클릭 → 기존 drill-down(`_openDuoDrill('unknown')`,
  `_mtgSheetOpen`) 재사용(제목 '결제자 미상'·부제 '○○과 단둘이 있었을 때'·목록 최신순·합계 foot·row 클릭 `selectReceipt`).
  ④ **비율 Bar는 그대로**(결제자 확인 실결제 431,900 vs 505,000만, 미상은 비율에서 제외 — 누가 냈는지 모르므로).
  ⑤ Hero의 '결제 차이' 캡션 **제거**(`_duoDiffHtml` 삭제 — 정산/채무 의미 오해 방지). ⑥ 미상 receipt의 `paidBy`를
  사용자가 상세에서 수정하면 **다음 렌더에 자동 재계산**(미상 −1 / 해당 측 +1, 전체 불변) — 자동 보정은 하지 않음.
  ⚠️ 여럿이·전체 결제·내가 한턱·참석 부담액·meetingId/만남 통계·`_receiptShare`/`_participantSplit`/`treat`/`splitExclude`·
  Dutch Pay·기간 필터·정확일치(`receiptPeople`/`normalizeName`) 전부 불변. v3.54 상대/나 drill-down도 그대로.
  검증(실데이터 신유철 + 합성 A~I): 단둘이 **20 = 상대 9 + 나 10 + 미상 1**(성수불막사우나 22,000·paidBy 빈값), Hero=
  drill-down 합계·건수 일치(상대 431,900/9·나 505,000/10·미상 22,000/1), 미상 paidBy→나/상대 수정 시 자동 재계산,
  미상 0건 row 숨김, Desktop/Mobile 390·430 overflow 없음·콘솔에러 0. 변경 파일 `index.html`만.
- `v3.54` — **단둘이 Hero '실결제액' 표현 + 근거 영수증 drill-down(계산 불변 — 표현/상호작용만 추가).**
  단둘이(`receiptPeople`가 정확히 {나,대상} 2명) receipt를 **`paidBy` 실제 결제자에게 `total` 전액 귀속**(1/N 아님).
  이미 계산돼 있던 `tgtDuo`(단둘이+상대결제)·`myDuo`(단둘이+내결제)를 그대로 사용 — **`treat`/`splitExclude`와 무관**(실결제
  기준). ① Hero 라벨 '○○이 결제/내가 결제' → **'○○이 낸 금액/내가 낸 금액'**. ② 두 금액 side를 **클릭 가능**하게(button,
  `data-duo=tgt/me`) — 카드·새 배경 없이 미세 affordance만(hover 밑줄+chevron `›`, focus ring). 0건 side는 비활성(div).
  ③ 클릭 시 **근거 영수증 drill-down**(`_openDuoDrill`, `_mtgSheetOpen` 재사용: 데스크탑 중앙 카드/모바일 하단 시트) —
  제목·합계·건수·부제('나와 단둘이 있었을 때' / '○○과 단둘이 있었을 때') + 영수증 목록(**최신순**, 매장/금액/날짜) + 합계 foot.
  **진실원 동일**: Hero 숫자에 쓴 collection을 `_personDuoDrill`에 저장해 그대로 목록화(목록 합계·건수 = Hero). row 클릭 →
  기존 `selectReceipt`(영수증 상세). ④ **결제 차이**(`abs(내−상대)`) 캡션을 ratio Bar 아래 한 줄로(받을돈/줄돈/빚 등 표현
  없이 '결제 차이 N원' 중립). ⑤ Empty: 0건 클릭 불가(비활성), drill-down 자체는 빈 목록이면 안내문. ⚠️ **여럿이·전체 결제·
  내가 한턱·참석 부담액·meetingId/만남 통계·`_receiptShare`/`_participantSplit`/`treat`/`splitExclude`·Dutch Pay·기간 필터·
  정확일치(`receiptPeople`/`normalizeName`, `이용일`≠`와이프(이용일)`) 전부 불변.** paidBy 누락 단둘이는 어느 쪽에도 귀속하지
  않음(자동 수정 없음, 보고만). 검증(실데이터 신유철 + 합성 A~L): Hero 상대 431,900/9·나 505,000/10, drill-down 합계·건수 =
  Hero(PASS), 3명↑ 제외, treat/splitExclude 실결제 포함, row→상세 이동, Desktop/Mobile 390·430 overflow 없음·콘솔에러 0.
  변경 파일 `index.html`만.
- `v3.53` — **사람별 '만남 횟수'(meetingId 기준 관계 지표) 계산·표시 — 금액 분석(receipt 기준)은 전부 불변, 새 지표만 추가.**
  **Receipt=결제/금액 단위, Meeting=meetingId 단위**로 명확히 분리. 새 런타임 헬퍼 `_personMeetingStats(rel)`:
  ① **확정된 만남** = 같은 `meetingId` 그룹(런타임 Set — receipt가 몇 개든 **1회**), ② **people union** = 그 meetingId
  전체 receipt의 `receiptPeople` 합집합(정확일치·원본 participants 불변, `이용일`≠`와이프(이용일)`), ③ **나+대상이 union에
  모두 있는 meetingId만** 관계 만남으로 셈(대상만 있고 내가 없으면 제외), ④ union이 **정확히 {나,대상} 2명이면 단둘이**,
  그 외 **여럿이**(한 meeting 안 중간 합류·이탈도 union 기준이라 여럿이 1회), ⑤ **미분류 영수증** = '함께한' receipt 중
  `meetingId` 없는 것(횟수로 환산 안 함), ⑥ 기간은 `rel.pool`(현재 기간에 대상이 등장하는 meetingId)로 후보 게이트
  (person-scoped; 한 meeting의 receipt가 기간 내 여러 개여도 count=1). **불변식 confirmed = duo + group.** ⚠️ 각 meetingId는
  단둘이/여럿이 중 정확히 하나. **표시**: 헤더 소제목 `함께한 영수증 N건 · 확정된 만남 M회`(receipt/meeting 수를 혼합하지
  않고 병기), 통합 대시보드에 compact 관계 요약(확정된 만남/단둘이/여럿이/미분류 — Foundation 토큰만, 금액 분석과 상단
  divider로 분리). ⚠️ **자동 추정(날짜/시간/참석자/AI/자정 연결)·round(1차2차)·payee·treatBy·meetingName/Date/Participants·
  별도 Meeting DB 전부 미도입.** meetingId가 1건에만 남아도 확정 만남 1회로 유지(자동 삭제/보정 안 함 — '최소 2건 묶기'는
  생성 UX 규칙일 뿐, 분리 후 1건 잔존은 정상). **금액 계산**(`_personRelation`의 상대/내/단둘이/여럿이/전체 결제·한턱·
  참석 부담액·결제 비율·`treat`/`splitExclude`), Dutch Pay payload, meetingId 묶기/분리, 레이아웃 전부 불변(회귀 없음).
  검증(실데이터 151건 신유철 + 합성 A~H): 불변식 confirmed=단둘이+여럿이 PASS, 같은 meetingId 중복 count 없음, 자정 넘김
  1회, 중간 합류/이탈 여럿이 1회, meetingId 없는 receipt 만남 +0·미분류 +N, 나 없는 meeting 관계 +0, 기존 금액값 동일,
  콘솔에러 0. 변경 파일 `index.html`만.
- `v3.52` — **Responsive Detail Header 패턴을 다른 상세 화면으로 확장(일관성 작업 — 기능·계산·데이터·정보구조 불변).**
  영수증 상세의 헤더 grammar(breadcrumb·Page Title·meta·고정 divider)와 Foundation 토큰을 다른 Detail View에 통일했다.
  ① **사람 분석**: 이미 영수증 상세와 **같은 `.main-top`/`.main-body`**(제목 `.main-title`·부제 `.main-sub`·기간 드롭다운
  `#ledgerPeriodSlot`·고정 divider Y=224)를 쓰고 있어 **코드 변경 없음**(확인만). 단둘이 Hero·여럿이·전체·한턱·참석 부담액
  UI·계산 전부 불변. ② **선불권 상세**(`prepaid.js`·`prepaid.css`): 고정 헤더를 영수증 상세와 동일 grammar로 통일 —
  **breadcrumb(← 선불권, 목록 복귀) + 제목(매장명, Foundation `.main-title` 토큰·한 줄 `nowrap+ellipsis`) + meta(`.main-sub`=
  남은 잔액 N원)**. 데스크탑·모바일 **공통**(기존엔 데스크탑만 제목=매장명, 모바일은 제목 '선불권'+본문 카드에 매장명).
  제목 typography를 하드코딩 24/23px → Foundation `--fs-page-title`/`--fw-strong`/`--ls-page-title`에 위임, 상세 헤더
  top-align(`#viewPrepaid.pp-detail-view>.pp-header{align-items:flex-start}`), breadcrumb는 `.back-to-summary`+`.pp-eyebrow--crumb`
  (대문자/자간 해제). 뒤로가기 화살표 자리(`pp-back-btn` 숨김) 잔여 들여쓰기 제거. ⚠️ **본문 balance 카드·사용/충전/환불/
  만료 차감/정보 수정 5개 액션 행·계산(`ppTotals`/`ppSuggestedUseAmount`/…)·저장·정보구조는 전부 그대로**(§9 Primary 액션
  본문 유지, §19 정보구조 재설계 금지). 긴 매장명에도 헤더 높이 불변(데스크탑 144px 고정·모바일 `min-height:var(--mobile-head-h)`).
  ③ **Meeting 오버레이**(`.mtg-sheet`): 오버레이라 Page Header 높이는 미적용, 제목/meta/divider/버튼 role만 Foundation 시맨틱
  토큰(`--text-primary/secondary/tertiary`·`--divider`·`--border`·`--color-primary`·`--fw-strong`·`--fs-secondary`)으로 재배선
  (값 동일 → 시각 변화 거의 없음). ⚠️ receipt schema·meetingId·Dutch Pay payload·normalizeName/receiptPeople/_personRelation/
  _receiptShare/treat/splitExclude·선불권 계산·Dropbox 구조·영수증 상세 저장 UX(CLEAN/DIRTY/SAVING/SAVED/ERROR)·헤더 고정
  (divider Y=224) 전부 불변. 검증(실데이터 151건): 데스크탑+모바일(390·430) 영수증/선불권/사람 상세 헤더 정렬·긴 제목 한 줄
  ellipsis·breadcrumb 목록 복귀·저장 UX 1회 저장 회귀 없음·선불권 계산/액션 불변·가로 overflow 없음·콘솔에러 0. 변경 파일
  `index.html`·`prepaid.js`·`prepaid.css`.
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
  meetingId: "mtg_xxx",      // optional (v3.46~) — 같은 만남으로 묶인 receipt 연결 ID
  meetingOrder: 2,           // optional (v3.83~) — 만남 안 차수(표시 전용, 계산·Dutch Pay에 안 씀)
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
- ⚠️ **구분선은 항상 완전한 직선 (v3.62 Foundation 불변식)**:
  "Dividers are always straight. Flat rows never use rounded corners.
  Rounded corners are reserved for containers and interactive controls, not separators."
  - **radius 금지**: divider / flat information row(`.rel-li`·`.pd-row`·`.org-row`) / table·receipt·date-group·section·Action Bar separator / 선택된 flat receipt row.
  - **radius 허용**: Card·Modal·Sheet 외곽 / Input·Select·Button / filter chip·badge·toggle·selection circle.
  - ⚠️ **함정**: 클릭 가능 flat row에 `border-radius`를 주면 그 행의 `border-bottom`(divider) 양끝이 곡선으로 보인다.
    hover 피드백은 radius 없는 full-width 사각 tint(`background:var(--fill)`)로 준다. `overflow:hidden` 부모 radius가 내부 divider 끝을 자르지 않는지도 확인.

## ⚠️ 숫자 규칙 (v3.84~ · Dutch Pay와 동일 — 매번 다시 묻지 않도록 고정)
- **표기는 `fmtMoney(n)` 하나로**: `Math.round(n).toLocaleString('ko-KR')`(Dutch Pay `fmt`와 동일 — 천 단위 쉼표, 음수는 `-1,000`). 금액 뒤 `원`은 숫자와 붙여 쓴다(`12,000원`).
  새 코드에서 쉼표를 직접 만들거나(`replace(/\B(?=…)/)`) 다른 구분자·약식 표기(`1.2만`)를 쓰지 말 것.
- **글꼴 속성은 `font-variant-numeric:tabular-nums`만**(전역 `html,body`에 이미 있음). ⚠️ **`font-feature-settings:'tnum'` 금지** —
  iOS 시스템 글꼴에서 OpenType tnum을 직접 켜면 쉼표·마침표까지 숫자 폭으로 넓어져 Dutch Pay와 쉼표 간격이 달라진다(v3.37~v3.83 원인).
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
