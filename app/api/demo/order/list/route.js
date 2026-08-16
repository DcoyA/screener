import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

async function loadOrders(accountId, pin) {
  if (!accountId || !pin) return { ok: false, error: "accountId와 pin이 필요합니다." };

  const supabase = createSupabaseAdminClient();
  const { data: account, error: accError } = await supabase
    .from("virtual_accounts")
    .select("id")
    .eq("account_no", accountId)
    .eq("pin", pin)
    .maybeSingle();

  if (accError || !account) return { ok: false, error: "계좌를 찾을 수 없습니다." };

  const { data: rows, error } = await supabase
    .from("virtual_transactions")
    .select("*")
    .eq("account_id", account.id)
    .order("executed_at", { ascending: true });

  if (error) return { ok: false, error: "주문 목록 조회 실패" };

  const orders = (rows || []).map((row) => ({
    code: row.code,
    name: row.name,
    side: row.side === "buy" ? "BUY" : "SELL",
    price: row.price,
    quantity: row.quantity,
    amount: row.amount,
    reason: row.reason,
    executedAt: row.executed_at,
  }));

  return { ok: true, orders };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const data = await loadOrders(searchParams.get("accountId"), searchParams.get("pin"));
  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();
  const data = await loadOrders(body.accountId, body.pin);
  return NextResponse.json(data);
}
