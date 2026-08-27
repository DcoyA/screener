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

// 슬랙 plain_text 옵션 라벨 75자 제한.
function truncate(s, n = 72) {
  const str = String(s || "");
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

// "빼고 발송할 섹션" 체크박스. 미선택 = 전체 발송.
// 승인 시 handleReportAction 이 payload.state.values.exclude_sections_block 에서 읽는다.
function buildExcludeSectionsBlock(report) {
  const sections = report.content_json?.sections || [];
  if (sections.length === 0) return null;

  // 슬랙 체크박스 그룹당 옵션 최대 10개. 초과 시 뒷섹션은 제외 대상에서 빠지므로
  // (전체 발송) 안전한 방향이지만 로그로 남긴다.
  const MAX = 10;
  if (sections.length > MAX) {
    console.warn(`[알림] 섹션 ${sections.length}개 - 제외 체크박스는 앞 ${MAX}개만 노출됩니다`);
  }
  const options = sections.slice(0, MAX).map((s, i) => ({
    text: { type: "plain_text", text: truncate(`${i + 1}. ${s.title}`) },
    value: String(i),
  }));

  return {
    type: "section",
    block_id: "exclude_sections_block",
    text: { type: "mrkdwn", text: "*빼고 발송할 섹션* (선택 안 하면 전체 발송)" },
    accessory: {
      type: "checkboxes",
      action_id: "exclude_sections_select",
      options,
    },
  };
}

function buildMessage(report) {
  const sectionCount = (report.content_json?.sections || []).length;
  const readingMin = estimateReadingMinutes(report);
  const stockCount = countRelatedStockCodes(report);
  const previewUrl = buildPreviewUrl(report.id);
  const excludeBlock = buildExcludeSectionsBlock(report);

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
      ...(excludeBlock ? [excludeBlock] : []),
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
