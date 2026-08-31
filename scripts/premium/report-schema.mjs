// 프리미엄 리포트 출력 스키마 - 단일 출처(single source of truth).
//
// zod 로 정의하고 zod-to-json-schema 로 JSON Schema 를 파생시킨다.
//   - reportSchema      : 생성 결과 검증(generate-report.mjs 의 safeParse)
//   - reportJsonSchema  : Anthropic tool_use 의 input_schema 로 그대로 전달
// 프롬프트에는 JSON 예시를 넣지 않는다(STEP 4). 예시가 필요하면 .describe() 로만.
//
// 필드는 추측하지 않고 실제 소비처에서 전수 조사한 것만 넣었다:
//   web  = app/reports/[id]/page.js (ReportBody / LockedReportView)
//   mail = scripts/premium/lib/emailTemplate.mjs
//   fu   = scripts/premium/build-followup.mjs (stance -> verdict 자동 판정)
//   draft= scripts/premium/notify-draft-ready.mjs (분량/종목 카운트)
//   val  = scripts/premium/lib/validateReport.mjs (기존 후처리 검증)

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 한다");

// 자유 텍스트는 전부 .max() 상한을 둔다 - max_tokens 초과로 tool input 이
// 잘리는 걸 스키마 단계에서 억제한다.
const scenarioSchema = z
  .object({
    horizon: z.string().min(1).max(40).describe("기간 표기 (예: 1~4주, 1~6개월, 1년+)"),
    view: z.string().min(1).max(500).describe("이 기간의 관점 1~2문장"),
    watch: z
      .string()
      .min(1)
      .max(300)
      .describe("해당 기간 시나리오 안에 위치하는 관찰 포인트(지표/이벤트). scenarios 객체 레벨이 아니라 short/mid/long 각 객체 안에 둔다"),
  })
  .strict()
  .describe("horizon, view, watch 를 반드시 이 객체 안에 둔다");

const relatedStockSchema = z
  .object({
    code: z.string().min(1).max(12).describe("종목코드. 보조 컨텍스트에 실제로 있는 코드만"),
    name: z.string().min(1).max(60),
    grade: z.string().min(1).max(20).describe("현재 통합등급. 컨텍스트 값 그대로. 없으면 '데이터 없음'"),
    grade_4w_ago: z
      .string()
      .max(20)
      .nullable()
      .describe(
        "4주 전 등급. null 이면 4주 전 등급을 알 수 없다는 뜻이다. 등급이 유지됐다거나 변화가 없었다고 서술하지 마라. 비교 자체가 불가하다고 쓰거나 언급을 생략해라. 컨텍스트에 값이 없으면 null (지어내지 말 것)"
      ),
    sector_percentile: z
      .string()
      .max(40)
      .nullable()
      .optional()
      .describe("섹터 내 상대 위치. 컨텍스트에 없으면 null"),
    one_liner: z.string().min(1).max(200).describe("이 종목이 왜 이 섹션과 관련 있는지 한 줄"),
    stance: z
      .enum(["bullish", "bearish", "neutral"])
      .describe(
        "이 섹션이 이 종목에 취하는 방향성. 7일 뒤 build-followup.mjs 가 실제 주가와 대조해 맞음/틀림을 자동 판정하는 데 쓴다. 회피성으로 전부 neutral 로 두지 말 것"
      ),
  })
  .strict();

const sourceSchema = z
  .object({
    type: z.enum(["공시", "뉴스", "데이터"]).describe("근거 종류"),
    url: z.string().min(1).max(500).describe("근거 URL"),
    date: YMD,
  })
  .strict();

const sectionSchema = z
  .object({
    title: z.string().min(1).max(120).describe("이 섹션(주제 후보)의 제목"),
    what_happened: z.string().min(1).max(1200).describe("사실만. 무슨 일이 있었는지 2~4문장"),
    why_it_matters: z.string().min(1).max(900).describe("해석. 왜 중요한지 1~3문장"),
    scenarios: z
      .object({ short: scenarioSchema, mid: scenarioSchema, long: scenarioSchema })
      .strict()
      .describe(
        "short/mid/long 세 개 키만 가진다(3개 모두 필수). watch/horizon/view 를 이 레벨에 두지 마라 - 각 시나리오 객체 안에 넣는다"
      ),
    invalidation: z
      .string()
      .min(20)
      .max(400)
      .describe(
        "이 관점이 틀렸다고 봐야 하는 검증 가능한 조건. (X) '시장이 나빠지면' (O) '3분기 영업이익이 전년 동기 대비 감소로 전환하면'"
      ),
    related_stocks: z.array(relatedStockSchema).min(0).max(8),
    sources: z.array(sourceSchema).min(1).max(6).describe("모든 사실 주장의 근거. 최소 1개"),
  })
  .strict();

const followupSchema = z
  .object({
    from_issue: YMD.describe("지난 리포트 발행일"),
    topic: z.string().min(1).max(200).describe("그때 다룬 주제"),
    what_changed: z.string().min(1).max(600).describe("그 사이 무엇이 바뀌었는지"),
    verdict: z.enum(["맞음", "틀림", "진행중"]).describe("틀림도 순화하지 말고 그대로"),
  })
  .strict();

const calendarSchema = z
  .object({
    date: YMD,
    event: z.string().min(1).max(150),
    why: z.string().min(1).max(300).describe("왜 봐야 하는지"),
  })
  .strict();

export const reportSchema = z
  .object({
    cover: z
      .object({
        headline: z.string().min(1).max(120).describe("리포트 전체를 대표하는 한 줄 제목"),
        market_temp: z.string().max(200).describe("오늘 시장 분위기 한 문장"),
        reading_time_min: z.number().int().min(1).max(60).describe("예상 읽는 시간(분)"),
      })
      .strict(),
    // sections 는 승인된 주제 후보 수만큼. 렌더러가 깨지지 않게 1~6 으로 고정.
    sections: z.array(sectionSchema).min(1).max(6),
    // followup 은 생성 후 build-followup.mjs 의 객관 판정값으로 덮어쓰지만,
    // tool 스키마 형태 안정을 위해 필수 배열로 둔다(0건 허용).
    followup: z.array(followupSchema).min(0).max(8),
    next_week_calendar: z.array(calendarSchema).min(0).max(12),
    disclaimer: z.string().min(1).max(500).describe("투자 참고용 고지 문구"),
  })
  .strict();

// Anthropic input_schema 로 넘길 JSON Schema. $ref 를 인라인하고($refStrategy:none)
// $schema 키는 제거한다(도구 스키마에 불필요).
const rawJsonSchema = zodToJsonSchema(reportSchema, {
  $refStrategy: "none",
  target: "jsonSchema7",
});
delete rawJsonSchema.$schema;

export const reportJsonSchema = rawJsonSchema;
