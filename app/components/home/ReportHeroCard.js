import Link from "next/link";

export default function ReportHeroCard({ report }) {
  if (!report) return null;

  const summary =
    report.content_json?.sections?.[0]?.summary ||
    "이번 리포트의 핵심 내용을 정리했습니다.";

  return (
    <section className="reportHeroCard">
      <p className="reportHeroBadge">최신 프리미엄 리포트</p>
      <h2>{report.topic_title}</h2>
      <p className="reportHeroSummary">{summary}</p>
      <div className="reportHeroActions">
        <Link href={`/premium/reports/${report.id}`} className="reportHeroBtn">
          리포트 보기
        </Link>
      </div>

      <style jsx>{`
        .reportHeroCard {
          background: var(--color-card-bg);
          border-radius: var(--radius-card);
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .reportHeroBadge {
          margin: 0;
          width: fit-content;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(108, 79, 224, 0.1);
          color: var(--color-primary);
          font-size: 0.8rem;
          font-weight: 800;
        }
        h2 {
          margin: 0;
          font-size: clamp(1.3rem, 2.6vw, 1.8rem);
          letter-spacing: -0.03em;
          line-height: 1.4;
        }
        .reportHeroSummary {
          margin: 0;
          color: #475569;
          line-height: 1.7;
        }
        .reportHeroActions {
          display: flex;
          justify-content: flex-end;
        }
        .reportHeroBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-button);
          padding: 12px 22px;
          font-weight: 800;
          background: var(--color-accent);
          color: #fff;
        }
      `}</style>
    </section>
  );
}
