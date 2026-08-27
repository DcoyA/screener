// 발송용 이메일 HTML. 테이블 레이아웃 + 인라인 스타일만 사용(Outlook 호환),
// 이미지를 전혀 쓰지 않아 이미지 차단과 무관하게 완전히 읽힌다.
//
// 색상은 app/globals.css의 디자인 토큰 실제 값을 그대로 하드코딩했다(이메일
// 클라이언트 대부분이 CSS 변수를 지원하지 않아 인라인 리터럴이 필수).
// 토큰이 바뀌면 이 파일도 같이 고쳐야 한다 - 자동 동기화 수단은 없다.
import { cleanStockName } from "../../../app/lib/stockName.js";
import { visibleSections } from "../../../app/lib/reportSections.js";

const COLOR_PRIMARY = "#4b3fff"; // --color-primary
const COLOR_SURFACE_TINT = "#f1effe"; // --color-surface-tint
const COLOR_TEXT = "#0f172a";
const COLOR_MUTED = "#64748b";
const COLOR_BG_DARK = "#0f172a";
const COLOR_CARD_DARK = "#1e1b2e";
const MAX_WIDTH = 600;

const SITE_URL = "https://www.hellomedia.win";

const VERDICT_COLOR = { 맞음: "#166534", 틀림: "#991b1b", 진행중: "#334155" };
const VERDICT_BG = { 맞음: "#f0fdf4", 틀림: "#fef2f2", 진행중: "#f1f5f9" };
const HORIZON_LABEL = { short: "단기", mid: "중기", long: "장기" };

