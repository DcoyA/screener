import { createClient } from "@supabase/supabase-js";
import { kstTodayStr, kstWeekday, KST_WEEKDAY_NAME } from "./lib/date.mjs";

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

function buildSlackMessage(candidates) {
  const allIds = candidates.map((c) => c.id).join(",");

  return {
    text: `${kstTodayStr()}(${KST_WEEKDAY_NAME[kstWeekday()]}) 리포트 후보 ${candidates.length}건`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📋 ${kstTodayStr()}(${KST_WEEKDAY_NAME[kstWeekday()]}) 리포트 후보 ${candidates.length}건` },
      },
      { type: "divider" },
      {
        type: "actions",
        block_id: "candidate_checkboxes",
        elements: [
          {
            type: "checkboxes",
            action_id: "select_candidates",
            options: candidates.map((c, i) => ({
              text: {
                type: "mrkdwn",
                text: `*${i + 1}. ${SOURCE_TAG[c.source] || "[기타]"}* ${c.title} — ${buildBadge(c)}`,
              },
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
    ],
  };
}

async function main() {
  const candidates = await fetchTodayProposedCandidates();
  console.log(`[알림] topic_candidates 조회 ${candidates.length}건`);

  const emptyNoticeText = `[알림] 오늘(${kstTodayStr()}, ${KST_WEEKDAY_NAME[kstWeekday()]}요일) 발행할 리포트 후보가 없습니다.`;
  const message = candidates.length === 0 ? { text: emptyNoticeText } : buildSlackMessage(candidates);

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
