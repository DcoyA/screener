import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

async function createOrder(payload) {
  const { accountId, pin, side, code, name, price, quantity, reason } = payload;

  if (!accountId || !pin) return { ok: false, error: "accountId와 pin이 필요합니다." };
  if (!code || !price || !quantity) return { ok: false, error: "종목코드, 가격, 수량이 필요합니다." };

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc("execute_virtual_order", {
    p_account_no: accountId,
    p_pin: pin,
    p_side: (side || "BUY").toLowerCase(),
    p_code: code,
    p_name: name || "",
    p_price: Number(price),
    p_quantity: Number(quantity),
    p_reason: reason || "",
  });

  if (error) {
    console.error("주문 처리 실패", error);
    return { ok: false, error: error.message || "주문 처리 실패" };
  }

  return {
    ok: true,
    order: { code, name, side: (side || "BUY").toUpperCase(), price: Number(price), quantity: Number(quantity), amount: Number(price) * Number(quantity), reason: reason || "" },
    account: { accountId: data.accountNo, cash: data.cashBalance },
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const payload = {
    accountId: searchParams.get("accountId"),
    pin: searchParams.get("pin"),
    side: searchParams.get("side") || "BUY",
    code: searchParams.get("code"),
    name: searchParams.get("name") || "",
    price: searchParams.get("price"),
    quantity: searchParams.get("quantity"),
    reason: searchParams.get("reason") || "",
  };
  const data = await createOrder(payload);
  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();
  const data = await createOrder(body);
  return NextResponse.json(data);
}
