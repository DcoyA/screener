# 후보 상세 / 섹션 제외 운영 노트 (STEP 10)

마이그레이션: `docs/migrations/20260827-candidate-detail-and-excluded-sections.sql`

## `market_issues.sources` — 기존 행은 NULL

`market_issues.sources` 는 **2026-08-27 배포 이후 스캔한 행부터** 채워진다.
그 이전 행은 `NULL` 이며 **의도된 상태**다.

제목 재검색으로 URL 을 붙이는 백필은 **배제**했다:
- 재검색으로 찾은 링크가 그 행을 실제로 만든 원본이라는 보장이 없다.
- 이 링크는 유료 리포트 출처로 구독자에게 노출되므로, 틀린 출처는 링크 없음보다 나쁘다.
- `market_issues` 는 최신성 기반이라 기존 행은 수 주 내 후보 풀에서 자연 이탈한다.
  백필 가치는 곧 0이 되는데 부정확성은 DB 에 영구히 남는다.

UI 문구 3-state (`notify-editor.mjs`):
| `sources` 값 | 문구 |
|---|---|
| `[{...}]` (1개 이상) | `출처 링크 N개` |
| `[]` (신규 스캔인데 자동 귀속 실패) | `출처 링크 없음 (자동 귀속 실패)` |
| `NULL` (컬럼 도입 이전 행) | `출처 링크 없음 (수집 이전 데이터)` |

구분 기준: `market_issues.sources IS NULL` 이면 "수집 이전", `= '[]'::jsonb` 이면 "귀속 실패".
별도 플래그/타임스탬프 상수를 만들지 않는다 - jsonb NULL/`[]` 자체가 구분자다.

## `reports.excluded_sections`

승인 시 슬랙 "빼고 발송할 섹션" 체크박스에서 고른 **원본 `content_json.sections`
배열의 0-based 인덱스** 목록. `content_json` 은 절대 수정하지 않는다.
`send-report-email.mjs` / `app/reports/[id]` / `emailTemplate.mjs` 가 렌더 시 필터한다.

가드:
- 전 섹션 제외 → 승인 거부 (status 유지)
- 남은 섹션 1개 → 슬랙에서 재확인 버튼 한 번 더
