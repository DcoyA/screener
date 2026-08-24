import { createClient } from "@supabase/supabase-js";
import { kstTodayStr, kstWeekday, KST_WEEKDAY_NAME } from "./lib/date.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

function buildBlocksForCandidate(candidate) {
  const sectors = (candidate.related_sectors || []).join(", ") || "-";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${candidate.title}*\n${candidate.rationale}\n_관련 섹터: ${sectors}_`,
      },
    },
    {
      type: "actions",
      block_id: `candidate_${candidate.id}`,
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "승인" },
          style: "primary",
          action_id: "approve_candidate",
          value: String(candidate.id),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "거부" },
          style: "danger",
          action_id: "reject_candidate",
          value: String(candidate.id),
        },
      ],
    },
    { type: "divider" },
  ];
}

function buildSlackMessage(candidates) {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `오늘의 리포트 주제 후보 (${candidates.length}건)` },
    },
    { type: "divider" },
    ...candidates.flatMap(buildBlocksForCandidate),
  ];

  return {
    text: `오늘의 리포트 주제 후보 ${candidates.length}건`,
    blocks,
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
