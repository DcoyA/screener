import { createClient } from "@supabase/supabase-js";
import { kstTodayStr } from "./lib/date.mjs";
import { buildEmailHtml } from "./lib/emailTemplate.mjs";
import { createReportLinkToken } from "../../app/lib/reportLinkToken.js";

// Resend에 인증한 도메인이 report.hellomedia.win(서브도메인)이라 발신
// 주소도 이 서브도메인이어야 한다(hellomedia.win 자체가 아님). DKIM이
// 아직 Pending이면(DNS 전파 대기) 인증 완료 전까지 실사용 불가 -
// TEST_RECIPIENT_EMAIL 모드로 먼저 확인할 것.
const FROM_ADDRESS = "news@report.hellomedia.win";
// 발신자 표시 이름. Resend 는 "이름 <주소>" 형식을 그대로 받아 From 헤더의
// 표시 이름을 UTF-8 MIME 인코딩(=?UTF-8?B?…?=)까지 알아서 한다 - 코드에서
// 별도 인코딩 불필요. 주소/도메인은 위 상수 그대로.
const FROM_NAME = "우량주 스카우터";

const SITE_URL = "https://www.hellomedia.win";
const UNSUBSCRIBE_BASE_URL = "https://www.hellomedia.win/unsubscribe";
// TASK 7(디자인·IA 개편): /reports/[id]가 서버에서 실제 열람 권한을 판정하는
// 정식 경로다(app/lib/reportAccess.js). /reports/page.js(목록)와 경로가
// 겹치지 않는다 - Next.js는 /reports/page.js와 /reports/[id]/page.js를
// 동시에 지원한다.
const WEBVIEW_BASE_URL = "https://www.hellomedia.win/reports";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;
const MAX_ATTEMPTS = 3;
const FAILURE_RATE_ALERT_THRESHOLD = 0.1;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// report_id가 지정되면 그 리포트 하나만(승인된 상태인지도 재확인) 발송한다.
// 지정 없으면 오늘 issue_date의 approved 리포트를 찾는다(정상 경로에선
// 하루 1건만 존재 - generate-report.mjs가 issue_date당 1건으로 막아둠).
async function fetchApprovedReports(reportId) {
  let query = supabase.from("reports").select("id, issue_date, topic_title, content_json, excluded_sections").eq("status", "approved");
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
    .select("id, issue_date, topic_title, content_json, excluded_sections")
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

// reportLinkToken은 reportId+만료시각만 서명한 값이라(구독자별로 다르지
// 않음) 리포트당 한 번만 만들면 된다 - 호출 측(processReport)이 만들어서
// 넘겨준다.
function buildLinksFor(reportId, unsubscribeToken, reportLinkToken) {
  const webviewUrl = reportLinkToken
    ? `${WEBVIEW_BASE_URL}/${reportId}?token=${reportLinkToken}`
    : `${WEBVIEW_BASE_URL}/${reportId}`;
  return {
    webviewUrl,
    unsubscribeUrl: `${UNSUBSCRIBE_BASE_URL}?token=${unsubscribeToken}`,
  };
}

async function sendOneEmail(to, subject, htmlBody, reportId, unsubscribeUrl) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: [to],
      subject,
      html: htmlBody,
      // Gmail/야후 대량 발송 정책상 필수. One-Click 방식이라 메일 클라이언트가
      // 확인 페이지 없이 바로 구독취소 요청을 보낼 수 있어야 하므로,
      // app/api/unsubscribe가 GET만으로도 처리 가능한지 별도 확인 필요.
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "report_id", value: String(reportId) }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, status: res.status, error: errText };
  }
  return { ok: true };
}

// 401/403(인증 자체가 잘못됨)은 재시도해도 성공할 수 없으니 즉시 fatal로
// 반환한다. 그 외 실패는 지수 백오프(2s/4s)로 최대 3회 시도한다.
async function sendWithRetry(subscriber, report, subject, unsubscribeUrl, html) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await sendOneEmail(subscriber.email, subject, html, report.id, unsubscribeUrl);
    if (result.ok) return { ok: true, subscriber };

    if (result.status === 401 || result.status === 403) {
      return { ok: false, subscriber, fatal: true, status: result.status, error: result.error };
    }

    if (attempt < MAX_ATTEMPTS) {
      const waitMs = 2 ** attempt * 1000;
      console.warn(
        `이메일 발송 실패 (${subscriber.email}): ${result.status} - ${result.error} - ${waitMs}ms 후 재시도 (${attempt}/${MAX_ATTEMPTS})`
      );
      await sleep(waitMs);
    } else {
      console.error(`이메일 발송 최종 실패 (${subscriber.email}): ${result.status} - ${result.error}`);
      return { ok: false, subscriber, fatal: false, status: result.status, error: result.error };
    }
  }
}

