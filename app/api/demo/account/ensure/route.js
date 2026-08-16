import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

function generateAccountNo() {
  return "DEMO" + Math.floor(100000 + Math.random() * 900000);
}

async function ensureAccount() {
  const supabaseServer = await createSupabaseServerClient();
  const { data: userData } = await supabaseServer.auth.getUser();
  const user = userData.user;

  if (!user) {
    return { status: 401, body: { ok: false, error: "로그인이 필요합니다." } };
  }

  const supabase = createSupabaseAdminClient();

  const { data: existing, error: selectError } = await supabase
    .from("virtual_accounts")
    .select("account_no, cash_balance")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (selectError) {
    return { status: 500, body: { ok: false, error: `DB 조회 실패: ${selectError.message}` } };
  }

  if (existing) {
    return { status: 200, body: { ok: true, account: { accountNo: existing.account_no, cash: existing.cash_balance } } };
  }

  let accountNo = generateAccountNo();
  for (let i = 0; i < 5; i++) {
    const { data: dup } = await supabase
      .from("virtual_accounts")
      .select("id")
      .eq("account_no", accountNo)
      .maybeSingle();
    if (!dup) break;
    accountNo = generateAccountNo();
  }

  const { data: created, error: insertError } = await supabase
    .from("virtual_accounts")
    .insert({
      user_id: user.id,
      account_no: accountNo,
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      starting_cash: 100000000,
      cash_balance: 100000000,
      status: "active",
    })
    .select()
    .single();

  if (insertError) {
    return { status: 500, body: { ok: false, error: `계정 생성 실패: ${insertError.message}` } };
  }

  return { status: 200, body: { ok: true, account: { accountNo: created.account_no, cash: created.cash_balance } } };
}

export async function GET() {
  const result = await ensureAccount();
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST() {
  return GET();
}
