import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

const REPLAY_WINDOW_SECONDS = 60 * 5; // 슬랙 공식 문서 권장: 5분 초과 요청은 재전송 공격으로 간주해 거부
const GITHUB_REPO = "DcoyA/screener";

// 슬랙 "재시작" 버튼이 트리거할 수 있는 워크플로 (STEP 9).
// workflow_dispatch 로 통째로 재실행하지만, 각 수집 스크립트에 "오늘자 있으면
// exit 0" 멱등성 가드가 있어 실패 지점부터만 실제로 다시 돈다. 후보선택/승인의
// 사람 검수 게이트는 그대로 유지된다("재시작 → 메일 발송까지"는 구현 안 함).
const RETRY_WORKFLOW_ALLOWLIST = new Set([
  "premium-data-collect.yml",
  "premium-report-generate.yml",
  "premium-report-send.yml",
  "weekly-json-update.yml",
]);

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

// 원본 메시지 스레드가 아니라 채널에 별도 알림을 보낸다(에러성 안내용).
// SLACK_WEBHOOK_URL 은 Vercel 환경변수로 설정돼 있어야 하며, 없으면 조용히 넘어간다.
async function postSlackWebhook(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("SLACK_WEBHOOK_URL 미설정 - 별도 슬랙 알림을 건너뜁니다");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) console.error(`SLACK_WEBHOOK_URL 호출 실패: ${res.status}`);
  } catch (e) {
    console.error("SLACK_WEBHOOK_URL 호출 예외:", e);
  }
}

// [🔄 이 단계부터 재시작] 버튼. value = "<워크플로 파일명>|<run_id>".
// 화이트리스트 밖 파일명은 400으로 거절한다.
async function handleRetryWorkflow(action, responseUrl) {
  const rawValue = action?.value || "";
  const [workflowFile, runId] = rawValue.split("|");

  if (!workflowFile || !RETRY_WORKFLOW_ALLOWLIST.has(workflowFile)) {
    console.error(`[슬랙 인터랙션] 허용되지 않은 retry_workflow 대상: "${workflowFile}"`);
    return NextResponse.json(
      { ok: false, error: `허용되지 않은 워크플로: ${workflowFile || "(빈 값)"}` },
      { status: 400 }
    );
  }

  const dispatch = await triggerWorkflowDispatch(workflowFile);
  await replySlack(
    responseUrl,
    dispatch.ok
      ? `🔄 \`${workflowFile}\` 재시작을 요청했습니다. 멱등성 가드로 이미 끝난 단계는 건너뜁니다. (원본 run: ${runId || "-"})`
      : `⚠️ \`${workflowFile}\` 재시작 트리거 실패 (${dispatch.error || "원인 미상"}) - GitHub Actions에서 수동 실행해주세요.`
  );
  console.log(`[슬랙 인터랙션] retry_workflow ${workflowFile} (원본 run ${runId || "-"}) -> ${dispatch.ok ? "dispatched" : "실패"}`);
  return NextResponse.json({ ok: true });
}

