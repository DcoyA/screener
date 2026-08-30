import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

// 홈 가상투자 섹션의 소셜 프루프용. 지금 집계 가능한 건 활성 가상계좌 수뿐이다.
// (참여자 평균 수익률·KOSPI 대비는 전 계좌 실시간 평가가 필요해 사전 집계 배치
//  없이는 못 낸다 — 노출하지 않는다.)
export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase
      .from("virtual_accounts")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, activeAccounts: count ?? 0 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
