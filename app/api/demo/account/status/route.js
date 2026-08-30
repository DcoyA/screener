import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

// 참여 상태 "조회 전용". /api/demo/account/ensure는 없으면 계좌를 만들어버려서
// "이 사용자가 이미 참여 중인가?" 판별에는 쓸 수 없다. 여기서는 절대 생성하지 않는다.
export async function GET() {
  const supabaseServer = await createSupabaseServerClient();
  const { data: userData } = await supabaseServer.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ ok: true, loggedIn: false, hasAccount: false, account: null });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("virtual_accounts")
    .select("account_no, cash_balance, starting_cash")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: `DB 조회 실패: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    loggedIn: true,
    hasAccount: !!data,
    account: data
      ? { accountNo: data.account_no, cash: data.cash_balance, startingCash: data.starting_cash }
      : null,
  });
}
