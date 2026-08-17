import { createSupabaseServerClient } from "./supabase/server";

export async function getStockDiagnosisData(code) {
  const supabase = await createSupabaseServerClient();

  const [{ data: stockRow }, { data: snapshot }] = await Promise.all([
    supabase.from("stocks").select("code, name, market").eq("code", code).maybeSingle(),
    supabase.from("latest_stock_snapshots").select("*").eq("code", code).maybeSingle(),
  ]);

  if (!snapshot) return null;

  const rawData = snapshot.raw_data || {};
  const rawMetrics = rawData.metrics || {};

  return {
    code: snapshot.code,
    name: stockRow?.name || rawData.name || snapshot.code,
    market: stockRow?.market || rawData.market || "",
    currentPrice: snapshot.current_price ?? rawMetrics.closePrice ?? null,
    changePercent: snapshot.change_percent,
    targetPrice: rawMetrics.targetPrice ?? null,
    upside: rawMetrics.upside ?? null,
    debtRatio: snapshot.debt_ratio,
    valueScore: snapshot.value_score,
    qualityScore: snapshot.quality_score,
    safetyScore: snapshot.safety_score,
    marketScore: snapshot.market_score,
    changeScore: snapshot.change_score,
    scoreBreakdown: {
      perScore: snapshot.per_score,
      pbrScore: snapshot.pbr_score,
      discountBonus: snapshot.discount_bonus,
      operatingMarginScore: snapshot.operating_margin_score,
      roeScore: snapshot.roe_score,
      profitStabilityScore: snapshot.profit_stability_score,
      debtRatioScore: snapshot.debt_ratio_score,
      earningsSafetyScore: snapshot.earnings_safety_score,
      marketCapScore: snapshot.market_cap_score,
      liquidityScore: snapshot.liquidity_score,
      revenueGrowthScore: snapshot.revenue_growth_score,
      operatingIncomeGrowthScore: snapshot.operating_income_growth_score,
      netIncomeGrowthScore: snapshot.net_income_growth_score,
    },
    finalPickMeta: {
      decision: snapshot.final_pick_decision,
      reasons: snapshot.final_pick_reasons || [],
      score: snapshot.final_pick_score,
    },
    riskMeta: {
      level: snapshot.risk_level,
      flags: snapshot.risk_flags || [],
    },
    rankFlags: snapshot.rank_flags || [],
    undervalueFlags: snapshot.undervalue_flags || [],
    undervalueEligible: snapshot.undervalue_eligible,
    topRankEligible: snapshot.top_rank_eligible,
  };
}

export async function getSimilarStocks(code, gradeCode, limit = 3) {
  if (!gradeCode) return [];
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("latest_stock_snapshots")
    .select("code, final_pick_score, raw_data")
    .eq("unified_grade_code", gradeCode)
    .neq("code", code)
    .order("final_pick_score", { ascending: false })
    .limit(limit);

  return (data || []).map((row) => ({
    code: row.code,
    name: row.raw_data?.name || row.code,
  }));
}

export async function getHoldingForCurrentUser(code) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data: account } = await supabase
    .from("virtual_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!account) return null;

  const { data: holding } = await supabase
    .from("virtual_holdings")
    .select("code, name, quantity, avg_price, grade_at_first_buy")
    .eq("account_id", account.id)
    .eq("code", code)
    .maybeSingle();

  return holding || null;
}
