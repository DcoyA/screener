import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

// 회원 탈퇴. 앱 데이터(관심종목·가상계좌 일체)를 먼저 지우고 마지막에 계정을
// 삭제한다. report_subscribers 는 건드리지 않는다 - 이메일 구독은 계정과 별개고
// user_id 는 ON DELETE SET NULL(마이그레이션)로 자동 해제된다.
//
// 클라이언트가 확인 문구를 보냈는지 서버에서도 한 번 더 검증한다(오작동 방지).
export async function POST(request) {
  const supabaseServer = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const confirm = String(body?.confirm || "").trim().toLowerCase();
  const expected = String(user.email || "").trim().toLowerCase();
  if (!expected || confirm !== expected) {
    return NextResponse.json({ ok: false, error: "확인 문구가 일치하지 않습니다." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    // 1) 관심종목
    await admin.from("wishlists").delete().eq("user_id", user.id);

    // 2) 가상계좌 + 그 하위(보유/거래) 이력
    const { data: accounts } = await admin
      .from("virtual_accounts")
      .select("id")
      .eq("user_id", user.id);
    const accountIds = (accounts || []).map((a) => a.id);
    if (accountIds.length) {
      await admin.from("virtual_holdings").delete().in("account_id", accountIds);
      await admin.from("virtual_transactions").delete().in("account_id", accountIds);
      await admin.from("virtual_accounts").delete().in("id", accountIds);
    }

    // 3) 마지막에 계정 자체
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      return NextResponse.json({ ok: false, error: `계정 삭제 실패: ${delErr.message}` }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: `탈퇴 처리 중 오류: ${e?.message || e}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
