import { createClient } from "@supabase/supabase-js";
import stocks from "../app/data/stocks.json" with { type: "json" };
import { getUnifiedGrade } from "../app/lib/grade.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const todayKst = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

async function isMarketHoliday(dateStr) {
  const { data } = await supabase
    .from("market_holidays")
    .select("holiday_date")
    .eq("holiday_date", dateStr)
    .maybeSingle();
  return !!data;
}

async function validateAndGuard(rawList) {
  const valid = rawList.filter((s) => s?.code && s?.name && s?.market);

  // 버그였던 부분: 예전엔 `.lt("snapshot_date", todayKst)`만 걸고 카운트해서
  // "오늘 이전의 모든 날짜에 걸쳐 누적된 행 수 총합"과 비교하고 있었다.
  // stock_daily_snapshots는 (code, snapshot_date)마다 별도 행이라 하루에
  // ~500건씩 쌓이므로, 과거 3일치만 쌓여도 누적 1,500건이 되고, update_data.py는
  // MAX_STOCKS=500으로 원래부터 매일 500종목을 만든다(2026-06-20부터 고정값 —
  // "어제는 1500종목이었는데 오늘 500종목으로 줄었다"가 아니라 "오늘 500 vs
  // 최근 3일 누적 1500"을 비교하던 게 진짜 원인). 이제 "가장 최근 하루"와만
  // 비교한다.
  const { data: latestRow } = await supabase
    .from("stock_daily_snapshots")
    .select("snapshot_date")
    .lt("snapshot_date", todayKst)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRow) {
    // 과거 스냅샷이 아예 없으면(최초 적재) 비교 대상이 없으니 그냥 통과.
    return valid;
  }

  const { count: previousDayCount } = await supabase
    .from("stock_daily_snapshots")
    .select("code", { count: "exact", head: true })
    .eq("snapshot_date", latestRow.snapshot_date);

  const allowShrink = process.env.ALLOW_SHRINK === "1";
  if (!allowShrink && previousDayCount && valid.length < previousDayCount * 0.5) {
    throw new Error(
      `이상치 감지: 직전 스냅샷(${latestRow.snapshot_date}) ${previousDayCount}건 대비 오늘 ${valid.length}건. ` +
        `적재를 중단합니다. 의도된 축소라면 ALLOW_SHRINK=1로 재실행하세요.`
    );
  }
  if (allowShrink && previousDayCount && valid.length < previousDayCount * 0.5) {
    console.log(
      `ALLOW_SHRINK=1 - 이상치 가드를 건너뜁니다 (직전 ${latestRow.snapshot_date} ${previousDayCount}건 -> 오늘 ${valid.length}건).`
    );
  }
  return valid;
}

