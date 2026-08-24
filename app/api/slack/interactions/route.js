import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

const REPLAY_WINDOW_SECONDS = 60 * 5; // 슬랙 공식 문서 권장: 5분 초과 요청은 재전송 공격으로 간주해 거부

function isValidSlackSignature(rawBody, timestamp, signature, signingSecret) {
  if (!timestamp || !signature || !signingSecret) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > REPLAY_WINDOW_SECONDS) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex");
  const computedSignature = `v0=${hmac}`;

  const sigBuffer = Buffer.from(signature);
  const computedBuffer = Buffer.from(computedSignature);
  if (sigBuffer.length !== computedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, computedBuffer);
}

export async function POST(request) {
  const startedAt = Date.now();

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!isValidSlackSignature(rawBody, timestamp, signature, signingSecret)) {
    return NextResponse.json({ ok: false, error: "서명 검증 실패" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const payloadRaw = params.get("payload");
  const payload = payloadRaw ? JSON.parse(payloadRaw) : null;
  const action = payload?.actions?.[0];
  const actionId = action?.action_id;
  const candidateId = action?.value;

  const newStatus =
    actionId === "approve_candidate" ? "selected" :
    actionId === "reject_candidate" ? "rejected" :
    null;

  if (!newStatus || !candidateId) {
    return NextResponse.json({ ok: false, error: "알 수 없는 action" }, { status: 400 });
  }

  // Vercel 서버리스 함수는 응답을 반환한 뒤 백그라운드 실행을 보장하지 않으므로,
  // 응답 전에 DB 갱신과 response_url 호출을 동기적으로 끝낸다(슬랙의 3초 타임아웃 안에 들어와야 함).
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("topic_candidates")
    .update({ status: newStatus })
    .eq("id", candidateId);

  if (error) {
    console.error("topic_candidates 업데이트 실패:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (payload.response_url) {
    const replacementText = newStatus === "selected" ? "✅ 승인됨" : "❌ 거부됨";
    const res = await fetch(payload.response_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ replace_original: true, text: replacementText }),
    });
    if (!res.ok) {
      console.error(`response_url 호출 실패: ${res.status}`);
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[슬랙 인터랙션] candidate ${candidateId} -> ${newStatus}, 처리 시간 ${elapsedMs}ms`);

  return NextResponse.json({ ok: true });
}
