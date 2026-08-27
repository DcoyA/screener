import { createClient } from "@supabase/supabase-js";
import { kstTodayStr, kstWeekday, KST_WEEKDAY_NAME } from "./lib/date.mjs";
import { cleanStockName } from "../../app/lib/stockName.js";

// 슬랙 Block Kit 제약
const MAX_CHECKBOX_OPTIONS = 10; // 체크박스 그룹당 옵션
const MAX_OPTION_LABEL = 72; // plain_text 옵션 라벨(75자 한도, 여유)
const SECTION_TEXT_LIMIT = 2900; // section text(3000자 한도, 여유)
const BLOCK_COUNT_WARN = 45; // 메시지 블록 50개 한도 접근 경고

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SOURCE_TAG = {
  market_issues: "[시장이슈]",
  flow_signals: "[수급]",
  disclosure_events: "[공시]",
  economic_calendar: "[일정]",
  evergreen_topics: "[상식]",
  literacy_topics: "[교육]",
};

function buildBadge(candidate) {
  const meta = candidate.meta || {};
  switch (candidate.source) {
    case "market_issues":
      return `신뢰도 ${meta.confidence || "-"}`;
    case "flow_signals":
      return Number.isFinite(meta.zscore) ? `z=${meta.zscore.toFixed(1)}` : "z=-";
    case "disclosure_events":
      return meta.disclosureType || "-";
    case "economic_calendar":
      return Number.isFinite(meta.daysUntil) ? `D-${meta.daysUntil}` : "-";
    case "evergreen_topics":
    case "literacy_topics":
      return "로테이션";
    default:
      return "";
  }
}

async function fetchTodayProposedCandidates() {
  const today = kstTodayStr();
  const { data, error } = await supabase
    .from("topic_candidates")
    .select("*")
    .eq("target_issue_date", today)
    .eq("status", "proposed")
    .order("candidate_no", { ascending: true });

  if (error) {
    console.error("topic_candidates 조회 실패:", error);
    process.exit(1);
  }
  return data;
}

