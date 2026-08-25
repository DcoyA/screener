import Link from "next/link";
import { notFound } from "next/navigation";
import MainNav from "../../../components/MainNav";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

const styles = {
  container: { maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px", color: "#0f172a" },
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
  reportDate: { color: "#64748b", fontWeight: 700, margin: "0 0 8px" },
  title: { margin: "0 0 24px", letterSpacing: "-0.03em" },
  body: { lineHeight: 1.8 },
};

export default async function PremiumReportDetailPage({ params }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: report, error } = await supabase
    .from("reports")
    .select("id, issue_date, day_type, topic_title, html_body, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("premium report 상세 조회 실패:", error);
  }

  if (!report || report.status !== "sent") {
    notFound();
  }

  return (
    <main style={styles.container}>
      <div style={styles.topLinks}>
        <Link href="/premium/reports" style={styles.homeBtn}>목록으로</Link>
        <MainNav />
      </div>

      <p style={styles.reportDate}>{report.issue_date}</p>
      <h1 style={styles.title}>{report.topic_title}</h1>

      {/* TODO: 향후 sanitize-html 도입 고려 */}
      <div style={styles.body} dangerouslySetInnerHTML={{ __html: report.html_body }} />
    </main>
  );
}
