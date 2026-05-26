# 더치페이 앱 프로젝트

## 프로젝트 개요
단일 HTML 파일로 동작하는 더치페이 정산 앱.
외부 의존성 없음 — 순수 HTML + CSS + Vanilla JS, 인라인 SVG 아이콘.

## 현재 파일
- `dutchpay.html` — 앱 전체 (HTML/CSS/JS 통합)

## 핵심 기능
1. **참여자 관리** — 쉼표로 여러 명 동시 입력, 전체 삭제, localStorage 영속화
2. **지출 입력** — 각 지출마다 이름·금액·결제자·참여자·차액 부담자 지정
3. **내역 탭** — 요약 카드 + 송금 내역 + 지출 내역 (지출 클릭 시 편집)
4. **공유 탭** — 송금 안내 + 결제 내역 + 일자 + 이미지로 공유하기 (Web Share API + PNG 다운로드)

## 영속성 (localStorage)
- 키: `dutchpay_v1`
- 저장 데이터: `people, items, idc, settleDateStart, settleDateEnd`
- 모든 mutator 종료 시 `saveState()` 호출 (renderAll 끝, updateField, toggleMember, 날짜 변경 등)
- init 순서: `loadState() → renderAll()`
- `resetAllData()` 함수로 전체 초기화 가능 (확인 다이얼로그 포함)

## 차액(나머지 N원) 처리 규칙 (총액 기준 + 수동 override)
- **기본(자동)**: 각 지출의 분담금은 실수(float)로 누적, 마지막에 largest-remainder로 한 번 반올림
  - 동률이면 결제자 우선 부담
  - 총합이 깔끔하면 자동으로 깔끔 (예: 3×10,000/3명 → 모두 10,000)
- **수동 (`it.rounderOverride`)**: 사용자가 차액 부담자를 직접 지정
  - 해당 지출은 per-item 정수 분배 (지정인이 base+rem, 나머지는 base)
  - 자동 적용된 지출과 혼합 가능
  - UI 진입 경로 2가지:
    1. 지출 편집 폼의 "차액 부담자" 셀렉터
    2. **차액 chip 클릭 → popover** (인라인 빠른 변경)
- **차액 chip**(`차액 N원`)은 `hasRounding=true`일 때만 표시 (총합에 차액 발생 시)
- chip 위치: 지출 이름 옆 (HTML & Canvas 이미지 양쪽)
- chip은 `<button>` 요소, 클릭 시 `showRounderPicker(itemId, anchorEl, event)` 호출
- 참여자 삭제 시 해당 인물이 `rounderOverride`로 지정된 항목은 null로 초기화

## 아이콘 매핑
- `ICON_RULES` 배열로 데이터화 (`[svg, regex]` 쌍, 순서대로 매칭)
- 카테고리: 노래방·카페·술·교통·쇼핑·영화·숙소·식사 + 기본 영수증
- 브랜드 키워드 다수 포함 (스타벅스, 강강술래 등 주요 한국 프랜차이즈)
- 새 키워드 추가 시 `ICON_RULES`만 수정하면 됨

## 반응형 레이아웃
- **데스크톱 (>700px)**: 좌측 입력/지출 목록 + 우측 편집·내역·공유 패널 (2단)
  - 좌측 패널 가로 padding은 `--pad-x: 32px` CSS 변수로 통일
- **모바일 (≤700px)**: 상단 탭 + 카드 스크롤, 지출 편집은 하단 시트(Sheet)

## 디자인 원칙
- 화이트 배경 + 회색 톤 (#F7F7F8, #FAFAFA, #FFFFFF) — 공유 탭은 배경 회색·카드 흰색으로 분리
- 외부 폰트/CDN 없음 — 오프라인에서도 동작해야 함
- 아이콘: 인라인 SVG만 사용
- 참여자 삭제: 이름(string) 기반으로 처리 (인덱스 기반 금지)
- 이름 파싱: 쉼표만 구분자, 공백은 이름의 일부
- HTML 속성 안에 JSON 문자열 넣을 때 `ja(p)` 헬퍼 사용 (`&quot;` 이스케이프)

## 알려진 버그 패턴 (주의)
- 참여자 pill 삭제 시 반드시 `removePerson(name)` 방식 사용
- 이름 파싱 정규식에 `\s` 포함 시 이름이 잘림 → `/[,，、]+/` 만 사용
- CDN 링크 추가 시 로컬 파일 환경에서 깨짐
- 한글 IME 합성 중 `keydown`에서 `preventDefault()` 호출 금지 → 마지막 음절이 버퍼에 남음. `compositionstart/end`로 상태 추적 후 `input` 이벤트에서 처리
- `JSON.stringify` 결과를 HTML 속성에 그대로 쓰면 큰따옴표가 속성을 닫아버림 → 반드시 `ja()` 헬퍼 사용

## 다음 작업 아이디어
- 지출 순서 드래그로 변경
- 텍스트 형식으로도 공유 (이미지 외, 카톡 직접 붙여넣기용)
- PWA 설정 (홈 화면 추가)
- 여러 정산 그룹 관리 (예: "도쿄여행", "회식" 분리)
- 통화 단위 선택 (원 외에 달러·엔 등)
