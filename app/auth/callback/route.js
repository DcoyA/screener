import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

// 로그인한 사용자의 이메일이 report_subscribers 에 있고 아직 계정과 안 이어져
// 있으면 user_id 를 채운다(docs/migrations/20260828-report-subscribers-user-id.sql).
// 마이페이지의 "리포트 히스토리 / 구독 현황"이 이메일 문자열이 아니라 계정
// 기준으로 구독자를 판정할 수 있게 하는 지속 반영 지점.
// admin 클라이언트로 하는 이유: 이 테이블은 RLS로 일반 세션의 쓰기를 막아둔다.
// 실패해도 로그인 자체는 막지 않는다(로그만 남기고 진행).
async function linkSubscriberToAccount(user) {
  const email = user?.email?.trim().toLowerCase();
  if (!user?.id || !email) return;

  try {
    const admin = createSupabaseAdminClient();
    // subscribe 라우트가 이메일을 항상 소문자로 저장하므로 eq 로 충분하다.
    const { error } = await admin
      .from("report_subscribers")
      .update({ user_id: user.id })
      .eq("email", email)
      .is("user_id", null);
    if (error) console.error("report_subscribers.user_id 백필 실패:", error.message);
  } catch (e) {
    console.error("report_subscribers.user_id 백필 중 예외:", e);
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      await linkSubscriberToAccount(data.user);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
