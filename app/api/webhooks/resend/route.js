import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

function isValidSvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret) {
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuffer = Buffer.from(expectedSignature, "base64");

  const providedSignatures = svixSignature
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean);

  return providedSignatures.some((sig) => {
    try {
      const sigBuffer = Buffer.from(sig, "base64");
      return sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  });
}

export async function POST(request) {
  const rawBody = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (secret) {
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!isValidSvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret)) {
      return NextResponse.json({ ok: false, error: "서명 검증 실패" }, { status: 401 });
    }
  } else {
    console.log("[웹훅] RESEND_WEBHOOK_SECRET 미설정, 서명 검증 생략");
  }

  // Resend 재시도 폭주를 막기 위해 처리 중 내부 에러는 항상 200으로 흡수하고 로그만 남긴다.
  try {
    const event = JSON.parse(rawBody);
    const tags = event?.data?.tags || [];
    const reportIdTag = tags.find((t) => t.name === "report_id");
    const reportId = reportIdTag ? parseInt(reportIdTag.value, 10) : null;

    if (reportId !== null && !Number.isNaN(reportId)) {
      const supabase = createSupabaseAdminClient();

      if (event.type === "email.opened") {
        const { error } = await supabase.rpc("increment_send_log_open", { p_report_id: reportId });
        if (error) console.error("increment_send_log_open 실패:", error);
      } else if (event.type === "email.clicked") {
        const { error } = await supabase.rpc("increment_send_log_click", { p_report_id: reportId });
        if (error) console.error("increment_send_log_click 실패:", error);
      }
    }
  } catch (e) {
    console.error("[웹훅] 이벤트 처리 중 예외:", e);
  }

  return NextResponse.json({ ok: true });
}
