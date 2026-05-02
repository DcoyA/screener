import Link from "next/link";
import stocks from "../data/stocks.json";

export default function RankingPage() {
  const rankedStocks = [...stocks].sort((a, b) => b.totalScore - a.totalScore);
  const updatedAt = rankedStocks[0]?.updatedAt || "-";

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">
            홈으로 가기
          </Link>
          <div className="subNav">
            <Link href="/risk">리스크</Link>
            <Link href="/reports">리포트</Link>
          </div>
        </div>

        <section className="pageHero">
          <div>
            <p className="badge">RANKING</p>
            <h1>종목 랭킹</h1>
            <p className="desc">
              OpenDART 공시와 KRX 시장 데이터를 바탕으로 AI 점수를 계산해 상위
              종목을 정렬한 페이지입니다. 가치·품질·안전성·시장성·변화 점수를
              함께 반영합니다.
            </p>
          </div>
          <div className="updateBox">
            <span className="updateLabel">업데이트</span>
            <strong>{updatedAt}</strong>
          </div>
        </section>

        <div className="listWrap">
          {rankedStocks.map((stock, index) => (
            <div className="listCard" key={stock.code}>
              <div className="listTop">
                <div>
                  <p className="muted">#{index + 1}</p>
                  <h2>{stock.name}</h2>
                  <p className="stockCode">
                    {stock.market} · {stock.code}
                  </p>
                </div>

                <div className="scoreBadge">{stock.totalScore}점</div>
              </div>

              <p className="summaryText">{stock.summary}</p>

              <div className="actionsRow">
                <Link className="linkBtn" href={`/stock/${stock.code}`}>
                  종목 상세 보기
                </Link>
                <Link className="ghostBtn" href="/">
                  메인으로 가기
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <style jsx>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          color: #0f172a;
        }
        .topLinks {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 26px;
          flex-wrap: wrap;
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
        .updateLabel, .muted, .stockCode {
          color: #64748b;
        }
        .updateLabel {
          display: block;
          margin-bottom: 6px;
          font-size: 0.88rem;
          font-weight: 700;
        }
        .listWrap {
          display: grid;
          gap: 18px;
        }
        .listCard {
          border-radius: 24px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }
        .listTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 10px;
        }
        h2 {
          margin: 8px 0 10px;
          font-size: 1.9rem;
          letter-spacing: -0.03em;
        }
        .summaryText {
          margin: 14px 0 20px;
          color: #475569;
          line-height: 1.8;
        }
        .scoreBadge {
          background: #0f172a;
          color: #fff;
          border-radius: 14px;
          padding: 12px 16px;
          font-weight: 800;
          min-width: 64px;
          text-align: center;
        }
        .actionsRow {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .homeBtn,
        .linkBtn,
        .ghostBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 12px 16px;
          text-decoration: none;
          font-weight: 800;
          border: 1px solid #dbe3f0;
          background: #fff;
          color: #0f172a;
        }
        .homeBtn {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }
        @media (max-width: 720px) {
          .container {
            padding: 24px 18px 64px;
          }
          .pageHero,
          .listTop {
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
