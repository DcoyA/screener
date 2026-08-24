import { createClient } from "@supabase/supabase-js";
import { kstTodayStr } from "./lib/date.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function fetchAdditionalContext(relatedCodes, relatedSectors) {
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

  return { market_issues: marketIssues, disclosure_events: disclosureEvents, flow_signals: flowSignals, economic_calendar: economicCalendar };
}

function buildPrompt(candidates, context) {
  const candidatesText = candidates
    .map(
      (c, i) =>
        `${i + 1}. [${c.title}]\n${c.rationale}\n관련 종목: ${(c.related_codes || []).join(", ") || "-"}\n관련 섹터: ${(c.related_sectors || []).join(", ") || "-"}`
    )
    .join("\n\n");

  const contextText = JSON.stringify(context).slice(0, 6000);

  return `너는 국내 주식시장 프리미엄 리포트 에디터의 초안 작성을 돕는 어시스턴트다.

아래는 오늘 에디터가 승인(selected)한 리포트 주제 후보 목록이다:

${candidatesText}

아래는 관련 종목/섹터로 추가 조회한 보조 컨텍스트 데이터(JSON, 비어 있을 수도 있음)다:
${contextText}

위 내용을 종합해 오늘자 프리미엄 리포트 초안을 아래 JSON 스키마로만 출력하라 (다른 설명 문장 절대 넣지 말 것, 반드시 하나의 JSON 객체로만 출력):

{
  "topic_title": "오늘 리포트 전체를 대표하는 한 줄 제목",
  "sections": [
    {
      "title": "이 섹션(후보)의 제목",
      "summary": "핵심 요약 2~4문장",
      "related_codes": ["종목코드", "..."],
      "related_sectors": ["섹터명", "..."],
      "implication": "시사점 1~2문장"
    }
  ],
  "html_body": "이메일 발송용 HTML 전체 문자열 (인라인 스타일 포함, <html>...</html> 형태)"
}

sections는 위 후보 개수만큼 만들어라. 후보 목록과 컨텍스트 데이터에 없는 사실을 새로 지어내지 마라.`;
}

async function generateReportContent(candidates, context) {
  const prompt = buildPrompt(candidates, context);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Anthropic API 호출 실패: ${res.status} - ${errText}`);
    process.exit(1);
  }

  const data = await res.json();
  const textBlock = (data?.content || []).find((block) => block.type === "text");

  if (!textBlock) {
    console.error("응답 content 배열에 type='text' 블록이 없습니다. 원문:", JSON.stringify(data));
    process.exit(1);
  }

  const text = textBlock.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("LLM 응답에서 JSON 객체를 찾지 못했습니다. 원문:", text);
    process.exit(1);
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON 파싱 실패:", e.message);
    console.error("파싱 시도했던 원문:", jsonMatch[0]);
    process.exit(1);
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
  const context = await fetchAdditionalContext(relatedCodes, relatedSectors);

  const generated = await generateReportContent(candidates, context);

  const row = {
    issue_date: today,
    day_type: candidates[0].day_type,
    topic_title: generated.topic_title,
    content_json: { topic_title: generated.topic_title, sections: generated.sections || [] },
    html_body: generated.html_body,
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
