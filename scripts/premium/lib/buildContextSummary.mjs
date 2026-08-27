// generate-report.mjs가 모아온 보조 컨텍스트(JSON)를 LLM이 읽기 좋은
// 마크다운 요약으로 바꾼다. 기존 JSON.stringify(context).slice(0, 6000)은
// JSON 중간에서 잘려 LLM이 깨진 구조를 오독할 수 있었다 - 여기선 항목 단위로만
// 자른다(문자열 중간 절단 금지).

import { normalizeStockName } from "../../../app/lib/stockName.js";

const SECTION_CHAR_CAP = 3000; // 섹션(카테고리)당 상한
const TOTAL_CHAR_CAP = 12000; // 전체 상한

function formatMarketIssue(item) {
  return `- [${item.issue_date}] ${item.title} (confidence=${item.confidence}, direction=${item.direction}) ${item.summary || ""}`.trim();
}

function formatDisclosureEvent(item) {
  return `- [${item.disclosure_date}] ${item.code} ${item.type}: ${item.summary || ""}`.trim();
}

function formatFlowSignal(item) {
  const parts = [
    `외국인 1일 ${item.foreign_net_buy ?? "-"}`,
    `기관 1일 ${item.inst_net_buy ?? "-"}`,
  ];
  if (item.foreign_net_5d != null) parts.push(`외국인 5일누적 ${item.foreign_net_5d}`);
  if (item.foreign_zscore_20d != null) parts.push(`외국인 20일 z-score ${item.foreign_zscore_20d}`);
  return `- [${item.date}] ${item.code} ${parts.join(", ")}`;
}

function formatEconomicEvent(item) {
  return `- [${item.event_date}] ${item.title || item.event_name || "주요 일정"} (importance=${item.importance}) ${item.description || ""}`.trim();
}

function formatFollowupItem(item) {
  return `- (${item.from_issue}) ${item.topic}: ${item.what_changed} → 판정: ${item.verdict}`;
}

function formatRelatedStock(item) {
  const gradeChange = item.grade_4w_ago ? `${item.grade_4w_ago} → ${item.grade}` : `${item.grade} (4주 전 데이터 없음)`;
  const strength =
    item.sector_strength_score != null
      ? `섹터 강도 점수 ${item.sector_strength_score}/100${item.sector_leader ? " (섹터 리더)" : ""}`
      : "섹터 상대 위치 데이터 없음";
  return `- ${item.code} ${normalizeStockName(item.name)}: 등급 ${gradeChange}, ${strength}`;
}

const SECTION_FORMATTERS = {
  market_issues: { heading: "최근 시장 이슈", formatFn: formatMarketIssue },
  disclosure_events: { heading: "최근 공시", formatFn: formatDisclosureEvent },
  flow_signals: { heading: "수급 신호", formatFn: formatFlowSignal },
  economic_calendar: { heading: "예정된 주요 일정", formatFn: formatEconomicEvent },
  followup: { heading: "지난 리포트 후속 추적(있으면 반드시 followup 필드에 반영할 것)", formatFn: formatFollowupItem },
  related_stock_details: { heading: "관련 종목 상세(등급/섹터 위치 - related_stocks 작성 시 이 값만 사용)", formatFn: formatRelatedStock },
};

function buildItemCappedSection(heading, items, formatFn) {
  if (!items || items.length === 0) return "";
  const lines = [`## ${heading}`];
  let used = lines[0].length;
  for (let i = 0; i < items.length; i++) {
    const line = formatFn(items[i]);
    if (used + line.length + 1 > SECTION_CHAR_CAP) {
      lines.push(`(이하 ${items.length - i}건 생략 - 섹션 상한 초과)`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

export function buildContextSummary(context) {
  const blocks = Object.entries(SECTION_FORMATTERS)
    .map(([key, { heading, formatFn }]) => buildItemCappedSection(heading, context[key], formatFn))
    .filter(Boolean);

  if (blocks.length === 0) return "(추가 컨텍스트 데이터 없음)";

  // 섹션 단위 상한(3000자)을 이미 걸었지만, 섹션 수가 많아 총합이 넘을 수
  // 있으니 여기서도 섹션 "경계"에서만 자른다 - 항목/섹션 단위 절단 원칙 유지.
  let acc = "";
  for (const block of blocks) {
    const candidate = acc ? `${acc}\n\n${block}` : block;
    if (candidate.length > TOTAL_CHAR_CAP) {
      acc += "\n\n(이하 섹션 생략 - 전체 상한 초과)";
      break;
    }
    acc = candidate;
  }
  return acc;
}
