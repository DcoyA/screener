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



\## 운영 참고 (GitHub Actions 스케줄)

\- GitHub은 저장소에 60일간 활동(커밋/PR 등)이 없으면 scheduled workflow를

&#x20; 자동으로 비활성화한다. 데이터 파이프라인이 갑자기 안 도는 것처럼 보이면

&#x20; 이 정책부터 의심하고, Actions 탭에서 workflow가 비활성화돼 있지 않은지

&#x20; 확인한다(재활성화는 워크플로 파일을 아무 커밋에 포함시키거나 Actions

&#x20; 탭에서 직접 Enable 하면 된다).

\- `weekly-json-update.yml`은 평일 09:07 KST 스케줄에 11:07 KST 백업 스케줄을

&#x20; 추가로 둔다. `check` 잡이 `app/data/stocks.json`의 `updatedAt`이 이미

&#x20; 오늘(KST) 날짜면 스킵하므로, 백업 스케줄은 평소엔 아무 일도 안 하고

&#x20; 09:07 실행이 지연/누락됐을 때만 실제로 파이프라인을 돌린다.

\- `sync-supabase-watchdog.yml`(`scripts/verify-today-ingested.mjs`)이 매일

&#x20; 평일 KST 17:00에 오늘자 Supabase 스냅샷 존재 여부·직전 대비 행 수·

&#x20; targetPrice 결측 비율·S등급 비율을 검사해서, 하나라도 이상하면

&#x20; `SLACK_WEBHOOK_URL`로 알림을 보낸다.



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

8\. 작업 덩어리(여러 커밋 가능)가 끝나면 배포 명령을 딱 한 줄 안내한다: `git push`.

&#x20;  단계별로 `git push origin <해시>:main` 을 나열하지 않는다 — 내가 "여기까지만

&#x20;  올려라"라고 명시할 때만 그 형태를 쓴다. `git push`는 fast-forward라 원격을

&#x20;  덮어쓰지 않는다(로컬이 origin보다 앞서기만 하면 안전). push는 내가 직접 실행한다.

9\. 파이프라인 로직 변경 시 실제 API를 호출하지 말고, 기존

&#x20;  `app/data/stocks.json`을 입력 픽스처로 쓰는 검증 스크립트를 별도로 만든다.

10\. \*\*모든 작업 지시는 STEP 0(상태 확인)부터 시작한다.\*\* 다른 규칙에 앞서, 구현 전에:

&#x20;  (1) `git log --oneline -15`, 현재 HEAD, `origin/main` 동기 여부를 출력한다.

&#x20;  (2) 지시된 대상 파일들의 최근 커밋 이력을 확인한다.

&#x20;  (3) 지시 내용이 이미 반영돼 있으면 구현하지 말고 "이미 처리됨 + 커밋 해시"로 보고한다.

&#x20;  (4) 지시가 현재 코드 구조와 어긋나면 구현 전에 지적한다.



\## 하지 말 것

\- 기존 점수 산출 로직을 내 승인 없이 통째로 갈아엎기

\- 디자인/스타일 임의 변경 (요청한 것만)

\- 주석 남발. 왜 그렇게 했는지가 비자명할 때만 짧게.

\- 사용하지 않는 추상화 레이어 미리 만들기


## 프리미엄 리포트 프로젝트 (별도 서비스)
scripts/premium/, app/admin/editorial/ 는 이 문서의 위 도메인 규칙(적정가/성과/표현 규칙)과
무관한 완전히 독립된 서비스다.

### 데이터 파이프라인 동결 범위
대상: weekly-json-update.yml, sync-supabase.yml, update_data.py,
app/data/stocks.json, latest_stock_snapshots 테이블(읽기 전용 참조만 허용).

동결은 파일 단위가 아니라 변경 종류 단위로 적용한다:
- [동결] 적재/수집 로직, cron 시각, 데이터 스키마, 트리거 추가.
  내가 명시적으로 지시하기 전까지 건드리지 않는다.
- [허용] 주석 추가, 문서화, 실행 이력 0건으로 확인된 죽은 트리거 제거.
  단 [허용]에 해당하는 변경도 커밋 전에 내 승인을 받는다.

### 예외 이력
- 2026-08-31 / weekly-json-update.yml (name: "Weekday JSON Update")
  `name:` 줄 위에 경고 주석 1줄 추가 — 이 name 을 바꾸면
  sync-supabase-watchdog.yml 의 workflow_run 트리거가 조용히 죽는다.
  승인 근거: watchdog 트리거 개편 지시에 포함. 실행 경로 영향 없음(주석만).
- 2026-08-31 / sync-supabase.yml
  `on: push` 제거, workflow_dispatch 수동 복구 전용으로 전환. GITHUB_TOKEN 으로
  푸시된 커밋은 `on: push` 를 발동하지 못해 실행 이력이 0건이었고, 정규 적재는
  weekly-json-update.yml 의 인라인 스텝("Sync latest data to Supabase")이 담당한다.
  승인 근거: 위 지시에 명시. 동작 영향 없음(원래 발동되지 않던 트리거).
  부작용: 향후 checkout 에 PAT 를 붙여도 push 트리거는 부활하지 않는다.
  인라인 적재 스텝과의 이중 적재/루프를 막으려고 의도한 것이다.

### 동결 목록 점검 (지적만, 임의로 목록에서 빼지 않음)
- app/data/stocks.json 은 이미 상단 "작업 규칙 3" 및 "디렉토리 구조" 주석에서
  손 수정 금지로 전역 동결돼 있다. 여기 목록의 항목은 그와 중복이며, 파이프라인
  로직이라서가 아니라 산출물이기 때문에 동결된 것이다. 나머지 4개 항목은
  수집 파이프라인의 실행 코드/트리거/저장소라 동결 사유가 로직과 직결된다.

