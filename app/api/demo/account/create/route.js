import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

function generateAccountNo() {
  return "DEMO" + Math.floor(100000 + Math.random() * 900000);
}

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function createAccount() {
  const supabase = createSupabaseAdminClient();

  let accountNo = generateAccountNo();
  const pin = generatePin();

  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from("virtual_accounts")
      .select("id")
      .eq("account_no", accountNo)
      .maybeSingle();
    if (!existing) break;
    accountNo = generateAccountNo();
  }

  const { data, error } = await supabase
    .from("virtual_accounts")
    .insert({ account_no: accountNo, pin, starting_cash: 100000000, cash_balance: 100000000 })
    .select()
    .single();

  if (error) {
    console.error("계좌 생성 실패", error);
    return { ok: false, error: "가상계좌 생성 실패" };
  }

  return {
    ok: true,
    account: { accountId: data.account_no, pin: data.pin, cash: data.cash_balance },
  };
}

export async function GET() {
  const data = await createAccount();
  return NextResponse.json(data);
}

export async function POST() {
  const data = await createAccount();
  return NextResponse.json(data);
}
