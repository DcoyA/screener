// app/api/demo/order/create/route.js
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

async function handleOrder(body) {
  const { side, code, name, price, quantity, reason } = body;

  if (!code || !price || !quantity) {
    return NextResponse.json({ ok: false, error: "종목코드, 가격, 수량을 확인해주세요." }, { status: 400 });
  }

  const supabaseServer = await createSupabaseServerClient();
  const { data: userData } = await supabaseServer.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("execute_virtual_order", {
    p_user_id: user.id,
    p_side: (side || "BUY").toLowerCase(),
    p_code: code,
    p_name: name || "",
    p_price: Number(price),
    p_quantity: Number(quantity),
    p_reason: reason || "",
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message || "주문 처리 실패" }, { status: 400 });
  }

  const result = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    ok: true,
    order: { code, name, side: (side || "BUY").toUpperCase(), price: Number(price), quantity: Number(quantity), amount: Number(price) * Number(quantity), reason: reason || "" },
    account: { accountId: result?.accountNo, cash: result?.cashBalance },
  });
}

export async function POST(request) {
  const body = await request.json();
  return handleOrder(body);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return handleOrder({
    side: searchParams.get("side") || "BUY",
    code: searchParams.get("code"),
    name: searchParams.get("name") || "",
    price: searchParams.get("price"),
    quantity: searchParams.get("quantity"),
    reason: searchParams.get("reason") || "",
  });
}