// 10건씩 동시 발송, 배치 사이 1초 대기. 401/403은 "현재 배치가 끝난 뒤"
// 다음 배치를 시작하지 않는 방식으로 중단한다 - 이미 병렬로 날아간 같은
// 배치 내 나머지 요청까지 완벽히 막을 수는 없다(동시 발송과 즉시 중단은
// 본질적으로 트레이드오프).
async function sendReportToSubscribers(report, subscribers, subject, reportLinkToken) {
  const succeeded = [];
  const failed = [];
  let aborted = false;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((subscriber) => {
        const { webviewUrl, unsubscribeUrl } = buildLinksFor(report.id, subscriber.unsubscribe_token, reportLinkToken);
        const html = buildEmailHtml(report, { webviewUrl, unsubscribeUrl });
        return sendWithRetry(subscriber, report, subject, unsubscribeUrl, html);
      })
    );

    for (const r of results) {
      if (r.ok) {
        succeeded.push(r.subscriber);
      } else {
        failed.push({ email: r.subscriber.email, status: r.status, error: r.error });
        if (r.fatal) aborted = true;
      }
    }

    if (aborted) {
      console.error("Resend API 인증 실패(401/403)로 이후 배치 발송을 중단합니다.");
      break;
    }

    if (i + BATCH_SIZE < subscribers.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { succeeded, failed, aborted };
}

async function recordSendLog(reportId, successCount, failedEmails, topicTitle) {
  const { error } = await supabase.from("send_logs").insert({
    report_id: reportId,
    channel: "email",
    sent_at: new Date().toISOString(),
    recipient_count: successCount,
    open_count: 0,
    click_count: 0,
    summary_text: topicTitle,
    failed_count: failedEmails.length,
    failed_emails: failedEmails.map((f) => f.email),
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

async function notifyHighFailureRate(reportId, failed, total) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const rate = ((failed.length / total) * 100).toFixed(1);
  const text =
    `🟡 [프리미엄 리포트 발송] report_id=${reportId} 실패율 ${rate}% (${failed.length}/${total}건)\n` +
    failed
      .slice(0, 10)
      .map((f) => `- ${f.email}: ${f.status}`)
      .join("\n");

  if (!webhookUrl) {
    console.log("[발송] SLACK_WEBHOOK_URL 없음 - 실패율 경고를 콘솔에만 출력\n" + text);
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error(`슬랙 전송 실패: ${res.status} - ${await res.text()}`);
  }
}

async function processReport(report, subscribers) {
  if (subscribers.length === 0) {
    console.log(`[발송] 발송 대상 구독자가 없어 report_id=${report.id} 발송을 스킵합니다`);
    return;
  }

  // REPORT_LINK_SECRET이 없으면 토큰 없는 링크가 나가고, 그 링크는
  // app/lib/reportAccess.js가 무조건 잠금 화면으로 막는다 - 구독자조차
  // 못 읽는 발송이 조용히 나가는 것보다는 여기서 막는 게 낫다.
  const reportLinkToken = createReportLinkToken(report.id);
  if (!reportLinkToken) {
    console.error(`REPORT_LINK_SECRET 미설정으로 report_id=${report.id} 발송을 중단합니다(토큰 없는 링크는 구독자도 못 엽니다)`);
    process.exit(1);
  }

  const subject = report.content_json?.cover?.headline || report.topic_title;
  const { succeeded, failed } = await sendReportToSubscribers(report, subscribers, subject, reportLinkToken);

  const logSaved = await recordSendLog(report.id, succeeded.length, failed, report.topic_title);
  if (!logSaved) {
    console.error(`[발송] report_id=${report.id} send_logs 저장 실패로 status 업데이트를 건너뜁니다`);
    return;
  }

  await markReportAsSent(report.id);
  await markSubscribersAsSent(succeeded, report.id);

  const failureRate = failed.length / subscribers.length;
  if (failureRate > FAILURE_RATE_ALERT_THRESHOLD) {
    await notifyHighFailureRate(report.id, failed, subscribers.length);
  }

  console.log(
    `[발송] report_id=${report.id}, 성공 ${succeeded.length}건 / 실패 ${failed.length}건 / 전체 ${subscribers.length}건, status를 sent로 업데이트 완료`
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

  const reportLinkToken = createReportLinkToken(report.id);
  if (!reportLinkToken) {
    console.error("REPORT_LINK_SECRET 미설정 - 테스트 발송도 토큰 없는(잠긴) 링크가 나갑니다. 계속하려면 그대로 두거나 키를 설정하세요.");
  }
  const { webviewUrl, unsubscribeUrl } = buildLinksFor(report.id, "test-mode-token", reportLinkToken);
  const html = buildEmailHtml(report, { webviewUrl, unsubscribeUrl });
  const subject = report.content_json?.cover?.headline || report.topic_title;
  const result = await sendOneEmail(testEmail, subject, html, report.id, unsubscribeUrl);

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
