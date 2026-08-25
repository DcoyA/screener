import { createClient } from "@supabase/supabase-js";
import { kstTodayStr } from "./lib/date.mjs";

// TODO: 실제 도메인 인증 후 발신 주소 교체
const FROM_ADDRESS = "onboarding@resend.dev";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchTodayDraftReports() {
  const today = kstTodayStr();
  const { data, error } = await supabase
    .from("reports")
    .select("id, topic_title, html_body")
    .eq("issue_date", today)
    .eq("status", "draft");

  if (error) {
    console.error("reports 조회 실패:", error);
    process.exit(1);
  }
  return data;
}

async function fetchActiveSubscriberEmails() {
  const { data, error } = await supabase
    .from("subscribers")
    .select("email")
    .not("email", "is", null)
    .eq("consent_status", "active");

  if (error) {
    console.error("subscribers 조회 실패:", error);
    process.exit(1);
  }
  return data.map((row) => row.email);
}

async function sendOneEmail(to, subject, htmlBody) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, status: res.status, error: errText };
  }
  return { ok: true };
}

async function sendReportToSubscribers(report, emails) {
  let successCount = 0;

  for (const email of emails) {
    const result = await sendOneEmail(email, report.topic_title, report.html_body);
    if (result.ok) {
      successCount += 1;
    } else {
      console.error(`이메일 발송 실패 (${email}): ${result.status} - ${result.error}`);
      if (result.status === 401) {
        console.error("Resend API 인증 실패(401)로 발송을 중단합니다.");
        process.exit(1);
      }
    }
  }

  return successCount;
}

async function recordSendLog(reportId, successCount) {
  // recipient_count가 개인정보(수신자 목록)가 아니라 집계값이므로 그대로 기록한다
  const report = await supabase
    .from("reports")
    .select("topic_title")
    .eq("id", reportId)
    .single();

  const summaryText = report.data?.topic_title || "";

  const { error } = await supabase.from("send_logs").insert({
    report_id: reportId,
    channel: "email",
    sent_at: new Date().toISOString(),
    recipient_count: successCount,
    open_count: 0,
    click_count: 0,
    summary_text: summaryText,
  });

  if (error) {
    console.error("send_logs 저장 실패 (원문):");
    console.error(`code: ${error.code}`);
    console.error(`message: ${error.message}`);
    console.error(`details: ${error.details}`);
    console.error(`hint: ${error.hint}`);
    return false;
  }
  return true;
}

async function markReportAsSent(reportId) {
  const { error } = await supabase.from("reports").update({ status: "sent" }).eq("id", reportId);
  if (error) {
    console.error("reports.status 업데이트 실패:", error);
    return false;
  }
  return true;
}

async function processReport(report, emails) {
  if (emails.length === 0) {
    console.log(`[발송] 발송 대상 구독자가 없어 report_id=${report.id} 발송을 스킵합니다`);
    return;
  }

  const successCount = await sendReportToSubscribers(report, emails);

  const logSaved = await recordSendLog(report.id, successCount);
  if (!logSaved) {
    console.error(`[발송] report_id=${report.id} send_logs 저장 실패로 status 업데이트를 건너뜁니다`);
    return;
  }

  await markReportAsSent(report.id);

  console.log(
    `[발송] report_id=${report.id}, 성공 ${successCount}건 / 전체 ${emails.length}건, status를 sent로 업데이트 완료`
  );
}

async function main() {
  const reports = await fetchTodayDraftReports();

  if (reports.length === 0) {
    console.log("[발송] 오늘 발송할 draft 상태의 리포트가 없습니다");
    return;
  }

  const emails = await fetchActiveSubscriberEmails();

  for (const report of reports) {
    await processReport(report, emails);
  }
}

main();
