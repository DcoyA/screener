"use client";

import Link from "next/link";
import reports from "../data/reports.json";
import stocks from "../data/stocks.json";
import PageTopBar from "../components/PageTopBar";
import Icon from "../components/icons/Icon";
import { cleanStockName } from "../lib/stockName";


export default function ReportsPage() {
  const updatedAt = reports[0]?.publishedAt || "-";

  return (
    <>
      <main className="container">
        <PageTopBar />

        <section className="pageHero">
          <div>
            <p className="badge">DAILY REPORT</p>
            <h1>데일리 Top10 리포트</h1>
            <p className="desc">
              매일 자동 수집된 공식 데이터를 바탕으로 상위 후보와 핵심 코멘트를
              정리하는 페이지입니다. <br />오늘의 핵심 후보와 시장 코멘트를 한 번에
              볼 수 있도록 구성했습니다.
            </p>
          </div>
          <div className="updateBox">
            <span className="updateLabel">업데이트</span>
            <strong>{updatedAt}</strong>
          </div>
        </section>

        {/* 상단 네비를 4개로 통합하면서 "성과/백테스트"가 네비에서 빠져
            여기서 진입 경로를 열어둔다 (리포트<->성과 상호 링크). */}
        <Link href="/performance" className="performanceCrossLink">
          <Icon name="trendingUp" size={16} /> 이 전략들의 실제 성과/백테스트 결과 보기 →
        </Link>

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
                  <h3>오늘의 Top10 후보</h3>
                  <div className="miniCardWrap">
                    {topPicks.map((stock) => (
                      <div className="miniCard" key={stock.code}>
                        <p className="marketBadge">{stock.market}</p>
                        <h4>{cleanStockName(stock.name)}</h4>
                        <p className="stockCode">{stock.code}</p>
                        <p className="scoreLine">총점 {stock.totalScore}점</p>
                        <Link className="miniLink" href={`/stock/${stock.code}`}>
                          상세 보기
                        </Link>
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

      <style jsx>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          color: #0f172a;
        }
        .performanceCrossLink {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 20px;
          color: var(--color-primary);
          font-weight: 800;
          text-decoration: none;
        }
        .subNav {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .subNav a {
          color: #475569;
          text-decoration: none;
          font-weight: 700;
        }
        .pageHero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .badge {
          display: inline-flex;
          padding: 8px 14px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.82rem;
          font-weight: 800;
          margin: 0 0 18px;
        }
        h1 {
          margin: 0 0 12px;
          font-size: clamp(2rem, 4vw, 3rem);
          letter-spacing: -0.04em;
        }
        .desc {
          margin: 0;
          max-width: 760px;
          color: #475569;
          line-height: 1.8;
          font-size: 1.02rem;
        }
        .updateBox {
          min-width: 180px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
          text-align: right;
        }
        .updateLabel,
        .stockCode,
        .scoreLine {
          color: #64748b;
        }
        .updateLabel {
          display: block;
          margin-bottom: 6px;
          font-size: 0.88rem;
          font-weight: 700;
        }
        .reportList {
          display: grid;
          gap: 20px;
        }
        .reportCard {
          border-radius: 26px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }
        .reportHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        h2 {
          margin: 6px 0 10px;
          font-size: 1.8rem;
          letter-spacing: -0.03em;
        }
        .reportDate {
          padding: 12px 14px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-weight: 800;
          color: #334155;
        }
        .summaryText,
        .detailText,
        .bulletList li {
          color: #475569;
          line-height: 1.8;
        }
        .reportSection {
          margin-top: 18px;
        }
        .reportSection h3 {
          margin: 0 0 12px;
          font-size: 1.1rem;
        }
        .miniCardWrap {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .miniCard {
          border-radius: 20px;
          padding: 18px;
          background: #f8fbff;
          border: 1px solid #e5e7eb;
        }
        .marketBadge {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.78rem;
          font-weight: 800;
          margin: 0 0 12px;
        }
        h4 {
          margin: 0 0 8px;
          font-size: 1.1rem;
        }
        .miniLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-button);
          padding: 10px 14px;
          text-decoration: none;
          font-weight: 800;
          border: 1px solid #dbe3f0;
          margin-top: 12px;
          background: #fff;
          color: #0f172a;
        }
        .bulletList {
          margin: 0;
          padding-left: 20px;
        }
        @media (max-width: 900px) {
          .miniCardWrap {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .container {
            padding: 24px 18px 64px;
          }
          .pageHero,
          .reportHead {
            flex-direction: column;
          }
          .updateBox {
            width: 100%;
            text-align: left;
          }
        }
      `}</style>
    </>
  );
}
