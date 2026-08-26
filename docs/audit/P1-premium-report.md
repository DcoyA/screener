\# 프리미엄 리포트 상용화



> 유료 상품이다. LLM 원문이 검수 없이 나가는 현 구조를 먼저 끊는다.

> 작업 전 계획 제시 → 승인 대기.

> 이 작업은 CLAUDE.md의 "프리미엄 리포트 프로젝트" 섹션 범위에 속한다.

> weekly-json-update.yml, sync-supabase.yml, update\_data.py,

> app/data/stocks.json, latest\_stock\_snapshots는 건드리지 않는다.



\## 배경

\- `generate-report.mjs`가 `status='draft'`로 저장하고

&#x20; 같은 잡의 `send-report-email.mjs`가 그 draft를 즉시 발송 중

&#x20; → 사람 검수 게이트가 없다

\- `FROM\_ADDRESS = "onboarding@resend.dev"` (도메인 미인증)

\- 프롬프트에 CLAUDE.md 표현 규칙이 주입되지 않음

\- 홈페이지가 약속한 "단기·중기·장기 시나리오", "무엇이 틀리면 철회할지",

&#x20; "후속 추적"이 리포트 스키마에 아예 없음



\---



\## TASK 1. 발송 게이트 분리 (최우선)



\### 1-1. `premium-report-generate.yml`에서 발송 스텝 제거

`Send report email` 스텝을 삭제하고, 생성 완료 후

`scripts/premium/notify-draft-ready.mjs`를 호출하도록 변경.



\### 1-2. `scripts/premium/notify-draft-ready.mjs` 신규

슬랙으로 전송:

```

📄 8/26 리포트 초안 생성 완료

&#x20;  4개 섹션 · 약 7분 분량 · 관련 종목 6개

&#x20;  \[미리보기 열기]  ← /admin/editorial/preview/{id}



\[✅ 승인하고 발송]  \[✏️ 수정 필요]  \[❌ 폐기]

```



\### 1-3. `app/api/slack` 확장

`approve\_report` 액션 → `reports.status = 'approved'`

→ 즉시 `workflow\_dispatch`로 `premium-report-send.yml` 실행



\### 1-4. `premium-report-send.yml` 신규

\- `workflow\_dispatch` 전용 (schedule 없음)

\- `send-report-email.mjs` 실행

\- `send-report-email.mjs`의 조회 조건을 `status='draft'` → `status='approved'`로 변경



\---



\## TASK 2. 30분 폴링 폐지



`premium-report-generate.yml`의 cron 2줄을 모두 제거하고

`workflow\_dispatch`만 남긴다.



`app/api/slack`의 후보 승인 핸들러에서

`topic\_candidates.status = 'selected'` 갱신 직후

`premium-report-generate` 워크플로우를 `workflow\_dispatch`로 호출.



→ 승인 즉시 생성. 하루 34회 무의미 실행 제거.

→ `GH\_PAT` (repo scope) 시크릿 필요. 내가 발급한다.



\---



\## TASK 3. 리포트 스키마 전면 개편



\### 3-1. `scripts/premium/lib/reportSchema.mjs` 신규

아래 스키마를 상수로 정의하고 `generate-report.mjs`가 import.



```

cover: { headline, market\_temp, reading\_time\_min }

sections\[]: {

&#x20; title,

&#x20; what\_happened,        // 사실만

&#x20; why\_it\_matters,       // 해석

&#x20; scenarios: {

&#x20;   short: { horizon: "1\~4주",   view, watch },

&#x20;   mid:   { horizon: "1\~6개월", view, watch },

&#x20;   long:  { horizon: "1년+",    view, watch }

&#x20; },

&#x20; invalidation,         // 필수. 이게 틀렸다고 봐야 하는 조건

&#x20; related\_stocks\[]: { code, name, grade, grade\_4w\_ago,

&#x20;                     sector\_percentile, one\_liner },

&#x20; sources\[]: { type, url, date }   // 필수, 최소 1개

}

followup\[]: { from\_issue, topic, what\_changed, verdict }

next\_week\_calendar\[]: { date, event, why }

disclaimer

```



\### 3-2. 프롬프트 재작성 (`buildPrompt`)



반드시 포함할 제약:

```

\[표현 금지 — 위반 시 출력 전체 무효]

\- "수익 보장", "확정 수익률", "매수하세요", "지금이 기회", "급등 임박"

\- 매수/매도 타이밍을 지시하는 모든 문구

\- 목표주가를 단일 숫자로 단정하는 표현



\[필수 규칙]

\- 모든 사실 주장에는 sources 배열에 근거 URL과 날짜를 넣는다

\- 컨텍스트 데이터에 없는 사실은 절대 생성하지 않는다

\- 상승여력을 언급할 때 ±60%를 넘는 수치는 숫자로 쓰지 않는다

\- invalidation은 검증 가능한 조건이어야 한다

&#x20; (X) "시장 상황이 나빠지면"

&#x20; (O) "3분기 영업이익이 전년 동기 대비 감소로 전환하면"

```



