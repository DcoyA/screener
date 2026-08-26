import { createSupabaseServerClient } from "./supabase/server";
import { formatUpside } from "./formatUpside";

export async function getStockDiagnosisData(code) {
  const supabase = await createSupabaseServerClient();

  const [{ data: stockRow }, { data: snapshot }] = await Promise.all([
    supabase.from("stocks").select("code, name, market").eq("code", code).maybeSingle(),
    supabase.from("latest_stock_snapshots").select("*").eq("code", code).maybeSingle(),
  ]);

  if (!snapshot) return null;

  const rawData = snapshot.raw_data || {};
  const rawMetrics = rawData.metrics || {};
  const currentPrice = snapshot.current_price ?? rawMetrics.closePrice ?? null;
  const upsideResult = formatUpside(currentPrice, rawMetrics.targetPrice);

  return {
    code: snapshot.code,
    name: stockRow?.name || rawData.name || snapshot.code,
    market: stockRow?.market || rawData.market || "",
    currentPrice,
    changePercent: snapshot.change_percent,
    // fair-value v2: 적정가는 단일값이 아니라 보수/중립/낙관 밴드다.
    targetPrice: rawMetrics.targetPrice ?? null,
    targetPriceConservative: rawMetrics.targetPriceConservative ?? null,
    targetPriceOptimistic: rawMetrics.targetPriceOptimistic ?? null,
    per: rawMetrics.per ?? null,
    pbr: rawMetrics.pbr ?? null,
    roe: rawMetrics.roe ?? null,
    priceChangeRate: rawMetrics.priceChangeRate ?? null,
    sectorName: rawData.sector ?? null,
    // TASK 2: 섹터 내 PER/PBR/ROE 상대 위치(update_data.py가 계산해 저장).
    sectorRelativeMeta: rawData.sectorRelativeMeta ?? null,
    // app/lib/formatUpside.js의 formatUpside(currentPrice, targetPrice)로 통일 -
    // Python이 미리 계산해두던 display.upsideCapped/upsideLabel은 더 이상 읽지 않는다.
    upsideDisplay: upsideResult.display,
    upsideIsCapped: upsideResult.isCapped,
    upsideRaw: upsideResult.raw,
    // 지주회사 할인(30%)이 적정가에 이미 반영됐는지 - 화면에 "지주사 할인
    // 30% 반영" 문구를 보여줄지 판단하는 데 쓴다.
    holdingDiscount: rawData.holdingDiscount ?? false,
    totalScore: snapshot.total_score ?? rawData.totalScore ?? null,
    // update_data.py가 전체 종목 백분위로 미리 계산해 저장한 등급 — 여기서
    // 다시 계산하지 않고 그대로 옮긴다(app/lib/grade.js의 getUnifiedGrade가
    // 이 필드가 있으면 그대로 신뢰해서 쓴다).
    unifiedGradeCode: snapshot.unified_grade_code ?? rawData.unifiedGradeCode ?? null,
    unifiedGradeDowngraded: snapshot.unified_grade_downgraded ?? rawData.unifiedGradeDowngraded ?? false,
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
      // 예전엔 이 필드가 `score`라는 이름이라 app/lib/grade.js가 기대하는
      // `finalScore`와 안 맞아 등급이 항상 기본값(A)으로 떨어졌었다 — 그 버그.
      finalScore: snapshot.final_pick_score,
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
