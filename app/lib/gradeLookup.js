import { createSupabaseAdminClient } from "./supabase/admin";

// update_data.py가 전체 종목 백분위로 미리 계산해 저장한 등급을 그대로
// 읽어온다. 예전엔 이 함수가 value_score/quality_score 등 일부 컬럼만 골라
// stockLike 객체를 직접 조립한 뒤 getUnifiedGrade()로 다시 계산했는데,
// 그 조립 과정에서 finalPickMeta.finalScore(당시엔 존재하지도 않던 필드)가
// 빠져있어 등급이 항상 기본값으로 떨어지는 문제가 있었다. 이제는 그런 재조립
// 자체가 필요 없다 — DB에 이미 정답이 저장돼 있으므로 그냥 읽으면 된다.
export async function getGradeCodeForOrder(code) {
  const supabase = createSupabaseAdminClient();
  const { data: snapshot } = await supabase
    .from("latest_stock_snapshots")
    .select("unified_grade_code")
    .eq("code", code)
    .maybeSingle();

  return snapshot?.unified_grade_code ?? null;
}
