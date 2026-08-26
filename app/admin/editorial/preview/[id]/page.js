import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const STATUS_LABEL = {
  draft: "초안(검수 대기)",
  approved: "승인됨(발송 대기)",
  needs_revision: "수정 필요",
  discarded: "폐기됨",
  sent: "발송 완료",
};

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
  title: { margin: "0 0 24px", letterSpacing: "-0.02em" },
  section: { marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid #e2e8f0" },
  sectionTitle: { margin: "0 0 8px" },
  label: { fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8", marginTop: 12, marginBottom: 4 },
  divider: { margin: "40px 0", border: "none", borderTop: "2px dashed #cbd5e1" },
  htmlPreviewLabel: { fontWeight: 800, marginBottom: 12 },
  htmlBody: { border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 },
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

export default async function EditorialPreviewPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;

  if (!isAuthorized(sp)) {
    notFound();
  }

  const supabase = createSupabaseAdminClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select("id, issue_date, day_type, topic_title, content_json, html_body, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("editorial preview 조회 실패:", error);
  }

  if (!report) {
    notFound();
  }

  const sections = report.content_json?.sections || [];

  return (
    <main style={styles.container}>
      <p style={styles.meta}>
        {report.issue_date} · {report.day_type}
      </p>
      <span style={styles.status}>{STATUS_LABEL[report.status] || report.status}</span>
      <h1 style={styles.title}>{report.topic_title}</h1>

      {sections.map((s, i) => (
        <div key={i} style={styles.section}>
          <h2 style={styles.sectionTitle}>
            {i + 1}. {s.title}
          </h2>
          <p style={styles.label}>요약</p>
          <p>{s.summary}</p>
          {s.implication ? (
            <>
              <p style={styles.label}>시사점</p>
              <p>{s.implication}</p>
            </>
          ) : null}
          {(s.related_codes || []).length > 0 ? (
            <>
              <p style={styles.label}>관련 종목</p>
              <p>{s.related_codes.join(", ")}</p>
            </>
          ) : null}
          {(s.related_sectors || []).length > 0 ? (
            <>
              <p style={styles.label}>관련 섹터</p>
              <p>{s.related_sectors.join(", ")}</p>
            </>
          ) : null}
        </div>
      ))}

      <hr style={styles.divider} />

      <p style={styles.htmlPreviewLabel}>실제 발송될 이메일 HTML 미리보기</p>
      {/* 관리자 전용 페이지이고 우리 파이프라인이 생성한 콘텐츠만 렌더링한다. */}
      <div style={styles.htmlBody} dangerouslySetInnerHTML={{ __html: report.html_body || "" }} />
    </main>
  );
}
