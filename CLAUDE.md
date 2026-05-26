# Receipt DB — 영수증 관리 앱

## 프로젝트 개요
단일 HTML 파일로 동작하는 영수증 보관·검색 앱. dutch-pay의 자매 앱으로,
디자인 톤·코드 스타일을 dutchpay.html과 일치시킴.

- 사용자: 한국어 사용자, 비개발자, 혼자 + 가끔 가족 공유
- 처리량: 하루 10장 이하 (저용량, 영구 보존이 최우선)
- OCR·외부 API 사용 금지 — ChatGPT/Claude/Gemini 무료 버전으로
  사용자가 직접 사진 → 텍스트 변환 후 앱에 붙여넣기
- 외부 의존성 없음 — 순수 HTML + CSS + Vanilla JS, 인라인 SVG

## 현재 파일
- `index.html` — 앱 전체 (HTML/CSS/JS 통합)
- `README.md` — GitHub repo 첫 페이지용 한글 설명
- `CLAUDE.md` — 이 파일

## 버전 관리
- 단일 상수 `APP_VERSION` (JS 상단)이 진실의 원천. DOM 두 군데(좌측 상단 칩, 설정 탭 앱 정보 카드)에 init 시 주입
- 형식: `v메이저.패치2자리` (예: `v1.02`, `v1.10`, `v1.11` ... `v1.99` 후 `v2.00`)
- 변경 시 매번 `APP_VERSION` + 상단 changelog 코멘트 + CLAUDE.md changelog 한 줄씩 갱신
- JSON 백업 파일에도 `appVersion` 필드로 포함 — 어떤 버전에서 만든 백업인지 추적
- IndexedDB 스키마 버전(`DB_VER=2`)과 JSON 백업 포맷 버전(`version:2`)은 앱 버전과 **독립적**.
  세 가지 모두 다른 의미라 헷갈리지 말 것.

### Changelog
- `v1.00` — Phase 1 MVP: 영수증 추가/목록/상세/검색/JSON 백업
- `v1.01` — Phase 1.5 가계부 화면: 월 네비, 요약 카드 3장, 카테고리 막대, 일별 sparkline, 전월 대비
- `v1.02` — 시간 필드 UI 제거, 카테고리 자동 분류(기본 9개 + 사용자 학습 사전), 좌측 상단 버전 칩
- `v1.03` — 미리보기를 편집 가능한 폼으로 (매장명·일자·총액·품목 직접 수정 가능, 품목 추가/삭제 버튼).
  파서가 빈 품목명 라인도 살려서 보여줌. 품목 없는 영수증(노래방·주유·병원)도 warning만 띄우고 저장 가능.

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
- **기본 9개 카테고리**: 마트 / 외식 / 술집 / 카페 / 배달 / 교통 / 쇼핑 / 병원·약국 / 문화
- **규칙 사전 (`CAT_RULES`)**: 카테고리당 한글 키워드 배열. 가게명에 키워드 포함 시 매칭
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
- 화이트 배경 + 회색 톤 (`--bg:#F7F7F8`, `--card:#fff`, `--left-bg:#FAFAFA`)
- 강조색 `--blue:#0071E3`, 위험 `--red:#E53E3E`, 성공 `--green:#1DAD53`
- 모서리 `--r:16px / --rm:10px / --rs:9px`
- 외부 폰트·CDN 없음 — 오프라인 동작 필수
- 아이콘: 인라인 SVG만
- 모바일 ≤700px 분기, 데스크톱은 좌·우 2단 그리드
- iOS 자동 확대 방지 (`maximum-scale=1.0,user-scalable=no` viewport)

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
- 사진 첨부 input은 `accept="image/*" capture="environment"`로 모바일 카메라 직행 가능
- IndexedDB 트랜잭션은 microtask 안에 다 끝내야 — async/await 중간에 외부 await 끼면 트랜잭션 종료됨

## 다음 작업 후보
- Dropbox OAuth 연동 (Phase 3)
- 한글 자모 검색 ("ㅎㄴㄹ" → "하나로")
- 월별 통계 차트
- PDF로 영수증 묶음 내보내기 (가계부 인쇄용)
- PWA 설정 (홈 화면 추가, manifest)
