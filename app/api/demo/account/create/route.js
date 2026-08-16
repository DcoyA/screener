import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

function generateAccountNo() {
  return "DEMO" + Math.floor(100000 + Math.random() * 900000);
}
function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function createAccount() {
  try {
    const supabase = createSupabaseAdminClient();

    let accountNo = generateAccountNo();
    const pin = generatePin();

    for (let i = 0; i < 5; i++) {
      const { data: existing, error: checkError } = await supabase
        .from("virtual_accounts")
        .select("id")
        .eq("account_no", accountNo)
        .maybeSingle();
      if (checkError) {
        console.error("account_no 중복확인 실패:", checkError);
        return { ok: false, error: `DB 확인 실패: ${checkError.message}` };
      }
      if (!existing) break;
      accountNo = generateAccountNo();
    }

    const { data, error } = await supabase
      .from("virtual_accounts")
      .insert({ account_no: accountNo, pin, starting_cash: 100000000, cash_balance: 100000000 })
      .select()
      .single();

    if (error) {
      console.error("계좌 생성 실패:", error);
      return { ok: false, error: `계좌 생성 실패: ${error.message}` };
    }

    return {
      ok: true,
      account: { accountId: data.account_no, pin: data.pin, cash: data.cash_balance },
    };
  } catch (error) {
    console.error("account/create fatal error:", error);
    return { ok: false, error: `서버 오류: ${error.message}` };
  }
}

export async function GET() {
  const data = await createAccount();
  return NextResponse.json(data);
}
export async function POST() {
  const data = await createAccount();
  return NextResponse.json(data);
}
