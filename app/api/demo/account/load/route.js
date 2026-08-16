import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const pin = searchParams.get("pin");

    if (!accountId || !pin) {
      return NextResponse.json({ ok: false, error: "accountId와 pin이 필요합니다." });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("virtual_accounts")
      .select("*")
      .eq("account_no", accountId)
      .eq("pin", pin)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      console.error("load account query error:", error);
      return NextResponse.json({ ok: false, error: `DB 조회 실패: ${error.message}` });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "계좌를 찾을 수 없습니다." });
    }

    return NextResponse.json({
      ok: true,
      account: { accountId: data.account_no, pin: data.pin, cash: data.cash_balance },
    });
  } catch (error) {
    console.error("account/load fatal error:", error);
    return NextResponse.json(
      { ok: false, error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    url.searchParams.set("accountId", body.accountId || "");
    url.searchParams.set("pin", body.pin || "");
    return GET(new Request(url, { method: "GET" }));
  } catch (error) {
    console.error("account/load POST fatal error:", error);
    return NextResponse.json(
      { ok: false, error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
}
