import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { getSubscriberForSession, isActiveSubscriber } from "../../../lib/subscription";

// 마이페이지 "리포트 히스토리" 목록.
// 구독 상태를 서버에서 검증한다 - 비구독이면 목록을 응답에 아예 싣지 않는다
// (클라이언트에서 숨기기만 하면 URL 직접 접근으로 샌다).
// 활성 구독자면 status='sent' 리포트 전부(가입 시점 무관). 본문 열람 권한은
// /reports/[id]가 resolveReportAccess로 리포트별로 다시 판정한다.
export async function GET() {
  const { user, subscriber } = await getSubscriberForSession();

  if (!user) {
    return NextResponse.json({ ok: true, loggedIn: false, isSubscriber: false, reports: [] });
  }

  if (!isActiveSubscriber(subscriber)) {
    return NextResponse.json({
      ok: true,
      loggedIn: true,
      isSubscriber: false,
      subscriberStatus: subscriber?.status ?? null,
      reports: [],
    });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("reports")
    .select("id, issue_date, topic_title")
    .eq("status", "sent")
    .order("issue_date", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    loggedIn: true,
    isSubscriber: true,
    reports: (data || []).map((r) => ({ id: r.id, issueDate: r.issue_date, title: r.topic_title })),
  });
}
