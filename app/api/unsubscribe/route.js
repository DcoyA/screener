import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

// consent_logs.subscriber_id는 uuid 타입이라 report_subscribers.id(bigint)를 담을 수 없다.
// consent_logs에는 email/source 컬럼도 없어(action, subscriber_id, created_at 뿐) 누가 취소했는지는
// 남기지 못하고 action 발생 사실만 best-effort로 기록한다.
async function logConsent(action) {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("consent_logs").insert({ action });
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
    .select("id, status")
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

  await logConsent("unsubscribe");

  return NextResponse.json({ success: true, message: "구독이 취소되었습니다" });
}
