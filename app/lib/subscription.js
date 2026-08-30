import { createSupabaseServerClient } from "./supabase/server";
import { createSupabaseAdminClient } from "./supabase/admin";

// 프리미엄 구독 판정의 단일 창구(계정 기준). report_subscribers 는 결제 없는
// 이메일 리스트지만, docs/migrations/20260828-report-subscribers-user-id.sql 로
// user_id 를 이어붙였으므로 로그인 사용자 → 구독행을 계정으로 조회한다.
// user_id 가 아직 안 채워진 옛 가입자는 이메일로 폴백한다(로그인 콜백이 다음
// 로그인 때 user_id 를 채운다).
//
// admin 클라이언트로 읽는 이유: report_subscribers 는 RLS로 일반 세션 접근을
// 막아둔다. 서버 컴포넌트 / route handler 에서만 호출할 것.

const SUBSCRIBER_COLUMNS =
  "id, email, status, plan, source, last_sent_at, last_report_id, unsubscribe_token, user_id, created_at";

export async function getSubscriberForSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, subscriber: null };

  const admin = createSupabaseAdminClient();

  let { data: subscriber } = await admin
    .from("report_subscribers")
    .select(SUBSCRIBER_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscriber && user.email) {
    ({ data: subscriber } = await admin
      .from("report_subscribers")
      .select(SUBSCRIBER_COLUMNS)
      .eq("email", user.email.trim().toLowerCase())
      .maybeSingle());
  }

  return { user, subscriber: subscriber || null };
}

export function isActiveSubscriber(subscriber) {
  return subscriber?.status === "active";
}
