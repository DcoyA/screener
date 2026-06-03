import Link from "next/link";
import { notFound } from "next/navigation";
import stocks from "../../data/stocks.json";

const SCORE_META = [
  {
    key: "value",
    label: "가치",
    max: 30,
    desc: "저평가 정도를 반영합니다. PER, PBR, 저평가 보너스를 합산합니다.",
    children: [
      { key: "perScore", label: "PER", max: 12 },
      { key: "pbrScore", label: "PBR", max: 12 },
      { key: "discountBonus", label: "저평가 보너스", max: 6 },
    ],
  },
  {
    key: "quality",
    label: "품질",
    max: 25,
    desc: "수익성과 효율성을 반영합니다. 영업이익률, ROE, 이익 안정성을 반영합니다.",
    children: [
      { key: "operatingMarginScore", label: "영업이익률", max: 10 },
      { key: "roeScore", label: "ROE", max: 10 },
      { key: "profitStabilityScore", label: "이익 안정성", max: 5 },
    ],
  },
  {
    key: "safety",
    label: "안정성",
    max: 20,
    desc: "재무 안정성과 손익 안전성을 반영합니다. 부채비율과 이익 안전성을 기준으로 계산됩니다.",
    children: [
      { key: "debtRatioScore", label: "부채비율", max: 10 },
      { key: "earningsSafetyScore", label: "이익 안전성", max: 10 },
    ],
  },
  {
    key: "market",
    label: "시장성",
    max: 15,
    desc: "시장 규모와 유동성을 반영합니다. 시가총액과 거래대금이 반영됩니다.",
    children: [
      { key: "marketCapScore", label: "시가총액", max: 7 },
      { key: "liquidityScore", label: "유동성", max: 8 },
    ],
  },
  {
    key: "change",
    label: "변화",
    max: 10,
    desc: "성장 흐름을 반영합니다. 매출, 영업이익, 순이익 성장률이 반영됩니다.",
    children: [
      { key: "revenueGrowthScore", label: "매출 성장", max: 4 },
      { key: "operatingIncomeGrowthScore", label: "영업이익 성장", max: 4 },
      { key: "netIncomeGrowthScore", label: "순이익 성장", max: 2 },
    ],
  },
];

function getCategoryScore(stock, key) {
  if (stock?.scoreBreakdown?.[key] !== undefined) {
    return stock.scoreBreakdown[key];
  }

  if (key === "value") return stock?.valueScore ?? 0;
  if (key === "quality") return stock?.qualityScore ?? 0;
  if (key === "safety") return stock?.safetyScore ?? 0;
  if (key === "market") return stock?.marketScore ?? 0;
  if (key === "change") return stock?.changeScore ?? 0;
  return 0;
}

function getChildScore(stock, key) {
  return stock?.scoreBreakdown?.[key] ?? 0;
}

