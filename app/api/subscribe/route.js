import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createUnsubscribeToken(emailValue) {
  const safeEmail = emailValue.replace(/[^a-z0-9]/gi, "");
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `sub_${safeEmail.slice(0, 12)}_${Date.now()}_${randomPart}`;
}

// consent_logs insert 실패는 구독 응답 자체에 영향을 주지 않는다.
async function logConsent(supabase, { action, email, source, reportSubscriberId }) {
  try {
    const { error } = await supabase
      .from("consent_logs")
      .insert({ action, email, source, report_subscriber_id: reportSubscriberId });
    if (error) console.error("consent_logs insert 실패:", error);
  } catch (e) {
    console.error("consent_logs insert 중 예외:", e);
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ success: false, error: "올바른 이메일 주소를 입력해주세요." }, { status: 400 });
  }

  const source = body?.source || "site_popup";

  const supabase = createSupabaseAdminClient();

  const { data: existing, error: checkError } = await supabase
    .from("report_subscribers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (checkError) {
    console.error("report_subscribers 중복확인 실패:", checkError);
    return NextResponse.json({ success: false, error: checkError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ success: true, message: "이미 신청된 이메일입니다" });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("report_subscribers")
    .insert({
      email,
      plan: "premium",
      status: "active",
      source,
      unsubscribe_token: createUnsubscribeToken(email),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("report_subscribers insert 실패:", insertError);
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  await logConsent(supabase, { action: "subscribe", email, source, reportSubscriberId: inserted.id });

  return NextResponse.json({ success: true });
}
