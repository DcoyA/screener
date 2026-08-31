# 프리미엄 리포트 출력 크기 vs `max_tokens`

`scripts/premium/generate-report.mjs` 는 `emit_report` tool_use 로 리포트를 받고
`REPORT_MAX_TOKENS = 16000` 을 쓴다. 스키마(`scripts/premium/report-schema.mjs`)의
`.max()` 상한을 전부 합산해 최악 출력 크기가 16000 안에 들어오는지 점검한 기록.

## 스키마 `.max()` 상한 합산

| 위치 | 상한 |
|---|---|
| `sections` 배열 | 최대 **6개** |
| section 당: title 120 / what_happened 1200 / why_it_matters 900 / invalidation 400 | 2,620자 |
| section 당 scenarios: (horizon 40 + view 500 + watch 300) × 3 | 2,520자 |
| section 당 related_stocks: 최대 8개 × (code 12 + name 60 + grade 20 + grade_4w_ago 20 + sector_percentile 40 + one_liner 200 + stance 8) | 2,880자 |
| section 당 sources: 최대 6개 × (type 4 + url 500 + date 10) | 3,084자 |
| followup: 최대 8개 × (from_issue 10 + topic 200 + what_changed 600 + verdict 3) | 6,504자 |
| next_week_calendar: 최대 12개 × (date 10 + event 150 + why 300) | 5,520자 |
| cover 350 + disclaimer 500 + JSON 구조 오버헤드 | ~ |

- section 1개 최악(값 + JSON 키/구두점 오버헤드): **~15,000~20,000자**
- 6 section: **~100,000~130,000자**
- 전체 최악: **~120,000~145,000자 ≈ 추정 40,000~50,000 토큰** (한국어 JSON ~2.8~3.2자/토큰)

## 판단: 16000 은 실운영에 안전. 이론상 절대 최악만 초과.

- **관측치**: 4 section 리포트 = 출력 **~5,000 토큰** (~1,250 토큰/section). CI dry-run 시도 2.
- 6 section 외삽: ~7,500 토큰 → **16000 대비 2배 여유**.
- 현실적 최악(6 section, 장문이지만 상한 미달, 종목 4개·근거 3개): **~10,000~12,000 토큰** → 여전히 16000 미만.
- 이론상 절대 최악(~40K~50K 토큰)은 **6개 전 section 의 모든 자유 텍스트를 상한까지 채우고 종목 8·근거 6을 다 채운 경우** — 프롬프트의 "2~4문장" 지시와 배치되어 실제로는 도달 불가.
- `.max()` 값은 목표치가 아니라 **개별 필드 폭주 방지용 천장**이다.

## 언제 다시 볼 것

`stop_reason === "max_tokens"` 가드(generate-report.mjs)가 잘림을 잡아 재시도한다.
CI dry-run `[진단]` 로그에서 `output_tokens` 가 16000 에 근접하거나 `stop_reason=max_tokens`
가 반복되면, 그때 `REPORT_MAX_TOKENS` 증액 또는 section 분할 호출을 검토한다.
지금은 건드리지 않는다.
