import { createClient } from "@supabase/supabase-js";
import { kstTodayStr, kstWeekday, KST_WEEKDAY_NAME } from "./lib/date.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_CANDIDATES = 4;
const MIN_CANDIDATES = 3;

const KST_DAY_TYPE = { 1: "mon", 2: "tue", 4: "thu", 5: "fri" }; // topic_candidates_day_type_check 허용값

function daysAgoStr(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysFromNowStr(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchRecentMarketIssues() {
  const since = daysAgoStr(2); // 최근 3일(오늘 포함)
  const { data, error } = await supabase
    .from("market_issues")
    .select("*")
    .gte("issue_date", since);

  if (error) {
    console.error("market_issues 조회 실패:", error);
    return [];
  }
  console.log(`[market_issues] ${data.length}건 조회`);
  return data;
}

async function fetchRecentDisclosureEvents() {
  const since = daysAgoStr(2); // 최근 3일(오늘 포함)
  const { data, error } = await supabase
    .from("disclosure_events")
    .select("*")
    .gte("disclosure_date", since);

  if (error) {
    console.error("disclosure_events 조회 실패:", error);
    return [];
  }
  console.log(`[disclosure_events] ${data.length}건 조회`);
  return data;
}

async function fetchUpcomingHighImportanceEvents() {
  const from = daysAgoStr(0);
  const to = daysFromNowStr(7);
  const { data, error } = await supabase
    .from("economic_calendar")
    .select("*")
    .eq("importance", "high")
    .gte("event_date", from)
    .lte("event_date", to);

  if (error) {
    console.error("economic_calendar 조회 실패(테이블 부재일 수 있음, 0건으로 처리):", error);
    return [];
  }
  console.log(`[economic_calendar] ${data.length}건 조회`);
  return data;
}

async function fetchRecentFlowSignals() {
  const since = daysAgoStr(0); // 최근 1일치
  const { data, error } = await supabase
    .from("flow_signals")
    .select("*")
    .gte("date", since);

  if (error) {
    console.error("flow_signals 조회 실패:", error);
    return [];
  }
  console.log(`[flow_signals] ${data.length}건 조회`);
  return data;
}

function scoreEconomicCalendarItems(items) {
  const today = daysAgoStr(0);
  return items.map((item) => {
    const daysUntil = Math.round(
      (new Date(item.event_date) - new Date(today)) / (1000 * 60 * 60 * 24)
    );
    const urgencyBonus = Math.max(0, 7 - daysUntil) * 5; // 임박할수록 가중치 ↑
    return {
      source: "economic_calendar",
      score: 60 + urgencyBonus,
      title: (item.title || item.event_name || "주요 경제 일정").slice(0, 60),
      rationale: `${item.event_date} 예정된 high 중요도 일정 (D-${daysUntil}).${
        item.description ? ` ${item.description}` : ""
      }`,
      related_codes: [],
      related_sectors: item.related_sectors || [],
    };
  });
}

function scoreMarketIssueItems(items) {
  const confidenceWeight = { high: 90, mid: 60, low: 30 };
  return items.map((item) => {
    const base = confidenceWeight[item.confidence] || 30;
    const directionBonus = item.direction && item.direction !== "neutral" ? 5 : 0;
    return {
      source: "market_issues",
      score: base + directionBonus,
      title: (item.title || "시장 이슈").slice(0, 60),
      rationale: `${item.issue_date} 감지된 이슈 (confidence=${item.confidence}, direction=${item.direction}). ${
        item.summary || ""
      }`.trim(),
      related_codes: item.impacted_codes || [],
      related_sectors: item.impacted_sectors || [],
    };
  });
}

function scoreDisclosureEventItems(items) {
  const typeWeight = { major_holder: 80, executive_ownership: 60 };
  return items.map((item) => {
    const base = typeWeight[item.type] || 40;
    return {
      source: "disclosure_events",
      score: base,
      title: `${item.code} 공시: ${(item.summary || item.type || "").slice(0, 40)}`,
      rationale: `${item.disclosure_date} ${item.code} 종목의 ${item.type} 공시. ${item.summary || ""}`.trim(),
      related_codes: item.code ? [item.code] : [],
      related_sectors: [],
    };
  });
}

function scoreFlowSignalItems(items) {
  const TOP_N = 5; // 상위 스코어링에만 태우고, 최종 선정은 아래 공통 로직에서 결정
  const withMagnitude = items.map((item) => {
    const foreign = Number(item.foreign_net_buy) || 0;
    const inst = Number(item.inst_net_buy) || 0;
    const shortChange = Math.abs(Number(item.short_balance_change_pct) || 0);
    const magnitude = Math.abs(foreign) + Math.abs(inst);
    return { item, foreign, inst, shortChange, magnitude };
  });

  withMagnitude.sort((a, b) => b.magnitude + b.shortChange - (a.magnitude + a.shortChange));

  return withMagnitude.slice(0, TOP_N).map(({ item, foreign, inst, shortChange }) => ({
    source: "flow_signals",
    score: 40 + Math.min(40, (Math.abs(foreign) + Math.abs(inst)) / 1e8) + Math.min(10, shortChange),
    title: `${item.code} 수급 변동`,
    rationale: `${item.date} 기준 외국인 순매수 ${foreign.toLocaleString()}, 기관 순매수 ${inst.toLocaleString()}, 공매도잔고 변동 ${shortChange}%.`,
    related_codes: item.code ? [item.code] : [],
    related_sectors: [],
  }));
}

function selectTopCandidates(allItems) {
  const sorted = [...allItems].sort((a, b) => b.score - a.score);
  const count = Math.max(MIN_CANDIDATES, Math.min(MAX_CANDIDATES, sorted.length));
  return sorted.slice(0, Math.min(count, sorted.length));
}

async function main() {
  const weekday = kstWeekday();
  const dayType = KST_DAY_TYPE[weekday];
  if (!dayType) {
    console.log(`[생성] 오늘(${KST_WEEKDAY_NAME[weekday]}요일)은 리포트 생성 대상 요일이 아니므로 스킵합니다`);
    return;
  }

  const [marketIssues, disclosureEvents, calendarEvents, flowSignals] = await Promise.all([
    fetchRecentMarketIssues(),
    fetchRecentDisclosureEvents(),
    fetchUpcomingHighImportanceEvents(),
    fetchRecentFlowSignals(),
  ]);

  const scoredItems = [
    ...scoreEconomicCalendarItems(calendarEvents),
    ...scoreMarketIssueItems(marketIssues),
    ...scoreDisclosureEventItems(disclosureEvents),
    ...scoreFlowSignalItems(flowSignals),
  ];

  if (scoredItems.length === 0) {
    console.log("후보로 삼을 데이터가 없습니다.");
    return;
  }

  const topCandidates = selectTopCandidates(scoredItems);
  console.log(`[생성] ${topCandidates.length}건 후보 선정`);

  const today = kstTodayStr(); // notify-editor.mjs가 조회하는 target_issue_date와 동일한 KST 기준이어야 함
  const rows = topCandidates.map((c, idx) => ({
    target_issue_date: today,
    day_type: dayType,
    candidate_no: idx,
    title: c.title,
    rationale: c.rationale,
    related_codes: c.related_codes || [],
    related_sectors: c.related_sectors || [],
    status: "proposed",
  }));

  const { error } = await supabase.from("topic_candidates").insert(rows);
  if (error) {
    console.error("topic_candidates 저장 실패 (원문):");
    console.error(`code: ${error.code}`);
    console.error(`message: ${error.message}`);
    console.error(`details: ${error.details}`);
    console.error(`hint: ${error.hint}`);
    process.exit(1);
  }

  console.log(`[생성] ${rows.length}건 후보 선정 및 저장 완료`);
}

main();
