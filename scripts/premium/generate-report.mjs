import { createClient } from "@supabase/supabase-js";
import { kstTodayStr } from "./lib/date.mjs";
import { FORBIDDEN_PHRASES, MAX_ABS_UPSIDE_PERCENT, REPORT_JSON_EXAMPLE } from "./lib/reportSchema.mjs";
import { reportJsonSchema } from "./report-schema.mjs";
import { buildContextSummary } from "./lib/buildContextSummary.mjs";
import { validateReport } from "./lib/validateReport.mjs";
import { buildFollowup } from "./build-followup.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GRADE_LOOKBACK_DAYS = 28;

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

위 내용을 종합해 오늘자 프리미엄 리포트 초안을 아래와 정확히 같은 키/중첩 구조의 JSON 하나로만 출력하라 (다른 설명 문장 절대 넣지 말 것):

${JSON.stringify(REPORT_JSON_EXAMPLE, null, 2)}

sections는 위 후보 개수만큼 만들어라.

[표현 금지 — 위반 시 출력 전체 무효]
${FORBIDDEN_PHRASES.map((p) => `- "${p}"`).join("\n")}
- 매수/매도 타이밍을 지시하는 모든 문구
- 목표주가를 단일 숫자로 단정하는 표현

[필수 규칙]
- 모든 사실 주장에는 sources 배열에 근거 URL과 날짜를 넣는다
- 컨텍스트 데이터에 없는 사실은 절대 생성하지 않는다 (related_stocks의 grade/grade_4w_ago/
  sector_percentile은 위 컨텍스트의 "관련 종목 상세" 값만 그대로 옮겨 적어라. 데이터가 없으면
  null로 두거나 "데이터 없음"이라고 써라 - 지어내지 마라)
- 상승여력을 언급할 때 ±${MAX_ABS_UPSIDE_PERCENT}%를 넘는 수치는 숫자로 쓰지 않는다
- invalidation은 검증 가능한 조건이어야 한다
  (X) "시장 상황이 나빠지면"
  (O) "3분기 영업이익이 전년 동기 대비 감소로 전환하면"
- followup 컨텍스트가 있으면 반드시 followup 필드에 반영하고, verdict가 "틀림"이어도
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
      max_tokens: 16000,
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
    // 400/401 은 STEP 5 에서 fatal 로 분류. 여기서는 상태코드를 그대로 실어 던진다.
    const err = new Error(`Anthropic API 호출 실패: ${res.status} - ${errText}`);
    err.httpStatus = res.status;
    throw err;
  }

  const data = await res.json();

  // 1) max_tokens 로 잘리면 tool input 이 불완전할 수 있다. 조용히 넘어가지 말 것.
  if (data.stop_reason === "max_tokens") {
    const outTok = data.usage?.output_tokens;
    console.error(`[생성] stop_reason=max_tokens (output_tokens=${outTok}) - tool input 이 잘렸습니다`);
    throw new Error(`응답이 max_tokens 로 잘렸습니다 (output_tokens=${outTok}, max_tokens=16000). max_tokens 를 늘리거나 섹션 수를 줄여야 합니다`);
  }

  const toolBlock = (data.content || []).find(
    (b) => b.type === "tool_use" && b.name === "emit_report"
  );
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
    throw new Error(`tool_use(emit_report) 블록이 응답에 없습니다 (stop_reason=${data.stop_reason})`);
  }

  return toolBlock.input;
}

// LLM 생성 -> 후처리 검증. 실패하면 실패 사유를 프롬프트에 붙여 1회만 재생성.
// 그래도 실패하면 null을 반환한다(호출 측이 슬랙 알림 후 종료).
async function generateReportContent(candidates, context) {
  let retryFeedback = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = buildPrompt(candidates, context, retryFeedback);
    let parsed;
    try {
      parsed = await callAnthropic(prompt);
    } catch (e) {
      console.error(`[생성] 시도 ${attempt}/2 실패(API/파싱 오류): ${e.message}`);
      if (attempt === 2) return { ok: false, errors: [e.message] };
      retryFeedback = [e.message];
      continue;
    }

    const { ok, errors } = await validateReport(parsed, { supabase });
    if (ok) {
      console.log(`[생성] 시도 ${attempt}/2에서 검증 통과`);
      return { ok: true, report: parsed };
    }

    console.warn(`[생성] 시도 ${attempt}/2 검증 실패:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    if (attempt === 2) return { ok: false, errors };
    retryFeedback = errors;
  }

  return { ok: false, errors: ["알 수 없는 오류"] };
}

async function notifyGenerationFailure(errors) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const text = `🔴 [프리미엄 리포트] 생성 실패, 사유:\n${errors.map((e) => `- ${e}`).join("\n")}\n(발송되지 않았습니다)`;

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
    console.log("[생성] 오늘 issue_date의 리포트가 이미 존재하여 스킵합니다");
    return;
  }

  const relatedCodes = [...new Set(candidates.flatMap((c) => c.related_codes || []))];
  const relatedSectors = [...new Set(candidates.flatMap((c) => c.related_sectors || []))];
  const followup = await buildFollowup();
  const context = await fetchAdditionalContext(relatedCodes, relatedSectors, followup);

  const result = await generateReportContent(candidates, context);

  if (!result.ok) {
    await notifyGenerationFailure(result.errors);
    console.error("[생성] 검증을 통과한 리포트를 만들지 못해 종료합니다(발송 안 함)");
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
