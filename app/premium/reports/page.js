import Link from "next/link";
import MainNav from "../../components/MainNav";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

const styles = {
  container: { maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px", color: "#0f172a" },
  topLinks: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 26,
    flexWrap: "wrap",
  },
  homeBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    padding: "10px 14px",
    textDecoration: "none",
    fontWeight: 800,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#fff",
  },
  reportList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  reportItemLink: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    padding: "16px 18px",
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    textDecoration: "none",
    color: "#0f172a",
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

  return (
    <main style={styles.container}>
      <div style={styles.topLinks}>
        <Link href="/" style={styles.homeBtn}>홈으로 가기</Link>
        <MainNav />
      </div>

      <h1>프리미엄 리포트 아카이브</h1>

      <ul style={styles.reportList}>
        {(reports || []).map((report) => (
          <li key={report.id}>
            <Link href={`/premium/reports/${report.id}`} style={styles.reportItemLink}>
              <span style={styles.reportDate}>{report.issue_date}</span>
              <span style={styles.reportDayType}>{report.day_type}</span>
              <span style={styles.reportTitle}>{report.topic_title}</span>
            </Link>
          </li>
        ))}
      </ul>

      {(!reports || reports.length === 0) && <p>발행된 리포트가 아직 없습니다.</p>}
    </main>
  );
}