export default async function StockDetailPage({ params }) {
  const { code } = await params;
  const stock = stocks.find((item) => item.code === code);

  if (!stock) {
    notFound();
  }

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/ranking" className="backBtn">
            ← 랭킹으로 돌아가기
          </Link>
        </div>

        <section className="pageHero">
          <div>
            <p className="marketBadge">{stock.market}</p>
            <h1>{stock.name}</h1>
            <p className="stockCode">종목코드 {stock.code}</p>
            <p className="summaryText">{stock.summary}</p>
          </div>
        </section>

        <div className="infoGrid">
          <section className="infoCard">
            <h2>상세 설명</h2>
            <p>{stock.description}</p>
          </section>

          <section className="infoCard">
            <h2>리스크 체크</h2>
            <p>{stock.risk}</p>
          </section>
        </div>

        <section className="scoreSection">
          <div className="scoreSectionHeader">
            <div>
              <p className="scoreEyebrow">SCORE SYSTEM</p>
              <h2>점수 구성</h2>
              <p className="scoreDesc">
                총점은 100점 만점이며, 가치·품질·안정성·시장성·변화 5개 축으로 계산됩니다.
              </p>
            </div>

            <div className="totalScoreHero">
              <span className="totalScoreLabel">총점</span>
              <strong>{stock.totalScore}</strong>
              <span className="totalScoreMax">/ 100점</span>
            </div>
          </div>

          <div className="scoreGrid">
            {SCORE_META.map((item) => (
              <div className="scoreCard" key={item.key}>
                <div className="scoreCardTop">
                  <span className="scoreName">{item.label}</span>
                  <span className="scoreValue">
                    {getCategoryScore(stock, item.key)} / {item.max}
                  </span>
                </div>

                <p className="scoreMeaning">{item.desc}</p>

                <div className="scoreBreakdownList">
                  {item.children.map((child) => (
                    <div className="scoreBreakdownItem" key={child.key}>
                      <span className="scoreBreakdownLabel">{child.label}</span>
                      <span className="scoreBreakdownValue">
                        {getChildScore(stock, child.key)} / {child.max}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <style jsx>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          color: #0f172a;
        }
        .topLinks {
          margin-bottom: 26px;
        }
        .backBtn {
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
        .pageHero {
          margin-bottom: 28px;
        }
        .marketBadge {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.82rem;
          font-weight: 800;
          margin: 0 0 18px;
        }
        h1 {
          margin: 0 0 14px;
          font-size: clamp(2.2rem, 4vw, 3.4rem);
          letter-spacing: -0.04em;
        }
        .stockCode {
          margin: 0 0 12px;
          color: #64748b;
          font-weight: 700;
        }
        .summaryText {
          margin: 0;
          color: #475569;
          line-height: 1.8;
          font-size: 1.02rem;
          max-width: 920px;
        }
        .infoGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 28px;
        }
        .infoCard {
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          padding: 24px;
          background: #ffffff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }
        .infoCard h2 {
          margin: 0 0 14px;
          font-size: 1.6rem;
          letter-spacing: -0.03em;
        }
        .infoCard p {
          margin: 0;
          color: #475569;
          line-height: 1.8;
        }
        .scoreSection {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .scoreSectionHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }
        .scoreEyebrow {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.82rem;
          font-weight: 800;
          margin: 0 0 14px;
        }
        .scoreSection h2 {
          margin: 0 0 10px;
          font-size: 1.7rem;
          letter-spacing: -0.03em;
        }
        .scoreDesc {
          margin: 0;
          color: #64748b;
          line-height: 1.7;
          font-size: 0.98rem;
          max-width: 680px;
        }
        .totalScoreHero {
          min-width: 180px;
          padding: 18px 20px;
          border-radius: 20px;
          background: #0f172a;
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
        }
        .totalScoreLabel {
          font-size: 0.88rem;
          font-weight: 700;
          opacity: 0.82;
          margin-bottom: 8px;
        }
        .totalScoreHero strong {
          font-size: 2.2rem;
          line-height: 1;
          letter-spacing: -0.04em;
        }
        .totalScoreMax {
          margin-top: 6px;
          font-size: 0.95rem;
          opacity: 0.82;
        }
        .scoreGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .scoreCard {
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 20px;
          background: #ffffff;
        }
        .scoreCardTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .scoreName {
          font-size: 1.08rem;
          font-weight: 800;
          color: #0f172a;
        }
        .scoreValue {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 96px;
          padding: 10px 14px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          font-weight: 800;
        }
        .scoreMeaning {
          margin: 0 0 14px;
          color: #475569;
          line-height: 1.75;
          font-size: 0.95rem;
        }
        .scoreBreakdownList {
          display: grid;
          gap: 10px;
        }
        .scoreBreakdownItem {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .scoreBreakdownLabel {
          color: #475569;
          font-size: 0.95rem;
          font-weight: 700;
        }
        .scoreBreakdownValue {
          color: #0f172a;
          font-weight: 800;
          flex-shrink: 0;
        }
        @media (max-width: 900px) {
          .infoGrid,
          .scoreGrid {
            grid-template-columns: 1fr;
          }
          .totalScoreHero {
            width: 100%;
          }
        }
        @media (max-width: 640px) {
          .container {
            padding: 24px 18px 64px;
          }
          .scoreSection,
          .infoCard {
            padding: 22px;
          }
        }
      `}</style>
    </>
  );
}