// related_codes -> 정제된 종목명 Map. latest_stock_snapshots 에 code 컬럼이 있다.
async function fetchStockNames(codes) {
  const uniq = [...new Set(codes.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase
    .from("latest_stock_snapshots")
    .select("code, raw_data")
    .in("code", uniq);
  if (error) {
    console.error("종목명 조회 실패(무시하고 코드만 표시):", error);
    return new Map();
  }
  const map = new Map();
  for (const row of data || []) {
    const name = row?.raw_data?.name;
    if (name) map.set(String(row.code), cleanStockName(name));
  }
  return map;
}

function truncate(s, n) {
  const str = String(s || "");
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

// sources 3-state (docs/ops/candidate-detail-notes.md).
// NULL = 이 컬럼 도입 이전 후보(사실상 없음) / [] = 자동 귀속 실패 / [{...}] = 성공
function sourceLinkLine(candidate) {
  const s = candidate.sources;
  if (s == null) return "출처 링크 없음 (수집 이전 데이터)";
  if (Array.isArray(s) && s.length > 0) return `출처 링크 ${s.length}개`;
  // disclosure/flow/calendar 는 원래 [] 가 정상이라 "실패"로 읽히면 안 된다.
  if (candidate.source === "market_issues") return "출처 링크 없음 (자동 귀속 실패)";
  return null; // 다른 소스는 링크 줄 자체를 생략
}

// 후보 하나 → section 블록 텍스트(mrkdwn). 값 없는 줄은 생략한다.
function buildCandidateSection(candidate, index, nameMap) {
  const tag = SOURCE_TAG[candidate.source] || "[기타]";
  const lines = [`*${index + 1}. ${tag}* ${candidate.title}`];

  const summary = candidate.summary || candidate.rationale;
  lines.push(summary ? truncate(summary, 800) : "_요약 없음 (수집 실패)_");

  const codes = (candidate.related_codes || []).slice(0, 3);
  const names = codes.map((c) => nameMap.get(String(c)) || c).filter(Boolean);
  if (names.length > 0) {
    lines.push(`관련 종목: ${names.join(", ")}`);
  } else {
    const sectors = (candidate.related_sectors || []).slice(0, 3);
    if (sectors.length > 0) lines.push(`관련 섹터: ${sectors.join(", ")}`);
  }

  const badge = buildBadge(candidate);
  if (badge) lines.push(`근거: ${badge}`);

  const srcLine = sourceLinkLine(candidate);
  if (srcLine) lines.push(srcLine);

  return {
    type: "section",
    text: { type: "mrkdwn", text: truncate(lines.join("\n"), SECTION_TEXT_LIMIT) },
  };
}

function buildSlackMessage(candidates, nameMap) {
  const allIds = candidates.map((c) => c.id).join(",");

  // 체크박스 그룹당 옵션 10개 제한. 초과분은 조용히 버리지 않고 로그로 남긴다.
  // (핸들러 handleCandidateSelection 이 allIds 로 "선택 안 된 나머지"를 rejected 처리하므로
  //  옵션에서 빠진 후보는 자동으로 rejected 된다 - 즉 노출 안 된 건 안 뽑힌 것과 같다.)
  let visible = candidates;
  if (candidates.length > MAX_CHECKBOX_OPTIONS) {
    visible = candidates.slice(0, MAX_CHECKBOX_OPTIONS);
    const dropped = candidates.slice(MAX_CHECKBOX_OPTIONS);
    console.warn(
      `[알림] 후보 ${candidates.length}건 중 상위 ${MAX_CHECKBOX_OPTIONS}건만 체크박스에 표시합니다. ` +
        `표시 안 된 ${dropped.length}건:`
    );
    for (const c of dropped) console.warn(`  - #${c.candidate_no} ${c.title} (id=${c.id})`);
  }

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📋 ${kstTodayStr()}(${KST_WEEKDAY_NAME[kstWeekday()]}) 리포트 후보 ${candidates.length}건`,
      },
    },
    { type: "divider" },
    // 후보별 상세 (선택 전에 내용을 보고 고를 수 있게)
    ...visible.map((c, i) => buildCandidateSection(c, i, nameMap)),
    { type: "divider" },
    { type: "context", elements: [{ type: "mrkdwn", text: "↑ 위 상세를 보고, 아래에서 초안에 넣을 후보를 고르세요." }] },
    {
      type: "actions",
      block_id: "candidate_checkboxes",
      elements: [
        {
          type: "checkboxes",
          action_id: "select_candidates",
          options: visible.map((c, i) => ({
            text: { type: "plain_text", text: truncate(`${i + 1}. ${c.title}`, MAX_OPTION_LABEL) },
            value: String(c.id),
          })),
        },
      ],
    },
    {
      type: "actions",
      block_id: "candidate_submit",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "선택한 항목으로 초안 생성" },
          style: "primary",
          action_id: "generate_selected_candidates",
          value: allIds,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "전체 스킵" },
          style: "danger",
          action_id: "skip_all_candidates",
          value: allIds,
        },
      ],
    },
  ];

  if (blocks.length > BLOCK_COUNT_WARN) {
    console.warn(`[알림] 슬랙 메시지 블록 ${blocks.length}개 - 50개 한도에 근접합니다`);
  }
  console.log(`[알림] 슬랙 메시지 블록 ${blocks.length}개`);

  return {
    text: `${kstTodayStr()}(${KST_WEEKDAY_NAME[kstWeekday()]}) 리포트 후보 ${candidates.length}건`,
    blocks,
  };
}

async function main() {
  const candidates = await fetchTodayProposedCandidates();
  console.log(`[알림] topic_candidates 조회 ${candidates.length}건`);

  const emptyNoticeText = `[알림] 오늘(${kstTodayStr()}, ${KST_WEEKDAY_NAME[kstWeekday()]}요일) 발행할 리포트 후보가 없습니다.`;
  let message;
  if (candidates.length === 0) {
    message = { text: emptyNoticeText };
  } else {
    const nameMap = await fetchStockNames(candidates.flatMap((c) => c.related_codes || []));
    message = buildSlackMessage(candidates, nameMap);
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("[알림] SLACK_WEBHOOK_URL 없음 - 로컬 테스트 모드로 콘솔 출력만 수행");
    console.log(JSON.stringify(message, null, 2));
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`슬랙 전송 실패: ${res.status} - ${errText}`);
    process.exit(1);
  }

  if (candidates.length === 0) {
    console.log(`[알림] 후보 없음 안내 슬랙 전송 완료`);
  } else {
    console.log(`[알림] 슬랙에 ${candidates.length}건 후보 전송 완료`);
  }
}

main();
