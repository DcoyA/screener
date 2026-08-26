import Link from "next/link";
import { getScoreGaugeColor } from "../../lib/scoreGauge";
import { cleanStockName } from "../../lib/stockName";

export default function TopScoresSection({ stocks = [] }) {
  const top5 = [...stocks]
    .sort((a, b) => Number(b?.totalScore ?? 0) - Number(a?.totalScore ?? 0))
    .slice(0, 5);

  if (top5.length === 0) return null;

  return (
    <section className="topScoresSection">
      <h2>오늘의 스코어 TOP 5</h2>
      <div className="topScoresGrid">
        {top5.map((stock) => {
          const score = Math.round(Number(stock?.totalScore ?? 0));
          return (
            <Link href={`/stock/${stock.code}`} key={stock.code} className="scoreCard">
              <p className="scoreCardName">{cleanStockName(stock.name)}</p>
              <p className="scoreCardCode">{stock.market} · {stock.code}</p>
              <strong className="scoreCardValue" style={{ color: getScoreGaugeColor(score) }}>
                {score}점
              </strong>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .topScoresSection {
          margin-top: 20px;
        }
        h2 {
          margin: 0 0 14px;
          font-size: 1.3rem;
          letter-spacing: -0.03em;
        }
        .topScoresGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }
        .scoreCard {
          background: var(--color-card-bg);
          border-radius: var(--radius-card);
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .scoreCardName {
          margin: 0;
          font-weight: 800;
          font-size: 0.98rem;
        }
        .scoreCardCode {
          margin: 0;
          color: #64748b;
          font-size: 0.78rem;
        }
        .scoreCardValue {
          margin-top: 6px;
          font-size: 1.4rem;
          letter-spacing: -0.03em;
        }
        @media (max-width: 900px) {
          .topScoresGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  );
}
