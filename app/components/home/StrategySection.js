import Link from "next/link";
import { cleanStockName } from "../../lib/stockName";
import { getUnifiedGrade } from "../../lib/grade";
import { formatScoreRank } from "../../lib/scoreStats";

// 카드의 "비교 기준 1개"는 종합판단점수 + 전 종목 백분위(scoreStats).
// 예전엔 market_state.json의 avgTotalScore(≈ 상위 30 평균 74)를 "전체 평균"이라
// 부르며 비교해서, 전체 상위권인 62점 종목이 "평균보다 낮아요"로 찍혔다 - 그 버그.
const SLOT_EMPTY_TEXT = {
  short: "오늘은 단기 관점 후보가 없습니다.",
  annual: "오늘은 연간 관점 후보가 없습니다.",
  long: "오늘은 장기 관점 후보가 없습니다.",
};

function buildCompareLine(stock) {
  const score = Number(stock?.finalPickMeta?.finalScore);
  if (!Number.isFinite(score)) return null;
  return `종합판단점수 ${formatScoreRank(score)}`;
}

export default function StrategySection({ strategyCards }) {
  return (
    <section className="strategySection">
      <div className="sectionHeaderRow">
        <div>
          <h2 className="sectionTitle">보유기간별 추천종목</h2>
          <p className="sectionDesc">
            얼마나 오래 들고 갈지에 따라 나눠봤어요.
          </p>
        </div>
      </div>

      <div className="strategyGrid">
        {strategyCards.map((section) => {
          const stock = section.stock;
          const grade = stock ? getUnifiedGrade(stock) : null;
          const compareLine = stock ? buildCompareLine(stock) : null;

          return (
            <div className="strategyCard" key={section.key}>
              <span className="strategyBadge">{section.badge}</span>

              {stock ? (
                <>
                  <h3>{cleanStockName(stock.name)}</h3>
                  {grade && (
                    <span className="gradeBadge" style={{ color: grade.color, background: grade.bg }}>
                      {grade.label}
                    </span>
                  )}
                  <p className="conclusionLine">{grade?.description}</p>
                  {compareLine && <p className="compareLine">{compareLine}</p>}
                  <Link className="linkBtn" href={`/stock/${stock.code}`}>
                    자세히 보기
                  </Link>
                </>
              ) : (
                <div className="emptyStateBox">
                  <p>{SLOT_EMPTY_TEXT[section.key] || "오늘은 이 관점 후보가 없습니다."}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