\### 3-3. 컨텍스트 잘림 해결

현재 `JSON.stringify(context).slice(0, 6000)`은

JSON 중간에서 잘려 LLM이 오독할 수 있다.



→ `buildContextSummary(context)` 함수로 교체.

JSON 덤프가 아니라 사람이 읽는 마크다운 요약으로 변환하고,

섹션별 상한을 두되 \*\*항목 단위로\*\* 자른다(문자 단위 절단 금지).

상한 12,000자.



\### 3-4. 후처리 검증 (`validateReport`)

LLM 응답 파싱 직후 실행. 하나라도 걸리면 재생성 1회, 그래도 실패면

슬랙에 "생성 실패, 사유: X" 전송 후 종료(발송 안 함).



\- 금지 표현 정규식 매칭 0건

\- 모든 섹션에 `invalidation` 존재 + 20자 이상

\- 모든 섹션에 `sources` 1개 이상

\- `related\_stocks\[].code`가 실제 `latest\_stock\_snapshots`에 존재

\- 숫자로 표기된 상승여력이 ±60% 이내



\---



\## TASK 4. 후속 추적(followup) 구현



\### 4-1. `scripts/premium/build-followup.mjs` 신규

\- 7일 전 발행 리포트의 `related\_codes` 조회

\- 각 종목의 당시 종가 vs 현재가, 당시 등급 vs 현재 등급 비교

\- `verdict` 자동 판정:

&#x20; - 상승 시나리오였고 +3% 이상 → "맞음"

&#x20; - 상승 시나리오였고 -3% 이하 → "틀림"

&#x20; - 그 외 → "진행중"

\- 결과를 `generate-report.mjs`의 컨텍스트로 주입



\### 4-2. 원칙

\*\*틀린 것도 그대로 싣는다.\*\* 무료 `/performance` 페이지의 정직성을

유료 리포트로 확장하는 것이 이 기능의 목적이다.

verdict가 "틀림"인 항목을 숨기거나 완곡하게 쓰지 않는다.



\---



\## TASK 5. 이메일 발송 인프라



\### 5-1. 도메인 인증

`FROM\_ADDRESS`를 `report@hellomedia.win`으로 교체.

Resend 대시보드에서 SPF/DKIM/DMARC 레코드 발급 → 내가 DNS에 등록.



\### 5-2. `send-report-email.mjs` 개선

\- `List-Unsubscribe` + `List-Unsubscribe-Post` 헤더 추가

&#x20; (Gmail 대량 발송 정책 필수)

\- 순차 for 루프 → 배치 10건 동시, 배치 간 1초 대기

\- 실패 시 지수 백오프 3회 재시도 (401/403은 즉시 중단 유지)

\- `send\_logs`에 실패 건 상세 기록 (`failed\_count`, `failed\_emails` 컬럼 추가)

\- 전체 실패율 10% 초과 시 슬랙 경고



\### 5-3. HTML 템플릿

현재 `buildEmailHtml`은 `<p><a>` 링크 두 줄만 앞뒤로 붙인다.

→ `scripts/premium/lib/emailTemplate.mjs` 신규:

\- 테이블 기반 레이아웃 (Outlook 호환)

\- 인라인 CSS만 사용

\- 다크모드 대응 (`prefers-color-scheme`)

\- 디자인 토큰 값 하드코딩 (`--color-primary: #6c4fe0` → `#6c4fe0`)

\- 최대 폭 600px

\- 상단 로고 + 발행일 + 읽는 시간

\- 섹션 간 구분선

\- 하단 고정 푸터 (구독취소, 사이트 링크, 면책 문구)

\- 이미지 없이도 완전히 읽히도록 (이미지 차단 대비)



\---



\## TASK 6. 슬랙 다중 선택 UI



`notify-editor.mjs`를 Block Kit `checkboxes`로 재작성.



```

📋 8/26(수) 리포트 후보 4건



☐ 1. \[시장이슈] 반도체 외국인 순매수 전환    신뢰도 high

☐ 2. \[수급] 삼성전자 5일 누적 외인 +3,200억  z=2.8

☐ 3. \[공시] XX바이오 최대주주 변경           major\_holder

☐ 4. \[교육] 유상증자가 주가에 미치는 영향     로테이션



\[선택한 항목으로 초안 생성]  \[전체 스킵]

```



`app/api/slack`에서 `checkboxes`의 `selected\_options`를 받아

해당 id들을 일괄 `status='selected'` 갱신 후 워크플로우 디스패치.



\---



\## 완료 기준

\- \[ ] 승인 없이는 어떤 메일도 발송되지 않음을 코드로 확인

\- \[ ] 도메인 인증 후 Gmail/네이버 양쪽 받은편지함 수신 확인

\- \[ ] 금지 표현 검증이 실제로 차단하는지 테스트 케이스로 확인

\- \[ ] followup 섹션에 "틀림" verdict가 실제로 출력되는 것 확인

\- \[ ] 슬랙 다중 선택 → 즉시 생성 → 미리보기 → 승인 → 발송 전 과정 1회 완주



