import reports from "../data/reports.json";

export default function ReportsPage() {
  return (
    <>
      <section className="hero">
        <div className="badge">리포트</div>
        <h1>주간 리포트 아카이브</h1>
        <p>
          블로그·PDF·사이트 요약본으로 재활용할 주간 리포트 영역입니다.
        </p>
      </section>

      <div className="grid">
        {reports.map((report) => (
          <div className="card" key={report.id}>
            <h3>{report.title}</h3>
            <p>{report.summary}</p>
          </div>
        ))}
      </div>
    </>
  );
}
