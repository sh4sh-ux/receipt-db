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
- `README.md` — GitHub repo 첫 페이지용 한글 설명
- `CLAUDE.md` — 이 파일
- `icons/` — PWA 아이콘(`icon-192/512.png`, `apple-touch-icon.png`) + `icons/categories/*.png`
  (실제 사용 4개: bar·cafe·movie·golf. 나머지 7개는 SVG로 되돌린 뒤 남은 미참조 파일)
- `scripts/receipt_png_to_receipt_db.py` — PNG/JPG 영수증 스크린샷 자동 등록 (맥에서 실행)
- ⚠️ `receipt-db/` — repo 안에 커밋된 **옛 사본**(`index.html`이 v1.02). 앱이 참조하지 않는 화석. 정리 대상.

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
- 확인 항목: 액션바 위치, 하단으로 새는 내용 유무, 사이드바 구분선과 액션바 구분선 정렬.

### 레이아웃 구조상 주의 (v2.24에서 확정)
- 모바일(≤780px)에서 `.main`이 `display:block`으로 바뀌므로 `.main-body`가 flex 자식이 아니게 됨.
  → `position:sticky; bottom:0`이 기준을 잃고 문서 흐름 중간에 박힘.
  → 그래서 모바일 액션바는 **`position:fixed`**, 데스크탑은 **`sticky`**로 분기.
- 모바일 액션바는 하단 nav bar(68px) 위에 고정: `bottom:calc(68px + env(safe-area-inset-bottom,0px))`.
- `.view.on`에 `overflow:hidden`을 걸지 말 것 — 카테고리 팝오버가 잘림 (v2.22에서 제거).

## ⚠️ Dropbox 실제 데이터 경로 (App folder 스코프)
앱의 Dropbox 연동은 **App folder 타입** — API 경로 `/01_Personal/영수증/Receipt_DB/...`는
실제 Dropbox의 `01_Personal/Apps/앱/Receipt_DB_v1/01_Personal/영수증/Receipt_DB/...`로 매핑된다.
- 로컬 미러: `~/Library/CloudStorage/Dropbox/01_Personal/Apps/앱/Receipt_DB_v1/01_Personal/영수증/Receipt_DB/`
- `~/CloudStorage/Dropbox/01_Personal/영수증/Receipt_DB/`는 2026-06-02에 멈춘 화석 사본 — 앱이 보지 않음
- 스캔 자동화(inbox 쓰기)는 위 라이브 로컬 미러 경로를 사용한다 (receipt_pdf_to_jpg.py)
- **PNG/JPG 스크린샷**(토스 전자영수증 등)은 `scripts/receipt_png_to_receipt_db.py`가 처리 —
  감시 폴더에서 날짜 추출·리네임 후 `등록완료/YYYY-MM/`으로 이동, inbox에 레코드+사진 등록.
  ID는 `rec_YYYYMMDD_p해시6` 형식이라 앱·PDF 스크립트와 충돌 없음. PDF 스크립트와 동시 실행 금지
  (inbox 단일 쓰기 원칙 — 순차 실행은 안전). receipt_pdf_to_jpg.py 원본은 맥에만 있음(repo 밖)

### Changelog
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
  id: "rec_20260519_001",   // 날짜 + 일련번호
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
- **기본 카테고리 16종** (`BASE_CATEGORIES`, 리터럴 배열):
  외식 / 카페 / 술집 / 케이크 / 노래방 / 교통 / 쇼핑 / 영화 / 숙박 / 골프 / 스파 / 운동 / 여행 / 병원·약국 / 경조사 / 기타
- **구 카테고리는 alias로 흡수** — `normalizeCategory()`가 매핑:
  `마트→쇼핑`, `문화→영화`, `배달→외식`, `병원→병원·약국`, `약국→병원·약국`, `부의금`·`축의금→경조사`.
  별도 마이그레이션 함수 없이 **읽을 때마다 정규화**하는 방식.
- **표시 라벨은 따로** — `CATEGORY_LABELS`로 좁은 UI에서 축약: 케이크→기념, 노래방→노래, 병원·약국→의료, 경조사→경조
- **계층 그룹** `CATEGORY_GROUPS`: 경조사 ← 부의금·축의금
- **아이콘** — `getCatSvg(cat)` 하나로 통일해서 꺼냄:
  `CAT_PNGS`에 있으면 PNG(`getCatPng`), 없으면 `CAT_SVGS`의 인라인 SVG, 그것도 없으면 문서 아이콘 fallback.
  SVG `stroke-width`는 PNG와 굵기를 맞추려고 1.55 기준. PNG마다 투명 여백이 달라서 `CAT_ICON_SCALES`로 시각 크기 보정.
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
- 아이콘: **인라인 SVG 우선 + PNG 4개 예외**. 카테고리는 `CAT_SVGS`(인라인 SVG)가 기본이고
  술집·카페·영화·골프만 `CAT_PNGS`로 `icons/categories/*.png`를 씀. PWA 아이콘도 PNG.
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

## 현재 상태 (2026-08-30 기준)
- **버전 `v2.25`**, main 브랜치에 push 완료.
- 직전 작업: CLAUDE.md를 코드 실제와 대조해 정리 — 다크 테마(기본)·테마 토글 섹션 신설,
  브레이크포인트 700→780px, 아이콘 원칙(인라인 SVG + PNG 4개), 카테고리 16종·alias 구조,
  `capture` 함정 정정, v1.63~v2.07 changelog 공백 요약. **코드 변경 없음 — 문서만.**
- 그 전 작업: 추가 탭 저장 바(초기화·저장 버튼) 정리 — 버튼 크기, 구분선 정렬, 모바일 액션바 위치 수정.
  데스크탑 1280px·모바일 375px 양쪽 검증 완료.
- 로컬 경로: `~/Documents/Codex/2026-08-26/new-chat/work/receipt-db`
- 배포: `git push origin main` (GitHub `sh4sh-ux/receipt-db`)

### 작업 흐름
브랜치 생성 → 커밋 → main으로 squash merge → `git fetch origin main && git rebase origin/main` → push → 브랜치 삭제.
`gh` CLI는 이 환경에 없으므로 PR 없이 로컬 squash merge로 진행.

## 다음 작업 후보
- 한글 자모 검색 ("ㅎㄴㄹ" → "하나로")
- PDF로 영수증 묶음 내보내기 (가계부 인쇄용)
- PWA 마무리 — **절반은 이미 되어 있음**: `apple-mobile-web-app-*` / `mobile-web-app-capable` 메타태그와
  `icons/icon-192.png`·`icon-512.png`·`apple-touch-icon.png`는 있고, **`manifest.json`과 서비스워커만 없다**.
- `receipt-db/` 화석 폴더(v1.02 사본) 삭제
