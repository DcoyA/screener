import Link from "next/link";
import PageTopBar from "../../components/PageTopBar";
import Icon from "../../components/icons/Icon";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

const styles = {
  container: { maxWidth: 900, margin: "0 auto", padding: "18px 24px 80px", color: "#0f172a" },
  latestCard: {
    display: "block",
    padding: 28,
    borderRadius: "var(--radius-card)",
    background: "var(--color-card-bg)",
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    textDecoration: "none",
    color: "#0f172a",
    marginBottom: 24,
  },
  latestBadge: {
    display: "inline-flex",
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(108,79,224,0.1)",
    color: "var(--color-primary)",
    fontSize: "0.8rem",
    fontWeight: 800,
    marginBottom: 12,
  },
  reportList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  reportItemWrap: {
    position: "relative",
    borderRadius: "var(--radius-card)",
    background: "var(--color-card-bg)",
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    overflow: "hidden",
  },
  reportItemLink: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    padding: "16px 18px",
    textDecoration: "none",
    color: "#0f172a",
  },
  lockOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "0 18px",
    background: "rgba(247,245,252,0.88)",
  },
  lockLabel: { display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#475569" },
  // 화면당 오렌지(accent) 버튼은 1개만 유지하는 원칙에 따라, 잠긴 카드마다 반복되는
  // 이 버튼은 보라 아웃라인으로 두고 오렌지 CTA는 아래 subscribeBanner에 1개만 둔다.
  subscribeBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-button)",
    padding: "8px 16px",
    fontWeight: 800,
    background: "#fff",
    border: "1px solid var(--color-primary)",
    color: "var(--color-primary)",
    textDecoration: "none",
    fontSize: "0.85rem",
    whiteSpace: "nowrap",
  },
  subscribeBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "16px 20px",
    borderRadius: "var(--radius-card)",
    background: "var(--color-card-bg)",
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    marginBottom: 14,
  },
  subscribeBannerBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-button)",
    padding: "10px 20px",
    fontWeight: 800,
    background: "var(--color-accent)",
    color: "#fff",
    textDecoration: "none",
  },
  reportDate: { color: "#64748b", fontWeight: 700, minWidth: 100 },
  reportDayType: {
    padding: "4px 10px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#4f46e5",
    fontSize: "0.8rem",
    fontWeight: 800,
  },
  reportTitle: { fontWeight: 700 },
};

export default async function PremiumReportsArchivePage() {
  const supabase = createSupabaseAdminClient();
  const { data: reports, error } = await supabase
    .from("reports")
    .select("id, issue_date, day_type, topic_title")
    .eq("status", "sent")
    .order("issue_date", { ascending: false });

  if (error) {
    console.error("premium reports 조회 실패:", error);
  }

  const [latest, ...rest] = reports || [];

  return (
    <main style={styles.container}>
      <PageTopBar />

      <h1>프리미엄 리포트 아카이브</h1>

      {!latest && <p>발행된 리포트가 아직 없습니다.</p>}

      {latest && (
        <Link href={`/premium/reports/${latest.id}`} style={styles.latestCard}>
          <span style={styles.latestBadge}>최신 리포트</span>
          <p style={{ margin: "0 0 6px", color: "#64748b", fontWeight: 700 }}>{latest.issue_date}</p>
          <h2 style={{ margin: 0, fontSize: "1.4rem", letterSpacing: "-0.03em" }}>{latest.topic_title}</h2>
        </Link>
      )}

      {rest.length > 0 && (
        <div style={styles.subscribeBanner}>
          <span style={{ fontWeight: 700, color: "#475569" }}>이전 리포트 {rest.length}건은 구독자만 볼 수 있습니다.</span>
          <Link href="/" style={styles.subscribeBannerBtn}>구독하고 전체 보기</Link>
        </div>
      )}

      {rest.length > 0 && (
        <ul style={styles.reportList}>
          {rest.map((report) => (
            <li key={report.id} style={styles.reportItemWrap}>
              {/* 실제 구독 여부 판별 로직이 없어(코드베이스에 로그인/구독 상태 확인 수단 없음),
                  잠금 UI만 우선 보여준다. 링크는 그대로 열리므로 실제 접근 제어는 아니다.
                  TODO: 별도 작업으로 구독 상태 판별 + 실제 접근 제어 구현 필요. */}
              <Link href={`/premium/reports/${report.id}`} style={styles.reportItemLink}>
                <span style={styles.reportDate}>{report.issue_date}</span>
                <span style={styles.reportDayType}>{report.day_type}</span>
                <span style={styles.reportTitle}>{report.topic_title}</span>
              </Link>
              <div style={styles.lockOverlay}>
                <span style={styles.lockLabel}><Icon name="lock" size={16} /> 잠긴 리포트</span>
                <Link href="/" style={styles.subscribeBtn}>구독하고 전체 보기</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
