import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getGradeCodeForOrder } from "../../../../lib/gradeLookup";

async function handleOrder(body) {
  const { side, code, name, price, quantity, reason } = body;

  if (!code || !price || !quantity) {
    return { status: 400, body: { ok: false, error: "종목코드, 가격, 수량을 확인해주세요." } };
  }

  const supabaseServer = await createSupabaseServerClient();
  const { data: userData } = await supabaseServer.auth.getUser();
  const user = userData.user;

  if (!user) {
    return { status: 401, body: { ok: false, error: "로그인이 필요합니다." } };
  }

  const gradeCode = await getGradeCodeForOrder(code);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("execute_virtual_order", {
    p_user_id: user.id,
    p_side: (side || "BUY").toLowerCase(),
    p_code: code,
    p_name: name || "",
    p_price: Number(price),
    p_quantity: Number(quantity),
    p_reason: reason || "",
    p_grade_code: gradeCode,
  });

  if (error) {
    return { status: 400, body: { ok: false, error: error.message || "주문 처리 실패" } };
  }

  const result = Array.isArray(data) ? data[0] : data;

  return {
    status: 200,
    body: {
      ok: true,
      order: {
        code,
        name: name || "",
        side: (side || "BUY").toUpperCase(),
        price: Number(price),
        quantity: Number(quantity),
        amount: Number(price) * Number(quantity),
        reason: reason || "",
        gradeCode,
      },
      account: { accountId: result?.accountNo, cash: result?.cashBalance },
    },
  };
}

export async function POST(request) {
  const body = await request.json();
  const result = await handleOrder(body);
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const result = await handleOrder({
    side: searchParams.get("side") || "BUY",
    code: searchParams.get("code"),
    name: searchParams.get("name") || "",
    price: searchParams.get("price"),
    quantity: searchParams.get("quantity"),
    reason: searchParams.get("reason") || "",
  });
  return NextResponse.json(result.body, { status: result.status });
}
