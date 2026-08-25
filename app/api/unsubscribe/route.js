import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

// consent_logs insert 실패는 구독취소 응답 자체에 영향을 주지 않는다.
async function logConsent(supabase, { action, email, reportSubscriberId }) {
  try {
    const { error } = await supabase
      .from("consent_logs")
      .insert({ action, email, source: "email_link", report_subscriber_id: reportSubscriberId });
    if (error) console.error("consent_logs insert 실패:", error);
  } catch (e) {
    console.error("consent_logs insert 중 예외:", e);
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;

  if (!token) {
    return NextResponse.json({ success: false, message: "유효하지 않은 링크입니다" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: subscriber, error: findError } = await supabase
    .from("report_subscribers")
    .select("id, email, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (findError) {
    console.error("report_subscribers 조회 실패:", findError);
    return NextResponse.json({ success: false, message: "처리 중 오류가 발생했습니다" }, { status: 500 });
  }

  if (!subscriber) {
    return NextResponse.json({ success: false, message: "유효하지 않은 링크입니다" }, { status: 404 });
  }

  if (subscriber.status === "unsubscribed") {
    return NextResponse.json({ success: true, message: "이미 구독 취소된 이메일입니다" });
  }

  const { error: updateError } = await supabase
    .from("report_subscribers")
    .update({ status: "unsubscribed" })
    .eq("id", subscriber.id);

  if (updateError) {
    console.error("report_subscribers 구독취소 업데이트 실패:", updateError);
    return NextResponse.json({ success: false, message: "처리 중 오류가 발생했습니다" }, { status: 500 });
  }

  await logConsent(supabase, { action: "unsubscribe", email: subscriber.email, reportSubscriberId: subscriber.id });

  return NextResponse.json({ success: true, message: "구독이 취소되었습니다" });
}