function esc(s) {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function renderScenario(key, scenario) {
  if (!scenario) return "";
  return `
    <td style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;vertical-align:top;width:33%;">
      <div style="font-size:12px;font-weight:700;color:${COLOR_PRIMARY};margin-bottom:4px;">${esc(HORIZON_LABEL[key])} (${esc(scenario.horizon)})</div>
      <div style="font-size:13px;color:${COLOR_TEXT};margin-bottom:6px;">${esc(scenario.view)}</div>
      <div style="font-size:12px;color:${COLOR_MUTED};">지켜볼 것: ${esc(scenario.watch)}</div>
    </td>`;
}

function renderSection(section, index) {
  const stocksHtml = (section.related_stocks || [])
    .map(
      (rs) => `
      <tr><td style="padding:6px 0;font-size:13px;color:${COLOR_TEXT};">
        <strong>${esc(cleanStockName(rs.name))}(${esc(rs.code)})</strong>
        · 등급 ${rs.grade_4w_ago ? `${esc(rs.grade_4w_ago)} → ` : ""}${esc(rs.grade)}
        · ${esc(rs.one_liner)}
      </td></tr>`
    )
    .join("");

  const sourcesHtml = (section.sources || [])
    .map(
      (src) =>
        `<div style="font-size:11px;color:${COLOR_MUTED};">[${esc(src.type)}] ${esc(src.url)} (${esc(src.date)})</div>`
    )
    .join("");

  return `
    <tr><td style="padding:28px 24px 0;">
      <h2 style="margin:0 0 10px;font-size:18px;color:${COLOR_TEXT};">${index + 1}. ${esc(section.title)}</h2>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:${COLOR_TEXT};"><strong>무슨 일이 있었나</strong><br/>${esc(section.what_happened)}</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${COLOR_TEXT};"><strong>왜 중요한가</strong><br/>${esc(section.why_it_matters)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:14px;">
        <tr>
          ${renderScenario("short", section.scenarios?.short)}
          ${renderScenario("mid", section.scenarios?.mid)}
          ${renderScenario("long", section.scenarios?.long)}
        </tr>
      </table>
      <div style="background:#fffbeb;color:#92400e;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px;">
        <strong>이 관점이 틀렸다고 볼 조건</strong><br/>${esc(section.invalidation)}
      </div>
      ${stocksHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stocksHtml}</table>` : ""}
      ${sourcesHtml}
    </td></tr>
    <tr><td style="padding:20px 24px 0;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"/></td></tr>`;
}

function renderFollowup(followup) {
  if (!followup || followup.length === 0) return "";
  const rows = followup
    .map(
      (f) => `
      <tr><td style="padding:8px 0;font-size:13px;color:${COLOR_TEXT};">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${VERDICT_BG[f.verdict] || "#f1f5f9"};color:${VERDICT_COLOR[f.verdict] || "#334155"};margin-right:6px;">${esc(f.verdict)}</span>
        [${esc(f.from_issue)}] ${esc(f.topic)}: ${esc(f.what_changed)}
      </td></tr>`
    )
    .join("");

  return `
    <tr><td style="padding:28px 24px 0;">
      <h2 style="margin:0 0 10px;font-size:16px;color:${COLOR_TEXT};">지난 리포트 후속 추적</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </td></tr>`;
}

function renderCalendar(items) {
  if (!items || items.length === 0) return "";
  const rows = items
    .map(
      (e) =>
        `<tr><td style="padding:6px 0;font-size:13px;color:${COLOR_TEXT};">${esc(e.date)} · ${esc(e.event)} - ${esc(e.why)}</td></tr>`
    )
    .join("");
  return `
    <tr><td style="padding:28px 24px 0 24px;">
      <h2 style="margin:0 0 10px;font-size:16px;color:${COLOR_TEXT};">다음 주 일정</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </td></tr>`;
}

export function buildEmailHtml(report, { webviewUrl, unsubscribeUrl }) {
  const content = report.content_json || {};
  const cover = content.cover || {};
  // STEP 10: reports.excluded_sections 로 걸러진 섹션만. content_json 은 불변.
  // 번호(renderSection 의 index+1)는 필터 후 위치 기준으로 다시 매겨진다(1,2,3…).
  const sections = visibleSections(report).map(renderSection).join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<style>
  @media (prefers-color-scheme: dark) {
    .email-bg { background:${COLOR_BG_DARK} !important; }
    .email-card { background:${COLOR_CARD_DARK} !important; }
    .email-card p, .email-card h2, .email-card div { color:#e2e8f0 !important; }
  }
</style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="${MAX_WIDTH}" cellpadding="0" cellspacing="0" class="email-card" style="max-width:${MAX_WIDTH}px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:${COLOR_PRIMARY};padding:20px 24px;">
          <div style="font-size:13px;color:rgba(255,255,255,0.7);">우량주 스카우터 · 프리미엄 리포트</div>
          <div style="font-size:20px;font-weight:800;color:#ffffff;margin-top:4px;">${esc(cover.headline || report.topic_title)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:6px;">${esc(report.issue_date)} · 읽는 시간 약 ${esc(cover.reading_time_min || "-")}분</div>
        </td></tr>
        <tr><td style="padding:20px 24px 0;">
          <p style="margin:0;font-size:14px;color:${COLOR_MUTED};">${esc(cover.market_temp)}</p>
        </td></tr>
        ${sections}
        ${renderFollowup(content.followup)}
        ${renderCalendar(content.next_week_calendar)}
        <tr><td style="padding:24px;">
          <p style="font-size:11px;color:${COLOR_MUTED};">${esc(content.disclaimer)}</p>
        </td></tr>
        <tr><td style="background:${COLOR_SURFACE_TINT};padding:18px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:12px;">
              <a href="${SITE_URL}" style="color:${COLOR_PRIMARY};text-decoration:none;font-weight:700;">우량주 스카우터 바로가기</a>
              &nbsp;·&nbsp;
              <a href="${webviewUrl}" style="color:${COLOR_PRIMARY};text-decoration:none;font-weight:700;">웹에서 보기</a>
              &nbsp;·&nbsp;
              <a href="${unsubscribeUrl}" style="color:${COLOR_MUTED};text-decoration:none;">구독취소</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
