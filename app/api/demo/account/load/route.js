import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

async function loadAccount(accountId, pin) {
  if (!accountId || !pin) return { ok: false, error: "accountId와 pin이 필요합니다." };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("virtual_accounts")
    .select("*")
    .eq("account_no", accountId)
    .eq("pin", pin)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return { ok: false, error: "계좌를 찾을 수 없습니다." };

  return {
    ok: true,
    account: { accountId: data.account_no, pin: data.pin, cash: data.cash_balance },
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const data = await loadAccount(searchParams.get("accountId"), searchParams.get("pin"));
  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();
  const data = await loadAccount(body.accountId, body.pin);
  return NextResponse.json(data);
}