// [무시] 버튼. 상태 변경 없이 알림만 정리한다.
async function handleIgnoreFailure(action, responseUrl) {
  const workflowFile = action?.value || "";
  await replySlack(responseUrl, `🙈 무시됨${workflowFile ? ` (\`${workflowFile}\`)` : ""}`);
  console.log(`[슬랙 인터랙션] ignore_failure ${workflowFile || "-"}`);
  return NextResponse.json({ ok: true });
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

// 초안 알림의 "빼고 발송할 섹션" 체크박스에서 선택된 인덱스(원본 sections 기준 0-based).
function readExcludedSections(payload) {
  const opts = payload?.state?.values?.exclude_sections_block?.exclude_sections_select?.selected_options || [];
  const seen = new Set();
  for (const o of opts) {
    const n = Number(o?.value);
    if (Number.isInteger(n) && n >= 0) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

// 승인 확정: excluded_sections 저장 → 상태 approved → 발송 워크플로 트리거.
async function finalizeApproval(supabase, reportId, excluded, responseUrl) {
  const { error } = await supabase
    .from("reports")
    .update({ status: "approved", excluded_sections: excluded })
    .eq("id", reportId);
  if (error) {
    console.error("reports 승인 업데이트 실패:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const exclNote = excluded.length > 0 ? ` (제외 섹션: ${excluded.map((i) => i + 1).join(", ")})` : "";
  const dispatch = await triggerWorkflowDispatch("premium-report-send.yml", { report_id: String(reportId) });
  if (dispatch.ok) {
    await replySlack(responseUrl, `✅ 승인됨 - 발송을 시작합니다${exclNote}`);
  } else {
    await replySlack(
      responseUrl,
      `⚠️ 승인은 됐지만 발송이 자동 시작되지 않았습니다 - 수동 실행 필요${exclNote} (${dispatch.error || "원인 미상"})`
    );
    await postSlackWebhook(
      `🔴 리포트 ${reportId} 승인됨 - 자동 발송 트리거 실패. premium-report-send.yml 을 report_id=${reportId} 로 수동 실행해주세요. (원인: ${dispatch.error || "원인 미상"})`
    );
  }
  console.log(`[슬랙 인터랙션] report ${reportId} -> approved, excluded=[${excluded.join(",")}]`);
  return NextResponse.json({ ok: true });
}

async function handleReportApprove(supabase, reportId, payload, responseUrl, { skipSingleConfirm = false } = {}) {
  const { data: report, error: fetchErr } = await supabase
    .from("reports")
    .select("content_json")
    .eq("id", reportId)
    .maybeSingle();
  if (fetchErr || !report) {
    console.error("reports 조회 실패(approve):", fetchErr);
    return NextResponse.json({ ok: false, error: "리포트를 찾을 수 없습니다" }, { status: 404 });
  }

  const total = (report.content_json?.sections || []).length;
  const excludedRaw = readExcludedSections(payload);
  // 범위 밖 인덱스는 버린다(섹션 수가 줄었거나 이상값).
  const excluded = excludedRaw.filter((i) => i < total);
  const remaining = total - excluded.length;

  // 가드 1: 전 섹션 제외 → 발송 차단. 상태 유지.
  if (total > 0 && remaining <= 0) {
    await replySlack(
      responseUrl,
      "⛔ 모든 섹션이 제외됐습니다. 발송할 내용이 없어 승인하지 않았습니다. 체크박스를 조정한 뒤 다시 승인해주세요."
    );
    return NextResponse.json({ ok: true });
  }

  // 가드 2: 남은 섹션 1개 → 한 번 더 확인. 재확인 버튼에 excluded 를 실어 보낸다.
  if (!skipSingleConfirm && total > 1 && remaining === 1) {
    const keptIdx = [...Array(total).keys()].find((i) => !excluded.includes(i));
    await replySlack(
      responseUrl,
      `⚠️ 섹션 ${excluded.length}개를 빼면 *${keptIdx + 1}번 섹션 1개만* 발송됩니다.\n` +
        `그래도 발송하려면 아래 버튼을 눌러주세요.`
    );
    // 원본 메시지를 대체했으므로 재확인 버튼을 별도 메시지로 남긴다.
    await fetch(responseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        replace_original: false,
        blocks: [
          {
            type: "actions",
            block_id: `report_confirm_${reportId}`,
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "1개 섹션으로 발송" },
                style: "primary",
                action_id: "approve_report_confirm_single",
                value: `${reportId}|${excluded.join(",")}`,
              },
            ],
          },
        ],
      }),
    });
    return NextResponse.json({ ok: true });
  }

  return finalizeApproval(supabase, reportId, excluded, responseUrl);
}

async function handleReportAction(supabase, actionId, reportId, payload, responseUrl) {
  if (actionId === "approve_report") {
    return handleReportApprove(supabase, reportId, payload, responseUrl);
  }

  const newStatus = REPORT_ACTION_TO_STATUS[actionId];
  const { error } = await supabase.from("reports").update({ status: newStatus }).eq("id", reportId);
  if (error) {
    console.error("reports 업데이트 실패:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (newStatus === "needs_revision") {
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
  // 200만 돌려준다 - 실제 처리는 제출/승인 버튼 클릭 시에만 한다.
  if (actionId === "select_candidates" || actionId === "exclude_sections_select") {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  let result;

  // Vercel 서버리스 함수는 응답을 반환한 뒤 백그라운드 실행을 보장하지 않으므로,
  // 응답 전에 DB 갱신 + workflow_dispatch + response_url 호출을 동기적으로
  // 끝낸다(슬랙의 3초 타임아웃 안에 들어와야 함).
  if (actionId === "retry_workflow") {
    result = await handleRetryWorkflow(action, responseUrl);
  } else if (actionId === "ignore_failure") {
    result = await handleIgnoreFailure(action, responseUrl);
  } else if (actionId === "generate_selected_candidates" || actionId === "skip_all_candidates") {
    result = await handleCandidateSelection(supabase, actionId, action, payload, responseUrl);
  } else if (actionId === "approve_report_confirm_single") {
    // "1개 섹션으로 발송" 재확인 버튼. value = "<reportId>|<제외인덱스,콤마>"
    const [reportId, exclCsv] = String(action?.value || "").split("|");
    if (!reportId) {
      return NextResponse.json({ ok: false, error: "report id 없음" }, { status: 400 });
    }
    const excluded = (exclCsv || "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0);
    result = await finalizeApproval(supabase, reportId, excluded, responseUrl);
  } else if (REPORT_ACTION_TO_STATUS[actionId]) {
    const value = action?.value;
    if (!value) {
      return NextResponse.json({ ok: false, error: "report id 없음" }, { status: 400 });
    }
    result = await handleReportAction(supabase, actionId, value, payload, responseUrl);
  } else {
    return NextResponse.json({ ok: false, error: "알 수 없는 action" }, { status: 400 });
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[슬랙 인터랙션] action=${actionId} 처리 시간 ${elapsedMs}ms`);

  return result;
}
