import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

const REPLAY_WINDOW_SECONDS = 60 * 5; // 슬랙 공식 문서 권장: 5분 초과 요청은 재전송 공격으로 간주해 거부
const GITHUB_REPO = "DcoyA/screener";

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

// 승인 즉시 다음 단계 워크플로를 돌린다(후보 선택 -> 생성, 리포트 승인 -> 발송).
// GH_PAT이 없거나 GitHub API 호출이 실패해도 DB 상태 갱신 자체는 이미 끝난
// 뒤라, 실패를 삼키고 슬랙 안내 문구만 바꿔서 에디터가 수동으로 워크플로를
// 돌릴 수 있게 한다(자동 트리거는 편의 기능이지 승인 자체의 필요조건이 아님).
async function triggerWorkflowDispatch(workflowFileName, inputs = {}) {
  const token = process.env.GH_PAT;
  if (!token) {
    console.error("GH_PAT 미설정 - workflow_dispatch 트리거를 건너뜁니다");
    return { ok: false, error: "GH_PAT 미설정" };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflowFileName}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main", inputs }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`workflow_dispatch(${workflowFileName}) 실패: ${res.status} - ${text}`);
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (e) {
    console.error(`workflow_dispatch(${workflowFileName}) 예외:`, e);
    return { ok: false, error: e.message };
  }
}

async function replySlack(responseUrl, text) {
  if (!responseUrl) return;
  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ replace_original: true, text }),
  });
  if (!res.ok) {
    console.error(`response_url 호출 실패: ${res.status}`);
  }
}

// notify-editor.mjs가 체크박스 + "선택한 항목으로 초안 생성"/"전체 스킵"
// 버튼 하나씩을 함께 보낸다. 버튼의 value에는 이 메시지에 있던 후보 id
// 전체를 콤마로 실어 보낸다(체크박스 선택분과 대조해 "선택 안 된 나머지"를
// rejected로 갱신하기 위함 - 체크박스 자체엔 "이 메시지의 전체 후보 목록"이
// 담겨있지 않음).
async function handleCandidateSelection(supabase, actionId, action, payload, responseUrl) {
  const allIds = (action?.value || "").split(",").filter(Boolean);

  if (actionId === "skip_all_candidates") {
    if (allIds.length > 0) {
      const { error } = await supabase.from("topic_candidates").update({ status: "rejected" }).in("id", allIds);
      if (error) {
        console.error("topic_candidates 업데이트 실패:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }
    await replySlack(responseUrl, "❌ 전체 스킵됨");
    console.log(`[슬랙 인터랙션] candidates [${allIds.join(",")}] -> rejected(전체 스킵)`);
    return NextResponse.json({ ok: true });
  }

  // generate_selected_candidates: 체크박스 상태는 버튼 클릭 시점의
  // payload.state.values에서 읽는다(체크박스 토글 자체는 별도 처리 없음).
  const checkboxState = payload?.state?.values?.candidate_checkboxes?.select_candidates;
  const selectedIds = (checkboxState?.selected_options || []).map((o) => o.value);
  const rejectedIds = allIds.filter((id) => !selectedIds.includes(id));

  if (selectedIds.length > 0) {
    const { error } = await supabase.from("topic_candidates").update({ status: "selected" }).in("id", selectedIds);
    if (error) {
      console.error("topic_candidates 업데이트 실패(selected):", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }
  if (rejectedIds.length > 0) {
    const { error } = await supabase.from("topic_candidates").update({ status: "rejected" }).in("id", rejectedIds);
    if (error) {
      // selected 갱신은 이미 끝났으므로, 나머지 거부 처리 실패로 생성 자체를
      // 막을 이유는 없다 - 로그만 남기고 계속 진행한다.
      console.error("topic_candidates 업데이트 실패(rejected, 무시하고 진행):", error);
    }
  }

  if (selectedIds.length === 0) {
    await replySlack(responseUrl, "선택된 후보가 없어 리포트 생성을 시작하지 않았습니다");
    return NextResponse.json({ ok: true });
  }

  const dispatch = await triggerWorkflowDispatch("premium-report-generate.yml");
  await replySlack(
    responseUrl,
    dispatch.ok
      ? `✅ ${selectedIds.length}건 선택 - 리포트 생성을 시작합니다`
      : `✅ ${selectedIds.length}건 선택 (자동 생성 트리거 실패 - Generate 워크플로를 수동으로 실행해주세요)`
  );

  console.log(`[슬랙 인터랙션] 선택 ${selectedIds.length}건 -> selected, 나머지 ${rejectedIds.length}건 -> rejected`);
  return NextResponse.json({ ok: true });
}

const REPORT_ACTION_TO_STATUS = {
  approve_report: "approved",
  request_report_revision: "needs_revision",
  discard_report: "discarded",
};

async function handleReportAction(supabase, actionId, reportId, responseUrl) {
  const newStatus = REPORT_ACTION_TO_STATUS[actionId];

  const { error } = await supabase.from("reports").update({ status: newStatus }).eq("id", reportId);
  if (error) {
    console.error("reports 업데이트 실패:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (newStatus === "approved") {
    const dispatch = await triggerWorkflowDispatch("premium-report-send.yml", { report_id: String(reportId) });
    await replySlack(
      responseUrl,
      dispatch.ok
        ? "✅ 승인됨 - 발송을 시작합니다"
        : "✅ 승인됨 (자동 발송 트리거 실패 - Send 워크플로를 수동으로 실행해주세요)"
    );
  } else if (newStatus === "needs_revision") {
    await replySlack(
      responseUrl,
      "✏️ 수정 필요로 표시했습니다. Supabase에서 reports.content_json을 직접 수정한 뒤 status를 draft로 되돌리고 다시 검수 요청해주세요."
    );
  } else {
    await replySlack(responseUrl, "❌ 폐기됨");
  }

  console.log(`[슬랙 인터랙션] report ${reportId} -> ${newStatus}`);
  return NextResponse.json({ ok: true });
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
  const responseUrl = payload?.response_url;

  // 체크박스 토글 자체(각 클릭마다 슬랙이 보냄)는 상태 갱신 없이 그냥
  // 200만 돌려준다 - 실제 처리는 제출 버튼 클릭 시에만 한다.
  if (actionId === "select_candidates") {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  let result;

  // Vercel 서버리스 함수는 응답을 반환한 뒤 백그라운드 실행을 보장하지 않으므로,
  // 응답 전에 DB 갱신 + workflow_dispatch + response_url 호출을 동기적으로
  // 끝낸다(슬랙의 3초 타임아웃 안에 들어와야 함).
  if (actionId === "generate_selected_candidates" || actionId === "skip_all_candidates") {
    result = await handleCandidateSelection(supabase, actionId, action, payload, responseUrl);
  } else if (REPORT_ACTION_TO_STATUS[actionId]) {
    const value = action?.value;
    if (!value) {
      return NextResponse.json({ ok: false, error: "report id 없음" }, { status: 400 });
    }
    result = await handleReportAction(supabase, actionId, value, responseUrl);
  } else {
    return NextResponse.json({ ok: false, error: "알 수 없는 action" }, { status: 400 });
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[슬랙 인터랙션] action=${actionId} 처리 시간 ${elapsedMs}ms`);

  return result;
}
