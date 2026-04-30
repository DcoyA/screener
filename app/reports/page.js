import reports from "../data/reports.json";
import stocks from "../data/stocks.json";

export default function ReportsPage() {
  return (
    <main className="container">
      <p className="badge">WEEKLY REPORT</p>
      <h1>주간 리포트</h1>
      <p className="desc">
        매주 자동 수집된 데이터를 바탕으로 상위 후보와 핵심 코멘트를 정리하는 페이지입니다.
      </p>

      <div className="reportList">
        {reports.map((report) => {
          const topPicks = stocks.filter((stock) =>
            report.topPickCodes.includes(stock.code)
          );

          return (
            <article className="reportCard" key={report.week}>
              <div className="reportHead">
                <div>
                  <p className="stockCode">{report.week}</p>
                  <h2>{report.title}</h2>
                  <p className="summaryText">{report.summary}</p>
                </div>

                <div className="reportDate">{report.publishedAt}</div>
              </div>

              <section className="reportSection">
                <h3>이번 주 상위 후보</h3>
                <div className="miniCardWrap">
                  {topPicks.map((stock) => (
                    <div className="miniCard" key={stock.code}>
                      <p className="marketBadge">{stock.market}</p>
                      <h4>{stock.name}</h4>
                      <p className="stockCode">{stock.code}</p>
                      <p className="scoreLine">총점 {stock.totalScore}점</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="reportSection">
                <h3>핵심 포인트</h3>
                <ul className="bulletList">
                  {report.highlights.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="reportSection">
                <h3>시장 코멘트</h3>
                <p className="detailText">{report.marketNote}</p>
              </section>

              <section className="reportSection">
                <h3>안내 문구</h3>
                <p className="detailText">{report.disclaimer}</p>
              </section>
            </article>
          );
        })}
      </div>
    </main>
  );
}
