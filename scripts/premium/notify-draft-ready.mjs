import { createClient } from "@supabase/supabase-js";
import { kstTodayStr } from "./lib/date.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SITE_URL = "https://www.hellomedia.win";

// cover.reading_time_min은 LLM이 채운다(reportSchema.mjs). 혹시 없는 경우
// (스키마 위반 응답이 검증을 어찌어찌 통과한 예외적 상황 등)에만 섹션
// 텍스트 길이로 대략 추정한다.
const CHARS_PER_MINUTE = 400;

function estimateReadingMinutes(report) {
  const provided = report.content_json?.cover?.reading_time_min;
  if (Number.isFinite(provided) && provided > 0) return provided;

  const sections = report.content_json?.sections || [];
  const textLength = sections.reduce(
    (sum, s) => sum + (s.what_happened?.length || 0) + (s.why_it_matters?.length || 0),
    0
  );
  return Math.max(1, Math.round(textLength / CHARS_PER_MINUTE));
}

function countRelatedStockCodes(report) {
  const sections = report.content_json?.sections || [];
  const codes = new Set();
  for (const s of sections) {
    for (const rs of s.related_stocks || []) {
      if (rs.code) codes.add(rs.code);
    }
  }
  return codes.size;
}

function buildPreviewUrl(reportId) {
  const token = process.env.EDITORIAL_PREVIEW_TOKEN;
  const base = `${SITE_URL}/admin/editorial/preview/${reportId}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

function buildMessage(report) {
  const sectionCount = (report.content_json?.sections || []).length;
  const readingMin = estimateReadingMinutes(report);
  const stockCount = countRelatedStockCodes(report);
  const previewUrl = buildPreviewUrl(report.id);

  return {
    text: `${report.issue_date} 리포트 초안 생성 완료`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `📄 *${report.issue_date} 리포트 초안 생성 완료*\n` +
            `${sectionCount}개 섹션 · 약 ${readingMin}분 분량 · 관련 종목 ${stockCount}개\n` +
            `<${previewUrl}|미리보기 열기>`,
        },
      },
      {
        type: "actions",
        block_id: `report_${report.id}`,
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "✅ 승인하고 발송" },
            style: "primary",
            action_id: "approve_report",
            value: String(report.id),
            confirm: {
              title: { type: "plain_text", text: "발송 확인" },
              text: {
                type: "plain_text",
                text: "구독자 전원에게 실제로 이메일이 발송됩니다. 계속할까요?",
              },
              confirm: { type: "plain_text", text: "발송" },
              deny: { type: "plain_text", text: "취소" },
            },
          },
          {
            type: "button",
            text: { type: "plain_text", text: "✏️ 수정 필요" },
            action_id: "request_report_revision",
            value: String(report.id),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "❌ 폐기" },
            style: "danger",
            action_id: "discard_report",
            value: String(report.id),
            confirm: {
              title: { type: "plain_text", text: "폐기 확인" },
              text: { type: "plain_text", text: "이 초안을 폐기합니다. 되돌릴 수 없습니다." },
              confirm: { type: "plain_text", text: "폐기" },
              deny: { type: "plain_text", text: "취소" },
            },
          },
        ],
      },
    ],
  };
}

async function fetchTodayDraftReport() {
  const today = kstTodayStr();
  const { data, error } = await supabase
    .from("reports")
    .select("id, issue_date, content_json")
    .eq("issue_date", today)
    .eq("status", "draft")
    .maybeSingle();

  if (error) {
    console.error("reports 조회 실패:", error);
    process.exit(1);
  }
  return data;
}

async function main() {
  const report = await fetchTodayDraftReport();
  if (!report) {
    console.log("[알림] 오늘 draft 상태 리포트가 없어 알림을 스킵합니다");
    return;
  }

  const message = buildMessage(report);
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

  console.log(`[알림] report_id=${report.id} 초안 검수 요청 슬랙 전송 완료`);
}

main();