async function upsertStocksMaster(list) {
  const rows = list.map((s) => ({
    code: s.code,
    name: s.name,
    market: s.market,
    sector: s?.sector ?? null,
    sector_type: s?.sectorMeta?.type ?? null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("stocks").upsert(rows, { onConflict: "code" });
  if (error) throw new Error(`종목 마스터 upsert 실패: ${error.message}`);
}

function mapToSnapshotRow(stock, grade) {
  return {
    code: stock.code,
    snapshot_date: todayKst,
    fetched_at: new Date().toISOString(),
    current_price: stock?.metrics?.closePrice ?? null,
    change_percent: stock?.metrics?.priceChangeRate ?? null,
    total_score: stock.totalScore ?? null,
    value_score: stock.valueScore ?? null,
    quality_score: stock.qualityScore ?? null,
    safety_score: stock.safetyScore ?? null,
    market_score: stock.marketScore ?? null,
    change_score: stock.changeScore ?? null,
    per_score: stock?.scoreBreakdown?.perScore ?? null,
    pbr_score: stock?.scoreBreakdown?.pbrScore ?? null,
    discount_bonus: stock?.scoreBreakdown?.discountBonus ?? null,
    operating_margin_score: stock?.scoreBreakdown?.operatingMarginScore ?? null,
    roe_score: stock?.scoreBreakdown?.roeScore ?? null,
    profit_stability_score: stock?.scoreBreakdown?.profitStabilityScore ?? null,
    debt_ratio_score: stock?.scoreBreakdown?.debtRatioScore ?? null,
    earnings_safety_score: stock?.scoreBreakdown?.earningsSafetyScore ?? null,
    market_cap_score: stock?.scoreBreakdown?.marketCapScore ?? null,
    liquidity_score: stock?.scoreBreakdown?.liquidityScore ?? null,
    revenue_growth_score: stock?.scoreBreakdown?.revenueGrowthScore ?? null,
    operating_income_growth_score: stock?.scoreBreakdown?.operatingIncomeGrowthScore ?? null,
    net_income_growth_score: stock?.scoreBreakdown?.netIncomeGrowthScore ?? null,
    debt_ratio: stock?.metrics?.debtRatio ?? null,
    avg_trade_value_5d: stock?.metrics?.avgTradeValue5d ?? null,
    operating_income: stock?.metrics?.operatingIncome ?? null,
    net_income: stock?.metrics?.netIncome ?? null,
    market_cap: stock?.metrics?.marketCap ?? null,
    final_pick_decision: stock?.finalPickMeta?.decision ?? null,
    final_pick_score: stock?.finalPickMeta?.finalScore ?? null,
    final_pick_reasons: stock?.finalPickMeta?.reasons ?? [],
    risk_level: stock?.riskMeta?.level ?? null,
    risk_flags: stock?.riskMeta?.flags ?? [],
    top_rank_eligible: stock?.rankMeta?.topRankEligible ?? false,
    rank_flags: stock?.rankMeta?.flags ?? [],
    undervalue_eligible: stock?.undervalueMeta?.eligible ?? false,
    undervalue_sort_debt_ratio: stock?.undervalueMeta?.sortDebtRatio ?? null,
    undervalue_flags: stock?.undervalueMeta?.flags ?? [],
    timing_score: stock?.timingMeta?.score ?? null,
    sector_strength_score: stock?.sectorMeta?.strengthScore ?? null,
    market_fit_score: stock?.marketContext?.fitScore ?? null,
    unified_grade_code: grade.code,
    unified_grade_downgraded: grade.downgraded,
    raw_data: stock,
  };
}

async function upsertSnapshots(rows) {
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("stock_daily_snapshots")
      .upsert(chunk, { onConflict: "code,snapshot_date" });
    if (error) throw new Error(`스냅샷 적재 실패 (offset ${i}): ${error.message}`);
  }
}

async function upsertPriceDaily(list) {
  const rows = list
    .filter((s) => s?.metrics?.currentPrice)
    .map((s) => ({
      code: s.code,
      trade_date: todayKst,
      close_price: s.metrics.currentPrice,
      change_percent: s?.metrics?.changePercent ?? null,
    }));
  const { error } = await supabase.from("stock_price_daily").upsert(rows, { onConflict: "code,trade_date" });
  if (error) throw new Error(`종가 적재 실패: ${error.message}`);
}

async function runIngest() {
  const startedAt = new Date().toISOString();
  try {
    if (await isMarketHoliday(todayKst)) {
      console.log("휴장일이라 적재를 건너뜁니다.");
      return;
    }
    const validStocks = await validateAndGuard(stocks);
    await upsertStocksMaster(validStocks);
    const rows = validStocks.map((s) => mapToSnapshotRow(s, getUnifiedGrade(s)));
    await upsertSnapshots(rows);
    await upsertPriceDaily(validStocks);

    await supabase.from("batch_ingest_logs").insert({
      snapshot_date: todayKst,
      status: "success",
      total_rows: rows.length,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    console.log(`적재 완료: ${rows.length}건`);
  } catch (err) {
    await supabase.from("batch_ingest_logs").insert({
      snapshot_date: todayKst,
      status: "failed",
      error_message: err.message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    console.error(err.message);
    process.exit(1);
  }
}

runIngest();
