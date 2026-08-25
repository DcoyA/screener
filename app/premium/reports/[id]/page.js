import { notFound } from "next/navigation";
import PageTopBar from "../../../components/PageTopBar";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

const styles = {
  container: { maxWidth: 760, margin: "0 auto", padding: "18px 24px 80px", color: "#0f172a" },
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
      <PageTopBar backHref="/premium/reports" backLabel="목록으로" />

      <p style={styles.reportDate}>{report.issue_date}</p>
      <h1 style={styles.title}>{report.topic_title}</h1>

      {/* TODO: 향후 sanitize-html 도입 고려 */}
      <div style={styles.body} dangerouslySetInnerHTML={{ __html: report.html_body }} />
    </main>
  );
}
