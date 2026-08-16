import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

async function loadOrders() {
  const supabaseServer = await createSupabaseServerClient();
  const { data: userData } = await supabaseServer.auth.getUser();
  const user = userData.user;

  if (!user) {
    return { status: 401, body: { ok: false, error: "로그인이 필요합니다." } };
  }

  const supabase = createSupabaseAdminClient();

  const { data: account, error: accError } = await supabase
    .from("virtual_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (accError) {
    return { status: 500, body: { ok: false, error: `계정 확인 실패: ${accError.message}` } };
  }
  if (!account) {
    return { status: 200, body: { ok: false, error: "가상계좌를 찾을 수 없습니다." } };
  }

  const { data: rows, error } = await supabase
    .from("virtual_transactions")
    .select("*")
    .eq("account_id", account.id)
    .order("executed_at", { ascending: true });

  if (error) {
    return { status: 500, body: { ok: false, error: `주문 목록 조회 실패: ${error.message}` } };
  }

  const orders = (rows || []).map((row) => ({
    orderId: row.id,
    code: row.code,
    name: row.name,
    side: row.side === "buy" ? "BUY" : "SELL",
    price: row.price,
    quantity: row.quantity,
    amount: row.amount,
    reason: row.reason,
    createdAt: row.executed_at,
  }));

  return { status: 200, body: { ok: true, orders } };
}

export async function GET() {
  const result = await loadOrders();
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST() {
  return GET();
}
