import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { kstTodayStr } from "./lib/date.mjs";
import { FORBIDDEN_PHRASES, MAX_ABS_UPSIDE_PERCENT } from "./lib/reportSchema.mjs";
import { reportJsonSchema, reportSchema } from "./report-schema.mjs";
import { buildContextSummary } from "./lib/buildContextSummary.mjs";
import { validateReport } from "./lib/validateReport.mjs";
import { buildFollowup } from "./build-followup.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GRADE_LOOKBACK_DAYS = 28;

// 요청에 쓰는 실제 max_tokens (진단 로그가 이 변수를 참조한다).
const REPORT_MAX_TOKENS = 16000;

// 진단/테스트용. LLM 호출 + zod 검증까지만 하고 DB 쓰기·슬랙을 전부 건너뛴다.
const DRY_RUN = process.argv.includes("--dry-run");

function daysAgoStr(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function safeFetchContext(label, queryFn) {
  try {
    const { data, error } = await queryFn();
    if (error) {
      console.warn(`[리포트 컨텍스트] ${label} 조회 실패(무시하고 진행): ${error.message}`);
      return [];
    }
    console.log(`[리포트 컨텍스트] ${label} ${data.length}건 확보`);
    return data || [];
  } catch (e) {
    console.warn(`[리포트 컨텍스트] ${label} 조회 중 예외 발생(무시하고 진행): ${e.message}`);
    return [];
  }
}

// related_stocks[]에 채울 등급/섹터 정보. LLM이 지어내지 않도록 실제 조회한
// 값만 넘긴다 - 4주 전 등급은 파이프라인 누적 기간이 짧으면(현재 약
// 10일치) 없을 수 있고, 그 경우 null로 넘겨 LLM이 "데이터 미축적"이라고
// 정직하게 쓰게 한다(지어내지 않게).
async function fetchRelatedStockDetails(relatedCodes) {
  if (relatedCodes.length === 0) return [];

  const current = await safeFetchContext("latest_stock_snapshots(관련종목)", () =>
    supabase.from("latest_stock_snapshots").select("code, unified_grade_code, raw_data").in("code", relatedCodes)
  );
  if (current.length === 0) return [];

  const cutoff = daysAgoStr(GRADE_LOOKBACK_DAYS);
  const past = await safeFetchContext("stock_daily_snapshots(4주 전 등급)", () =>
    supabase
      .from("stock_daily_snapshots")
      .select("code, unified_grade_code, snapshot_date")
      .in("code", relatedCodes)
      .lte("snapshot_date", cutoff)
      .order("snapshot_date", { ascending: false })
  );

  const pastGradeByCode = new Map();
  for (const row of past) {
    if (!pastGradeByCode.has(row.code)) pastGradeByCode.set(row.code, row.unified_grade_code);
  }

  return current.map((row) => ({
    code: row.code,
    name: row.raw_data?.name || row.code,
    grade: row.unified_grade_code,
    grade_4w_ago: pastGradeByCode.get(row.code) || null,
    sector_strength_score: row.raw_data?.sectorMeta?.strengthScore ?? null,
    sector_leader: row.raw_data?.sectorMeta?.leaderFlag || false,
  }));
}

async function fetchAdditionalContext(relatedCodes, relatedSectors, followup) {
  const marketIssues = relatedSectors.length
    ? await safeFetchContext("market_issues", () =>
        supabase.from("market_issues").select("*").overlaps("impacted_sectors", relatedSectors)
      )
    : [];

  const disclosureEvents = relatedCodes.length
    ? await safeFetchContext("disclosure_events", () =>
        supabase.from("disclosure_events").select("*").in("code", relatedCodes)
      )
    : [];

  const flowSignals = relatedCodes.length
    ? await safeFetchContext("flow_signals", () =>
        supabase.from("flow_signals").select("*").in("code", relatedCodes)
      )
    : [];

  const economicCalendar = await safeFetchContext("economic_calendar", () =>
    supabase.from("economic_calendar").select("*").eq("importance", "high")
  );

  const relatedStockDetails = await fetchRelatedStockDetails(relatedCodes);

  return {
    market_issues: marketIssues,
    disclosure_events: disclosureEvents,
    flow_signals: flowSignals,
    economic_calendar: economicCalendar,
    related_stock_details: relatedStockDetails,
    followup: followup || [],
  };
}

function buildPrompt(candidates, context, retryFeedback) {
  const candidatesText = candidates
    .map((c, i) => {
      const lines = [`${i + 1}. [${c.title}]`];
      if (c.summary) lines.push(`요약: ${c.summary}`);
      lines.push(c.rationale);
      lines.push(`관련 종목: ${(c.related_codes || []).join(", ") || "-"}`);
      lines.push(`관련 섹터: ${(c.related_sectors || []).join(", ") || "-"}`);
      // 출처 URL은 프롬프트에 넣지 않는다 - LLM이 sections[].sources를 자체 생성하고,
      // 여기서 URL을 주면 그대로 복사하거나 그럴듯한 변형을 만들어낸다.
      return lines.join("\n");
    })
    .join("\n\n");

  const contextSummary = buildContextSummary(context);

  const retryBlock = retryFeedback
    ? `\n\n[이전 시도 실패 사유 - 반드시 고쳐서 다시 출력할 것]\n${retryFeedback.map((e) => `- ${e}`).join("\n")}\n`
    : "";

  return `너는 국내 주식시장 프리미엄 리포트 에디터의 초안 작성을 돕는 어시스턴트다.

아래는 오늘 에디터가 승인(selected)한 리포트 주제 후보 목록이다:

${candidatesText}

아래는 관련 종목/섹터로 추가 조회한 보조 컨텍스트 데이터(마크다운 요약, 비어 있을 수도 있음)다:

${contextSummary}

위 내용을 종합해 오늘자 프리미엄 리포트 초안을 emit_report 도구로 제출하라.
도구의 input_schema 가 정확한 형식(키 이름·중첩·배열 길이·필드 길이)을 강제하므로
여기서 형식을 다시 설명하지 않는다. sections 는 위에 나열된 승인 후보 하나당 하나씩 만들어라.

[표현 금지 — 위반 시 출력 전체 무효]
${FORBIDDEN_PHRASES.map((p) => `- "${p}"`).join("\n")}
- 매수/매도 타이밍을 지시하는 모든 문구
- 목표주가를 단일 숫자로 단정하는 표현

[필수 규칙]
- 모든 사실 주장에는 sources 배열에 근거 URL과 날짜를 넣는다
- 컨텍스트 데이터에 없는 사실은 절대 생성하지 않는다 (related_stocks 의 grade/grade_4w_ago/
  sector_percentile 은 위 컨텍스트 "관련 종목 상세" 값만 그대로 옮겨 적고, 없으면 null 로 둔다 - 지어내지 마라)
- 상승여력을 언급할 때 ±${MAX_ABS_UPSIDE_PERCENT}%를 넘는 수치는 숫자로 쓰지 않는다
- followup 컨텍스트가 있으면 반드시 followup 필드에 반영하고, verdict 가 "틀림"이어도
  숨기거나 완곡하게 쓰지 마라 - 틀린 것도 그대로 싣는다${retryBlock}`;
}

// 구조화 출력: tool_use 로 받는다. SDK 가 아니라 raw fetch 지만 요청 바디 키는 동일.
// - tool_choice 강제 지정을 쓰므로 이 호출에 한해 thinking 을 끈다(강제 tool_choice
//   와 extended thinking 은 API 레벨에서 비호환 - 400).
// - block.input 이 곧 결과 객체다. JSON.parse 는 어디에도 없다.
async function callAnthropic(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: REPORT_MAX_TOKENS,
      thinking: { type: "disabled" },
      tools: [
        {
          name: "emit_report",
          description: "생성한 프리미엄 리포트를 구조화된 형태로 제출한다",
          input_schema: reportJsonSchema,
        },
      ],
      tool_choice: { type: "tool", name: "emit_report" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Anthropic API 호출 실패: ${res.status} - ${errText}`);
    err.httpStatus = res.status;
    err.fatal = res.status === 400 || res.status === 401; // 그 외(429/5xx)는 retryable
    throw err;
  }

  const data = await res.json();

  const toolBlock = (data.content || []).find(
    (b) => b.type === "tool_use" && b.name === "emit_report"
  );

  // [진단] 성공/실패 무관 무조건. 절단 여부 판단의 핵심은 성공 시 output_tokens.
  {
    const inp = toolBlock?.input;
    const sections = Array.isArray(inp?.sections) ? inp.sections : null;
    console.log("[진단] stop_reason:", data.stop_reason);
    console.log("[진단] output_tokens:", data.usage?.output_tokens, "/ input_tokens:", data.usage?.input_tokens);
    console.log("[진단] max_tokens 설정값:", REPORT_MAX_TOKENS);
    console.log("[진단] tool_use 블록 존재:", !!toolBlock);
    console.log("[진단] JSON.stringify(block.input).length:", inp ? JSON.stringify(inp).length : null);
    console.log("[진단] block.input 최상위 키:", inp ? Object.keys(inp) : null);
    console.log(
      "[진단] sections 길이:",
      sections ? sections.length : "(배열 아님)",
      "| 각 section 키 개수:",
      sections ? sections.map((s) => (s && typeof s === "object" ? Object.keys(s).length : null)) : null
    );
  }

  // max_tokens 로 잘리면 tool input 이 불완전할 수 있다. 조용히 넘어가지 말 것.
  if (data.stop_reason === "max_tokens") {
    const outTok = data.usage?.output_tokens;
    console.error(`[생성] stop_reason=max_tokens (output_tokens=${outTok}) - tool input 이 잘렸습니다`);
    throw new Error(
      `응답이 max_tokens 로 잘렸습니다 (output_tokens=${outTok}, max_tokens=${REPORT_MAX_TOKENS}). max_tokens 를 늘리거나 섹션 수를 줄여야 합니다`
    );
  }
  if (!toolBlock) {
    const textBlocks = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    console.error(
      `[생성] tool_use(emit_report) 블록 없음. stop_reason=${data.stop_reason}` +
        (data.stop_details ? ` stop_details=${JSON.stringify(data.stop_details)}` : "") +
        (textBlocks ? `\n[text 블록 내용]\n${textBlocks}` : "")
    );
    const err = new Error(`tool_use(emit_report) 블록이 응답에 없습니다 (stop_reason=${data.stop_reason})`);
    err.fatal = true; // tool_use 블록 부재 = fatal (재시도해도 구조가 안 잡힘)
    throw err;
  }

  return { report: toolBlock.input, apiResponse: data };
}

// zod 이슈를 사람이 읽는 한 줄씩으로. path 는 필드 경로, message 는 zod 원문.
function formatZodIssues(zodError) {
  return zodError.issues.map((iss) => {
    const path = iss.path.length ? iss.path.join(".") : "(최상위)";
    return `${path}: ${iss.message}`;
  });
}

// 검증 실패 시 raw 응답 전문을 파일로. 워크플로가 actions/upload-artifact 로 올린다.
function saveRawResponse(attempt, apiResponse) {
  const file = `scripts/premium/raw-response-attempt${attempt}.json`;
  try {
    writeFileSync(file, JSON.stringify(apiResponse, null, 2));
    console.warn(`[생성] raw 응답을 ${file} 에 저장했습니다`);
  } catch (e) {
    console.error(`[생성] raw 응답 저장 실패(${file}): ${e.message}`);
  }
}

// LLM 생성 -> ① zod 스키마 검증(구조) -> ② validateReport(표현 규칙).
// 검증 실패는 retryable: 실패 사유를 다음 시도 프롬프트에 그대로 넣어 재생성.
// tool_use 블록 부재 / 400 / 401 은 fatal(재시도 안 함).
// STEP 6 에서 MAX_ATTEMPTS 를 config.mjs 상수로 분리한다.
const MAX_ATTEMPTS = 3;

async function generateReportContent(candidates, context) {
  let retryFeedback = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = buildPrompt(candidates, context, retryFeedback);

    let report;
    let apiResponse;
    try {
      ({ report, apiResponse } = await callAnthropic(prompt));
    } catch (e) {
      console.error(`[생성] 시도 ${attempt}/${MAX_ATTEMPTS} 호출 실패: ${e.message}`);
      if (e.fatal) return { ok: false, fatal: true, errors: [e.message] };
      if (attempt === MAX_ATTEMPTS) return { ok: false, errors: [e.message] };
      retryFeedback = [e.message];
      continue;
    }

    // ① 구조 검증(zod safeParse). JSON.parse 는 없다 - tool input 객체를 그대로 검사.
    const schemaResult = reportSchema.safeParse(report);
    if (!schemaResult.success) {
      const zodErrs = formatZodIssues(schemaResult.error);
      saveRawResponse(attempt, apiResponse);
      console.warn(
        `[생성] 시도 ${attempt}/${MAX_ATTEMPTS} 스키마 검증 실패:\n${zodErrs.map((e) => `  - ${e}`).join("\n")}`
      );
      if (attempt === MAX_ATTEMPTS) return { ok: false, errors: zodErrs };
      retryFeedback = ["이전 시도에서 다음 필드가 규격을 벗어났다:", ...zodErrs];
      continue;
    }
    const validated = schemaResult.data;

    // ② 표현 규칙 검증(zod 로 못 잡는 것: 금지표현, 상승여력 %, 종목코드 실존)
    const { ok, errors } = await validateReport(validated, { supabase });
    if (ok) {
      console.log(`[생성] 시도 ${attempt}/${MAX_ATTEMPTS} 에서 검증 통과`);
      return { ok: true, report: validated };
    }

    saveRawResponse(attempt, apiResponse);
    console.warn(
      `[생성] 시도 ${attempt}/${MAX_ATTEMPTS} 표현 규칙 검증 실패:\n${errors.map((e) => `  - ${e}`).join("\n")}`
    );
    if (attempt === MAX_ATTEMPTS) return { ok: false, errors };
    retryFeedback = ["이전 시도에서 다음 규칙을 위반했다:", ...errors];
  }

  return { ok: false, errors: ["알 수 없는 오류"] };
}

async function notifyGenerationFailure(errors, { fatal = false } = {}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const head = fatal ? "🔴 [프리미엄 리포트] 생성 실패(치명적 - 재시도 안 함)" : "🔴 [프리미엄 리포트] 생성 실패";
  const text = `${head}, 사유:\n${errors.map((e) => `- ${e}`).join("\n")}\n(발송되지 않았습니다)`;

  if (!webhookUrl) {
    console.log("[생성] SLACK_WEBHOOK_URL 없음 - 콘솔에만 출력\n" + text);
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error(`슬랙 전송 실패: ${res.status} - ${await res.text()}`);
  }
}

async function main() {
  const today = kstTodayStr();

  const { data: candidates, error: candidatesError } = await supabase
    .from("topic_candidates")
    .select("*")
    .eq("target_issue_date", today)
    .eq("status", "selected")
    .order("candidate_no", { ascending: true });

  if (candidatesError) {
    console.error("topic_candidates 조회 실패:", candidatesError);
    process.exit(1);
  }

  if (candidates.length === 0) {
    console.log("[생성] 오늘 승인된(selected) 후보가 없어 리포트 생성을 스킵합니다");
    return;
  }

  const { data: existingReports, error: existingReportsError } = await supabase
    .from("reports")
    .select("id")
    .eq("issue_date", today);

  if (existingReportsError) {
    console.error("reports 기존 행 조회 실패:", existingReportsError);
    process.exit(1);
  }

  if (existingReports.length > 0) {
    if (DRY_RUN) {
      console.log("[dry-run] 오늘 issue_date 리포트가 이미 존재 - 중복 방지 가드 우회 (진단 목적)");
    } else {
      console.log("[생성] 오늘 issue_date의 리포트가 이미 존재하여 스킵합니다");
      return;
    }
  }

  const relatedCodes = [...new Set(candidates.flatMap((c) => c.related_codes || []))];
  const relatedSectors = [...new Set(candidates.flatMap((c) => c.related_sectors || []))];
  const followup = await buildFollowup();
  const context = await fetchAdditionalContext(relatedCodes, relatedSectors, followup);

  const result = await generateReportContent(candidates, context);

  if (!result.ok) {
    if (DRY_RUN) {
      console.log("[dry-run] 슬랙 실패알림 스킵");
      console.error("[dry-run] 검증 실패:\n" + result.errors.map((e) => `  - ${e}`).join("\n"));
    } else {
      await notifyGenerationFailure(result.errors, { fatal: !!result.fatal });
      console.error("[생성] 검증을 통과한 리포트를 만들지 못해 종료합니다(발송 안 함)");
    }
    process.exit(1);
  }

  const generated = result.report;
  // followup은 build-followup.mjs가 실제 시세/등급 비교로 이미 객관적으로
  // 판정한 값이다. LLM이 프롬프트 지시를 따르지 않고 "틀림"을 순화해서
  // 다시 쓸 가능성을 원천 차단하기 위해, LLM이 생성한 followup을 신뢰하지
  // 않고 계산된 값으로 강제 덮어쓴다.
  generated.followup = followup;

  const row = {
    issue_date: today,
    day_type: candidates[0].day_type,
    topic_title: generated.cover?.headline || "(제목 없음)",
    content_json: generated,
    // emailTemplate.mjs가 content_json으로부터 발송 시점에 렌더링한다
    // (admin 미리보기도 같은 함수를 써서 실제 발송본과 100% 동일하게 봄).
    html_body: null,
    status: "draft",
    pdf_url: null,
  };

  if (DRY_RUN) {
    console.log(`[dry-run] reports insert 스킵 (topic_title="${row.topic_title}", sections=${(generated.sections || []).length}개)`);
    console.log("[dry-run] 생성+검증 통과. DB 미기록, 슬랙/메일 미발송.");
    return;
  }

  const { error: insertError } = await supabase.from("reports").insert(row);
  if (insertError) {
    console.error("reports 저장 실패 (원문):");
    console.error(`code: ${insertError.code}`);
    console.error(`message: ${insertError.message}`);
    console.error(`details: ${insertError.details}`);
    console.error(`hint: ${insertError.hint}`);
    process.exit(1);
  }

  console.log(`[생성] 리포트 1건 생성 완료 (issue_date=${today}, status=draft)`);
}

main();
