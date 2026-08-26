import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { resolveReportAccess } from "../../lib/reportAccess";
import { cleanStockName } from "../../lib/stockName";
import PageTopBar from "../../components/PageTopBar";

const HORIZON_LABEL = { short: "단기", mid: "중기", long: "장기" };
const VERDICT_STYLE = {
  맞음: { bg: "#f0fdf4", color: "#166534" },
  틀림: { bg: "#fef2f2", color: "#991b1b" },
  진행중: { bg: "#f1f5f9", color: "#334155" },
};

const styles = {
  container: { maxWidth: 760, margin: "0 auto", padding: "24px 24px 100px", color: "#0f172a" },
  meta: { color: "#64748b", fontWeight: 700, margin: "0 0 8px" },
  title: { margin: "0 0 8px", letterSpacing: "-0.03em" },
  marketTemp: { color: "#475569", margin: "0 0 28px" },
  section: { marginBottom: 32, paddingBottom: 28, borderBottom: "1px solid #e5e7eb" },
  sectionTitle: { margin: "0 0 10px", fontSize: "1.3rem" },
  label: { fontSize: "0.78rem", fontWeight: 800, color: "#94a3b8", marginTop: 14, marginBottom: 6 },
  invalidation: { background: "#fffbeb", color: "#92400e", padding: "12px 16px", borderRadius: 12, lineHeight: 1.7 },
  scenarioGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginTop: 6 },
  scenarioCard: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 14 },
  stockRow: { display: "flex", gap: 10, alignItems: "baseline", fontSize: "0.94rem", padding: "6px 0", flexWrap: "wrap" },
  disclaimer: { fontSize: "0.8rem", color: "#94a3b8", marginTop: 24 },
};

function ReportBody({ report }) {
  const content = report.content_json || {};
  const cover = content.cover || {};
  const sections = content.sections || [];
  const followup = content.followup || [];
  const nextWeekCalendar = content.next_week_calendar || [];

  return (
    <>
      <p style={styles.meta}>{report.issue_date}</p>
      <h1 style={styles.title}>{cover.headline || report.topic_title}</h1>
      {cover.market_temp ? <p style={styles.marketTemp}>{cover.market_temp}</p> : null}

      {sections.map((s, i) => (
        <div key={i} style={styles.section}>
          <h2 style={styles.sectionTitle}>{s.title}</h2>
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
                  <p style={{ margin: "6px 0" }}>{s.scenarios[h].view}</p>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>지켜볼 것: {s.scenarios[h].watch}</p>
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
                    {cleanStockName(rs.name)}({rs.code})
                  </strong>
                  <span style={{ color: "#64748b" }}>
                    등급 {rs.grade_4w_ago ? `${rs.grade_4w_ago} → ` : ""}
                    {rs.grade}
                  </span>
                  <span style={{ color: "#64748b" }}>{rs.one_liner}</span>
                </div>
              ))}
            </>
          ) : null}

          {(s.sources || []).length > 0 ? (
            <>
              <p style={styles.label}>출처</p>
              {s.sources.map((src, j) => (
                <p key={j} style={{ fontSize: "0.82rem", color: "#94a3b8", margin: "2px 0" }}>
                  [{src.type}] {src.url} ({src.date})
                </p>
              ))}
            </>
          ) : null}
        </div>
      ))}

      {followup.length > 0 ? (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>지난 리포트 후속 추적</h2>
          {followup.map((f, i) => {
            const verdictStyle = VERDICT_STYLE[f.verdict] || VERDICT_STYLE.진행중;
            return (
              <p key={i} style={{ lineHeight: 1.8 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    background: verdictStyle.bg,
                    color: verdictStyle.color,
                    marginRight: 8,
                  }}
                >
                  {f.verdict}
                </span>
                [{f.from_issue}] {f.topic}: {f.what_changed}
              </p>
            );
          })}
        </div>
      ) : null}

      {nextWeekCalendar.length > 0 ? (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>다음 주 일정</h2>
          {nextWeekCalendar.map((e, i) => (
            <p key={i}>
              {e.date} · {e.event} - {e.why}
            </p>
          ))}
        </div>
      ) : null}

      {content.disclaimer ? <p style={styles.disclaimer}>{content.disclaimer}</p> : null}
    </>
  );
}

// 토큰 없이(또는 만료된 토큰으로) 들어온 방문자에게 보여주는 잠금 화면.
// 클라이언트 사이드 블러가 아니라 애초에 첫 섹션 미리보기 몇 줄만 서버에서
// 잘라 내려보낸다 - 나머지 본문은 응답에 아예 포함되지 않으므로 DevTools로
// 뚫을 수 없다.
function LockedReportView({ report }) {
  const content = report.content_json || {};
  const cover = content.cover || {};
  const firstSection = (content.sections || [])[0];
  const previewText = firstSection?.what_happened
    ? `${firstSection.what_happened.slice(0, 120)}${firstSection.what_happened.length > 120 ? "…" : ""}`
    : null;

  return (
    <>
      <p style={styles.meta}>{report.issue_date}</p>
      <h1 style={styles.title}>{cover.headline || report.topic_title}</h1>
      {cover.market_temp ? <p style={styles.marketTemp}>{cover.market_temp}</p> : null}

      {firstSection ? (
        <div style={{ ...styles.section, borderBottom: "none" }}>
          <h2 style={styles.sectionTitle}>{firstSection.title}</h2>
          {previewText ? <p>{previewText}</p> : null}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          padding: 28,
          textAlign: "center",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
        }}
      >
        <p style={{ margin: "0 0 8px", fontWeight: 900, fontSize: "1.1rem" }}>구독자만 이어서 볼 수 있어요</p>
        <p style={{ margin: "0 0 20px", color: "#64748b", lineHeight: 1.7 }}>
          이미 구독 중이라면 받은 이메일의 링크로 열어주세요(로그인 없이 바로 열립니다).
          <br />
          아직이라면 아래에서 구독 신청할 수 있어요.
        </p>
        <Link
          href="/reports"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 48,
            padding: "0 24px",
            borderRadius: "var(--radius-button)",
            // "화면당 오렌지 1개" - PageTopBar의 MainNav가 이미 상시 CTA로
            // --color-accent를 쓰고 있어서 여기선 primary로 뺀다.
            background: "var(--color-primary)",
            color: "#fff",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          구독 신청하기
        </Link>
      </div>
    </>
  );
}

export default async function ReportDetailPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const token = sp?.token || null;

  const supabase = createSupabaseAdminClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select("id, issue_date, day_type, topic_title, content_json, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("리포트 상세 조회 실패:", error);
  }

  if (!report || report.status !== "sent") {
    notFound();
  }

  const access = await resolveReportAccess({ reportId: report.id, token, session: null });

  if (!access.allowed && access.reason === "secret_missing") {
    // REPORT_LINK_SECRET 미설정은 "구독 안 함"이 아니라 설정 오류다.
    // 이 상태로 전체 공개가 되면 안 되므로 500으로 닫는다.
    throw new Error("REPORT_LINK_SECRET 미설정 - 리포트 열람 권한을 판정할 수 없습니다.");
  }

  return (
    <main style={styles.container}>
      <PageTopBar backHref="/reports" backLabel="목록으로" />
      {access.allowed ? <ReportBody report={report} /> : <LockedReportView report={report} />}
    </main>
  );
}
