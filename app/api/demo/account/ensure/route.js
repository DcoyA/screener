// app/api/demo/account/ensure/route.js
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

function generateAccountNo() {
  return "DEMO" + Math.floor(100000 + Math.random() * 900000);
}

export async function GET() {
  const supabaseServer = await createSupabaseServerClient();
  const { data: userData } = await supabaseServer.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: existing, error: selectError } = await supabase
    .from("virtual_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ ok: false, error: `DB 조회 실패: ${selectError.message}` }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ ok: true, account: { accountNo: existing.account_no, cash: existing.cash_balance } });
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
    .insert({ user_id: user.id, account_no: accountNo, starting_cash: 100000000, cash_balance: 100000000, status: "active" })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ ok: false, error: `계정 생성 실패: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, account: { accountNo: created.account_no, cash: created.cash_balance } });
}

export async function POST() {
  return GET();
}
