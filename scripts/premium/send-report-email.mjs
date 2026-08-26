import { createClient } from "@supabase/supabase-js";
import { kstTodayStr } from "./lib/date.mjs";

// TODO: 실제 도메인 인증 후 발신 주소 교체
const FROM_ADDRESS = "onboarding@resend.dev";

const SITE_URL = "https://www.hellomedia.win/";
const UNSUBSCRIBE_BASE_URL = "https://www.hellomedia.win/unsubscribe";
// app/reports는 기존 무료 스크리너 리포트 페이지가 이미 쓰고 있어(app/reports/page.js),
// 프리미엄 아카이브는 충돌을 피해 /premium/reports 경로를 쓴다.
const WEBVIEW_BASE_URL = "https://www.hellomedia.win/premium/reports";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// report_id가 지정되면 그 리포트 하나만(승인된 상태인지도 재확인) 발송한다.
// 지정 없으면 오늘 issue_date의 approved 리포트를 찾는다(정상 경로에선
// 하루 1건만 존재 - generate-report.mjs가 issue_date당 1건으로 막아둠).
async function fetchApprovedReports(reportId) {
  let query = supabase.from("reports").select("id, topic_title, html_body").eq("status", "approved");

  query = reportId ? query.eq("id", reportId) : query.eq("issue_date", kstTodayStr());

  const { data, error } = await query;

  if (error) {
    console.error("reports 조회 실패:", error);
    process.exit(1);
  }
  return data;
}

async function fetchLatestReport() {
  const { data, error } = await supabase
    .from("reports")
    .select("id, topic_title, html_body")
    .order("issue_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("reports 조회 실패:", error);
    process.exit(1);
  }
  return data;
}

async function fetchActiveSubscribers() {
  const { data, error } = await supabase
    .from("report_subscribers")
    .select("email, unsubscribe_token")
    .eq("status", "active");

  if (error) {
    console.error("report_subscribers 조회 실패:", error);
    process.exit(1);
  }
  return data;
}

// html_body(LLM 생성 원본)는 손대지 않고, 발송용 사본에만 상/하단 고정 링크를 감싸서 붙인다.
// 최상단: 사이트 바로가기 + 웹에서 보기, 최하단: 구독취소 + 사이트 바로가기(반복).
function buildEmailHtml(reportHtmlBody, reportId, unsubscribeToken) {
  const webviewLink = `${WEBVIEW_BASE_URL}/${reportId}`;
  const unsubscribeLink = `${UNSUBSCRIBE_BASE_URL}?token=${unsubscribeToken}`;

  const header =
    `<p><a href="${SITE_URL}">우량주 스카우터 바로가기</a></p>` +
    `<p><a href="${webviewLink}">웹에서 보기</a></p>`;

  const footer =
    `<p style="margin-top:24px;font-size:12px;color:#888;">` +
    `<a href="${unsubscribeLink}">구독취소</a> | ` +
    `<a href="${SITE_URL}">우량주 스카우터 바로가기</a></p>`;

  return `${header}${reportHtmlBody}${footer}`;
}

async function sendOneEmail(to, subject, htmlBody, reportId) {
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
      tags: [{ name: "report_id", value: String(reportId) }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, status: res.status, error: errText };
  }
  return { ok: true };
}

async function sendReportToSubscribers(report, subscribers) {
  const succeededSubscribers = [];

  for (const subscriber of subscribers) {
    const html = buildEmailHtml(report.html_body, report.id, subscriber.unsubscribe_token);
    const result = await sendOneEmail(subscriber.email, report.topic_title, html, report.id);

    if (result.ok) {
      succeededSubscribers.push(subscriber);
    } else {
      console.error(`이메일 발송 실패 (${subscriber.email}): ${result.status} - ${result.error}`);
      if (result.status === 401) {
        console.error("Resend API 인증 실패(401)로 발송을 중단합니다.");
        process.exit(1);
      }
    }
  }

  return succeededSubscribers;
}

async function recordSendLog(reportId, successCount, topicTitle) {
  const { error } = await supabase.from("send_logs").insert({
    report_id: reportId,
    channel: "email",
    sent_at: new Date().toISOString(),
    recipient_count: successCount,
    open_count: 0,
    click_count: 0,
    summary_text: topicTitle,
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

async function markSubscribersAsSent(succeededSubscribers, reportId) {
  const emails = succeededSubscribers.map((s) => s.email);
  if (emails.length === 0) return;

  const { error } = await supabase
    .from("report_subscribers")
    .update({ last_sent_at: new Date().toISOString(), last_report_id: reportId })
    .in("email", emails);

  if (error) {
    console.error("report_subscribers.last_sent_at/last_report_id 업데이트 실패:", error);
  }
}

async function processReport(report, subscribers) {
  if (subscribers.length === 0) {
    console.log(`[발송] 발송 대상 구독자가 없어 report_id=${report.id} 발송을 스킵합니다`);
    return;
  }

  const succeededSubscribers = await sendReportToSubscribers(report, subscribers);
  const successCount = succeededSubscribers.length;

  const logSaved = await recordSendLog(report.id, successCount, report.topic_title);
  if (!logSaved) {
    console.error(`[발송] report_id=${report.id} send_logs 저장 실패로 status 업데이트를 건너뜁니다`);
    return;
  }

  await markReportAsSent(report.id);
  await markSubscribersAsSent(succeededSubscribers, report.id);

  console.log(
    `[발송] report_id=${report.id}, 성공 ${successCount}건 / 전체 ${subscribers.length}건, status를 sent로 업데이트 완료`
  );
}

// report_subscribers/consent_logs/send_logs/reports를 전혀 건드리지 않는 운영 안전 테스트 모드.
// TEST_RECIPIENT_EMAIL 환경변수가 설정된 경우에만 진입한다.
async function runTestMode(testEmail) {
  const report = await fetchLatestReport();

  if (!report) {
    console.error("테스트 발송할 reports 행이 없습니다");
    process.exit(1);
  }

  const html = buildEmailHtml(report.html_body, report.id, "test-mode-token");
  const result = await sendOneEmail(testEmail, report.topic_title, html, report.id);

  if (!result.ok) {
    console.error(`테스트 발송 실패: ${result.status} - ${result.error}`);
    process.exit(1);
  }

  console.log(`[테스트] ${testEmail}로 report_id=${report.id} 테스트 발송 완료`);
}

async function main() {
  const testEmail = process.env.TEST_RECIPIENT_EMAIL;
  if (testEmail) {
    await runTestMode(testEmail);
    return;
  }

  const reportId = process.env.REPORT_ID || null;
  const reports = await fetchApprovedReports(reportId);

  if (reports.length === 0) {
    console.log("[발송] 발송할 approved 상태의 리포트가 없습니다");
    return;
  }

  const subscribers = await fetchActiveSubscribers();

  for (const report of reports) {
    await processReport(report, subscribers);
  }
}

main();
