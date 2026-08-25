\# 우량주 스카우터 (screener)



\## 프로젝트 개요

한국 주식(KOSPI/KOSDAQ) 밸류 스크리너. OpenDART 사업보고서 + KRX 시세

데이터를 결합해 종목을 점수화하고, 랭킹/진단/성과추적을 제공한다.



타겟 사용자: 주식 초보\~초중수. 직접 검색·분석하기 귀찮은 사람.

핵심 원칙: \*\*애널리스트가 봐도 우습지 않은 수준의 분석\*\*. 과장된 숫자보다

보수적이고 검증 가능한 표현을 항상 우선한다.



\## 기술 스택

\- Next.js 16.2.4 (App Router), React 19.2.0, JavaScript (TypeScript 아님)

\- Supabase (@supabase/supabase-js, @supabase/ssr) — 인증 / 사용자 데이터

\- Vercel 배포, GitHub Actions로 데이터 파이프라인 스케줄 실행

\- 데이터 수집/가공: Python (scripts/\*.py) → app/data/\*.json 산출



\## 디렉토리 구조

\- `app/` — Next App Router 페이지

&#x20; - `app/lib/` — 도메인 로직 (grade.js, diagnosisData.js, stocksData.js,

&#x20;   homeData.js, signalLevel.js, wishlist.js, supabase/)

&#x20; - `app/data/` — 파이프라인 산출물 JSON (stocks.json, risks.json,

&#x20;   reports.json, history.json). \*\*손으로 수정 금지, 스크립트로만 갱신\*\*

&#x20; - `app/components/` — 공용 UI

&#x20; - `app/api/` — Route Handlers

\- `scripts/` — 데이터 파이프라인

&#x20; - `update\_data.py` — 메인. DART+KRX 수집, 점수/적정가 계산, stocks.json 생성

&#x20; - `run\_data\_pipeline.py` — 오케스트레이션

&#x20; - `generate\_market\_state.py` — 시황 생성

&#x20; - `ingest-daily-snapshot.mjs` — history.json 스냅샷 적재

&#x20; - `premium/` — 프리미엄 리포트 생성

\- `.github/workflows/` — 스케줄 잡



\## 명령어

\- `npm run dev` — 로컬 개발 서버

\- `npm run build` — 프로덕션 빌드 (변경 후 반드시 통과 확인)

\- `python3 scripts/update\_data.py` — 데이터 갱신 (API 키 필요, 시간 오래 걸림)



\## 도메인 규칙 (중요)



\### 적정가 / 상승여력

\- 적정가는 \*\*단일 값이 아니라 밴드\*\*(보수/기준/낙관)로 표현한다.

\- 상승여력 표기 상한은 \*\*+60%\*\*. 이를 초과하는 계산 결과는 숫자를 그대로

&#x20; 노출하지 않고 "시장이 구조적 할인을 적용 중인 구간"으로 라벨 처리한다.

\- 지주사, 금융주, 건설, 바이오는 일반 상대가치 배수를 그대로 적용하면

&#x20; 안 된다. 별도 처리 분기가 반드시 있어야 한다.

\- 이유: 실제 증권사 목표주가는 현재가 대비 대체로 ±40% 범위. 그 밖의

&#x20; 숫자는 사용자 신뢰를 즉시 파괴한다.



\### 성과/백테스트

\- 누적 표본이 짧다는 사실(현재 약 3개월)을 숨기지 않는다.

\- 벤치마크 대비 열위인 구간도 그대로 노출한다.

\- 승률·수익률은 표본 수를 항상 함께 표기한다.



\### 표현 규칙

\- "수익 보장", "확정 수익률", "매수하세요", "지금이 기회" 류의 표현 금지.

\- 매수·매도 타이밍을 지시하는 문구를 생성하지 않는다.

\- 종목명은 DART 원본("XX보통주")을 그대로 쓰지 말고 정제해서 노출한다.

\- 모든 분석 화면 하단에 투자 참고용 고지 문구를 유지한다.



\### 법적 제약

\- 유료 구독/결제 기능은 \*\*내가 별도로 지시하기 전까지 구현하지 않는다.\*\*

&#x20; 국내 자본시장법상 유사투자자문업 신고 이슈 검토가 선행되어야 한다.



\## 작업 규칙

1\. 코드를 쓰기 전에 \*\*먼저 계획을 제시하고 내 승인을 기다린다.\*\*

2\. 한 번에 한 가지 관심사만 수정한다. 여러 파일을 광범위하게 리팩터링하지 않는다.

3\. `app/data/\*.json`은 직접 편집하지 않는다. 로직은 스크립트에서 고친다.

4\. 새 의존성 추가 전 반드시 물어본다. 현재 의존성은 5개뿐이고 이걸 유지하고 싶다.

5\. TypeScript로 변환하지 않는다. JavaScript 유지.

6\. 수정 후 `npm run build`를 실행해 통과를 확인하고 결과를 보고한다.

7\. 커밋 메시지는 한국어로, `타입: 내용` 형식. (feat/fix/refactor/chore/docs)

9\. 파이프라인 로직 변경 시 실제 API를 호출하지 말고, 기존

&#x20;  `app/data/stocks.json`을 입력 픽스처로 쓰는 검증 스크립트를 별도로 만든다.



\## 하지 말 것

\- 기존 점수 산출 로직을 내 승인 없이 통째로 갈아엎기

\- 디자인/스타일 임의 변경 (요청한 것만)

\- 주석 남발. 왜 그렇게 했는지가 비자명할 때만 짧게.

\- 사용하지 않는 추상화 레이어 미리 만들기


## 프리미엄 리포트 프로젝트 (별도 서비스)
scripts/premium/, app/admin/editorial/ 는 이 문서의 위 도메인 규칙(적정가/성과/표현 규칙)과
무관한 완전히 독립된 서비스다. 작업 중 다음 파일/테이블은 절대 수정하지 않는다:
weekly-json-update.yml, sync-supabase.yml, update_data.py, app/data/stocks.json,
latest_stock_snapshots 테이블(읽기 전용 참조만 허용).

