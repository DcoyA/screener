import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { buildEmailHtml } from "../../../../../scripts/premium/lib/emailTemplate.mjs";

const STATUS_LABEL = {
  draft: "초안(검수 대기)",
  approved: "승인됨(발송 대기)",
  needs_revision: "수정 필요",
  discarded: "폐기됨",
  sent: "발송 완료",
};

const HORIZON_LABEL = { short: "단기", mid: "중기", long: "장기" };

const styles = {
  container: { maxWidth: 760, margin: "0 auto", padding: "24px", color: "#0f172a", fontFamily: "sans-serif" },
  meta: { color: "#64748b", fontWeight: 700, marginBottom: 4 },
  status: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: "0.8rem",
    fontWeight: 800,
    background: "#f1effe",
    color: "#4b3fff",
    marginBottom: 16,
  },
  title: { margin: "0 0 8px", letterSpacing: "-0.02em" },
  marketTemp: { color: "#475569", marginBottom: 24 },
  section: { marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid #e2e8f0" },
  sectionTitle: { margin: "0 0 8px" },
  label: { fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8", marginTop: 12, marginBottom: 4 },
  invalidation: { background: "#fffbeb", color: "#92400e", padding: "10px 14px", borderRadius: 10 },
  scenarioGrid: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 },
  scenarioCard: { flex: "1 1 160px", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 },
  stockRow: { display: "flex", gap: 8, alignItems: "baseline", fontSize: "0.9rem", marginTop: 4 },
  followupWrong: { background: "#fef2f2", color: "#991b1b" },
  followupRight: { background: "#f0fdf4", color: "#166534" },
  followupProgress: { background: "#f1f5f9", color: "#334155" },
  followupBadge: { padding: "2px 8px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 800, marginRight: 8 },
  divider: { margin: "40px 0", border: "none", borderTop: "2px dashed #cbd5e1" },
  htmlPreviewLabel: { fontWeight: 800, marginBottom: 12 },
};

// 관리자 인증 시스템이 아직 없어(로그인/세션 없음), 최소한의 방어로
// 공유 비밀 토큰만 확인한다 - 이 토큰을 아는 사람은 누구나 draft를 볼 수
// 있다는 뜻이라 강한 보안은 아니다. EDITORIAL_PREVIEW_TOKEN 미설정 시엔
// 토큰 검사 자체를 생략한다(로컬 테스트 편의 - 배포 전엔 반드시 설정할 것).
function isAuthorized(searchParams) {
  const required = process.env.EDITORIAL_PREVIEW_TOKEN;
  if (!required) return true;
  return searchParams.token === required;
}

function verdictStyle(verdict) {
  if (verdict === "틀림") return styles.followupWrong;
  if (verdict === "맞음") return styles.followupRight;
  return styles.followupProgress;
}

export default async function EditorialPreviewPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;

  if (!isAuthorized(sp)) {
    notFound();
  }

  const supabase = createSupabaseAdminClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select("id, issue_date, day_type, topic_title, content_json, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("editorial preview 조회 실패:", error);
  }

  if (!report) {
    notFound();
  }

  const content = report.content_json || {};
  const sections = content.sections || [];
  const followup = content.followup || [];
  const nextWeekCalendar = content.next_week_calendar || [];

  // 미리보기 전용 - 실제 구독자 개별 토큰이 아니라 예시 URL로 렌더링한다.
  const emailHtml = buildEmailHtml(report, {
    webviewUrl: `https://www.hellomedia.win/premium/reports/${report.id}`,
    unsubscribeUrl: "https://www.hellomedia.win/unsubscribe?token=preview",
  });

  return (
    <main style={styles.container}>
      <p style={styles.meta}>
        {report.issue_date} · {report.day_type}
      </p>
      <span style={styles.status}>{STATUS_LABEL[report.status] || report.status}</span>
      <h1 style={styles.title}>{content.cover?.headline || report.topic_title}</h1>
      {content.cover?.market_temp ? <p style={styles.marketTemp}>{content.cover.market_temp}</p> : null}

      {sections.map((s, i) => (
        <div key={i} style={styles.section}>
          <h2 style={styles.sectionTitle}>
            {i + 1}. {s.title}
          </h2>

          <p style={styles.label}>무슨 일이 있었나</p>
          <p>{s.what_happened}</p>

          <p style={styles.label}>왜 중요한가</p>
          <p>{s.why_it_matters}</p>

          <p style={styles.label}>시나리오</p>
          <div style={styles.scenarioGrid}>
            {["short", "mid", "long"].map((h) =>
              s.scenarios?.[h] ? (
                <div key={h} style={styles.scenarioCard}>
                  <strong>
                    {HORIZON_LABEL[h]} ({s.scenarios[h].horizon})
                  </strong>
                  <p>{s.scenarios[h].view}</p>
                  <p style={{ color: "#64748b" }}>지켜볼 것: {s.scenarios[h].watch}</p>
                </div>
              ) : null
            )}
          </div>

          <p style={styles.label}>이 관점이 틀렸다고 볼 조건</p>
          <p style={styles.invalidation}>{s.invalidation}</p>

          {(s.related_stocks || []).length > 0 ? (
            <>
              <p style={styles.label}>관련 종목</p>
              {s.related_stocks.map((rs, j) => (
                <div key={j} style={styles.stockRow}>
                  <strong>
                    {rs.name}({rs.code})
                  </strong>
                  <span>
                    등급 {rs.grade_4w_ago ? `${rs.grade_4w_ago} → ` : ""}
                    {rs.grade}
                  </span>
                  <span>{rs.stance}</span>
                  <span>{rs.one_liner}</span>
                </div>
              ))}
            </>
          ) : null}

          {(s.sources || []).length > 0 ? (
            <>
              <p style={styles.label}>출처</p>
              {s.sources.map((src, j) => (
                <p key={j} style={{ fontSize: "0.85rem" }}>
                  [{src.type}] {src.url} ({src.date})
                </p>
              ))}
            </>
          ) : null}
        </div>
      ))}

      {followup.length > 0 ? (
        <div style={styles.section}>
          <p style={styles.label}>지난 리포트 후속 추적</p>
          {followup.map((f, i) => (
            <p key={i}>
              <span style={{ ...styles.followupBadge, ...verdictStyle(f.verdict) }}>{f.verdict}</span>
              [{f.from_issue}] {f.topic}: {f.what_changed}
            </p>
          ))}
        </div>
      ) : null}

      {nextWeekCalendar.length > 0 ? (
        <div style={styles.section}>
          <p style={styles.label}>다음 주 일정</p>
          {nextWeekCalendar.map((e, i) => (
            <p key={i}>
              {e.date} {e.event} - {e.why}
            </p>
          ))}
        </div>
      ) : null}

      {content.disclaimer ? <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{content.disclaimer}</p> : null}

      <hr style={styles.divider} />

      <p style={styles.htmlPreviewLabel}>실제 발송될 이메일 HTML 미리보기</p>
      {/* emailHtml은 완전한 <html> 문서라 iframe으로 격리해서 보여준다
          (페이지 자체의 html/body 안에 또 다른 html/body를 넣을 수 없음). */}
      <iframe
        title="이메일 미리보기"
        srcDoc={emailHtml}
        style={{ width: "100%", height: 900, border: "1px solid #e2e8f0", borderRadius: 12 }}
      />
    </main>
  );
}
