import { createSupabaseAdminClient } from "./supabase/admin";
import { getUnifiedGrade } from "./grade";

export async function getGradeCodeForOrder(code) {
  const supabase = createSupabaseAdminClient();
  const { data: snapshot } = await supabase
    .from("latest_stock_snapshots")
    .select("value_score, quality_score, safety_score, final_pick_decision, final_pick_reasons, risk_level")
    .eq("code", code)
    .maybeSingle();

  if (!snapshot) return null;

  const stockLike = {
    valueScore: snapshot.value_score,
    qualityScore: snapshot.quality_score,
    safetyScore: snapshot.safety_score,
    finalPickMeta: {
      decision: snapshot.final_pick_decision,
      reasons: snapshot.final_pick_reasons || [],
    },
    riskMeta: { level: snapshot.risk_level },
  };

  return getUnifiedGrade(stockLike).code;
}
