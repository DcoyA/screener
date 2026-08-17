import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

async function resetAccount() {
  const supabaseServer = await createSupabaseServerClient();
  const { data: userData } = await supabaseServer.auth.getUser();
  const user = userData.user;

  if (!user) {
    return { status: 401, body: { ok: false, error: "로그인이 필요합니다." } };
  }

  const supabase = createSupabaseAdminClient();

  const { data: account, error: accError } = await supabase
    .from("virtual_accounts")
    .select("id, starting_cash")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (accError) {
    return { status: 500, body: { ok: false, error: `계좌 확인 실패: ${accError.message}` } };
  }
  if (!account) {
    return { status: 200, body: { ok: false, error: "초기화할 가상계좌를 찾을 수 없습니다." } };
  }

  await supabase.from("virtual_holdings").delete().eq("account_id", account.id);
  await supabase.from("virtual_transactions").delete().eq("account_id", account.id);

  const { data: updated, error: updateError } = await supabase
    .from("virtual_accounts")
    .update({ cash_balance: account.starting_cash, status: "active" })
    .eq("id", account.id)
    .select()
    .single();

  if (updateError) {
    return { status: 500, body: { ok: false, error: `초기화 실패: ${updateError.message}` } };
  }

  return {
    status: 200,
    body: { ok: true, account: { accountNo: updated.account_no, cash: updated.cash_balance } },
  };
}

export async function POST() {
  const result = await resetAccount();
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET() {
  return POST();
}
