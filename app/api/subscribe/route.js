import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ success: false, error: "올바른 이메일 주소를 입력해주세요." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: existing, error: checkError } = await supabase
    .from("subscribers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (checkError) {
    console.error("subscribers 중복확인 실패:", checkError);
    return NextResponse.json({ success: false, error: checkError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ success: true, message: "이미 신청된 이메일입니다" });
  }

  const { error: insertError } = await supabase.from("subscribers").insert({
    email,
    consent_status: "active",
    tier: "beginner",
    consented_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("subscribers insert 실패:", insertError);
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
