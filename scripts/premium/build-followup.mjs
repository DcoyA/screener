import { createClient } from "@supabase/supabase-js";
import { normalizeStockName } from "../../app/lib/stockName.js";
import { kstDaysAgoStr } from "../lib/market-calendar.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FOLLOWUP_LOOKBACK_DAYS = 7;
const BULLISH_HIT_THRESHOLD_PCT = 3;
const BULLISH_MISS_THRESHOLD_PCT = -3;

async function fetchReportFromDaysAgo(days) {
  // issue_date 는 kstTodayStr 로 기록되므로 기준일도 KST 로 맞춘다.
  const targetDate = kstDaysAgoStr(days);
  const { data, error } = await supabase
    .from("reports")
    .select("id, issue_date, topic_title, content_json")
    .eq("issue_date", targetDate)
    .eq("status", "sent")
    .maybeSingle();

  if (error) {
    console.warn(`[후속추적] ${targetDate} 리포트 조회 실패(무시): ${error.message}`);
    return null;
  }
  return data;
}

// content_json.sections[].related_stocks에서 코드 기준 중복 없이 모은다.
// grade_then은 그때 그 리포트가 "당시 등급"이라고 이미 적어둔 값을
// 그대로 쓴다(재조회 안 함 - 그 시점 판단 그대로가 후속 추적의 대상).
function collectRelatedStocksFromReport(report) {
  const sections = report?.content_json?.sections || [];
  const byCode = new Map();
  for (const s of sections) {
    for (const rs of s.related_stocks || []) {
      if (!rs.code || byCode.has(rs.code)) continue;
      byCode.set(rs.code, { code: rs.code, name: rs.name, gradeThen: rs.grade, stance: rs.stance, sectionTitle: s.title });
    }
  }
  return [...byCode.values()];
}

async function fetchThenPrices(codes, issueDate) {
  if (codes.length === 0) return new Map();
  const { data, error } = await supabase
    .from("stock_daily_snapshots")
    .select("code, current_price")
    .in("code", codes)
    .eq("snapshot_date", issueDate);

  if (error) {
    console.warn(`[후속추적] ${issueDate} 당시 종가 조회 실패(무시): ${error.message}`);
    return new Map();
  }
  return new Map(data.map((r) => [r.code, r.current_price]));
}

async function fetchNowPricesAndGrades(codes) {
  if (codes.length === 0) return new Map();
  const { data, error } = await supabase
    .from("latest_stock_snapshots")
    .select("code, current_price, unified_grade_code")
    .in("code", codes);

  if (error) {
    console.warn(`[후속추적] 현재 시세 조회 실패(무시): ${error.message}`);
    return new Map();
  }
  return new Map(data.map((r) => [r.code, { price: r.current_price, grade: r.unified_grade_code }]));
}

// 문서에 명시된 규칙: 상승(bullish) 시나리오였을 때만 자동 판정한다.
// bearish/neutral 및 bullish인데 ±3% 안쪽인 경우는 전부 "진행중" -
// bearish 콜에 대한 자동 판정 규칙은 문서에 없어 임의로 만들지 않았다.
function judgeVerdict(stance, changePct) {
  if (stance === "bullish") {
    if (changePct >= BULLISH_HIT_THRESHOLD_PCT) return "맞음";
    if (changePct <= BULLISH_MISS_THRESHOLD_PCT) return "틀림";
  }
  return "진행중";
}

// 틀린 것도 그대로 싣는다 - verdict가 "틀림"이어도 이 함수는 걸러내지
// 않는다. 걸러내지 않는 걸 검증하려면 이 함수가 반환한 배열을 그대로
// generate-report.mjs가 컨텍스트에 넣는지만 확인하면 된다(별도 필터 없음).
export async function buildFollowup() {
  const report = await fetchReportFromDaysAgo(FOLLOWUP_LOOKBACK_DAYS);
  if (!report) {
    console.log(`[후속추적] ${FOLLOWUP_LOOKBACK_DAYS}일 전 발행(sent) 리포트가 없어 후속 추적을 스킵합니다`);
    return [];
  }

  const stocks = collectRelatedStocksFromReport(report);
  if (stocks.length === 0) {
    console.log("[후속추적] 지난 리포트에 related_stocks가 없어 스킵합니다");
    return [];
  }

  const codes = stocks.map((s) => s.code);
  const [thenPrices, nowData] = await Promise.all([
    fetchThenPrices(codes, report.issue_date),
    fetchNowPricesAndGrades(codes),
  ]);

  const followupItems = [];
  for (const s of stocks) {
    const thenPrice = thenPrices.get(s.code);
    const now = nowData.get(s.code);
    if (thenPrice == null || now?.price == null) {
      console.log(`[후속추적] ${s.code} 당시/현재 가격 데이터 부족으로 스킵`);
      continue;
    }

    const changePct = ((now.price - thenPrice) / thenPrice) * 100;
    const verdict = judgeVerdict(s.stance, changePct);
    const gradeChangeText =
      now.grade && s.gradeThen && now.grade !== s.gradeThen ? `등급 ${s.gradeThen} → ${now.grade}, ` : "";

    followupItems.push({
      from_issue: report.issue_date,
      topic: `${normalizeStockName(s.name)}(${s.code}) - ${s.sectionTitle}`,
      what_changed: `${gradeChangeText}주가 ${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% (${thenPrice.toLocaleString()}원 → ${now.price.toLocaleString()}원)`,
      verdict,
    });

    console.log(`[후속추적] ${s.code} stance=${s.stance} 변동률=${changePct.toFixed(1)}% -> ${verdict}`);
  }

  return followupItems;
}

// 단독 실행(디버깅/수동 확인용) - generate-report.mjs는 buildFollowup()만 import해서 쓴다.
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await buildFollowup();
  console.log(JSON.stringify(result, null, 2));
}
