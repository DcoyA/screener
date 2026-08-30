import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { getSubscriberForSession, isActiveSubscriber } from "../../../lib/subscription";

// 마이페이지(모달 + /me) 한 번 fetch. 내 정보 + 구독 현황 + (활성 구독자면)
// 리포트 히스토리 목록. 구독 검증은 서버에서 - 비구독이면 reports 를 응답에
// 아예 싣지 않는다.
export async function GET() {
  const { user, subscriber } = await getSubscriberForSession();

  if (!user) {
    return NextResponse.json({ ok: true, loggedIn: false, user: null, subscription: null, reports: [] });
  }

  const provider = user.app_metadata?.provider || user.identities?.[0]?.provider || null;
  const userInfo = {
    email: user.email || null,
    createdAt: user.created_at || null,
    provider,
  };

  const active = isActiveSubscriber(subscriber);
  const subscription = {
    isSubscriber: active,
    status: subscriber?.status ?? null,
    lastSentAt: subscriber?.last_sent_at ?? null,
    // /unsubscribe 는 token 하나만 받는다(app/unsubscribe/page.js).
    unsubscribeUrl: subscriber?.unsubscribe_token
      ? `/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe_token)}`
      : null,
  };

  let reports = [];
  if (active) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("reports")
      .select("id, issue_date, topic_title")
      .eq("status", "sent")
      .order("issue_date", { ascending: false });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    reports = (data || []).map((r) => ({ id: r.id, issueDate: r.issue_date, title: r.topic_title }));
  }

  return NextResponse.json({ ok: true, loggedIn: true, user: userInfo, subscription, reports });
}
