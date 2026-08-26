import Link from "next/link";
import { cleanStockName } from "../../lib/stockName";
import { getUnifiedGrade } from "../../lib/grade";

// TASK 4-1 블록②. 문서 스펙: "카드 내용 = 종목명 / 한 줄 결론 / 등급 배지 /
// 비교 기준 1개 - 지금처럼 지표 5개를 다 넣지 않는다." 예전 카드는 가격·
// 적정가밴드·상승여력·근거박스·요약까지 다 넣고 있었어서 통째로 줄였다.
// "한 줄 결론"은 app/lib/grade.js의 등급별 설명(이미 한 문장)을 그대로
// 쓰고, "비교 기준 1개"는 market_state.json의 전체 평균 총점 대비로 만든다
// (없는 지표를 새로 만들지 않고 이미 계산되어 있는 값만 쓴다).
function buildCompareLine(stock, avgTotalScore) {
  const score = Number(stock?.finalPickMeta?.finalScore ?? stock?.totalScore);
  const avg = Number(avgTotalScore);
  if (!Number.isFinite(score) || !Number.isFinite(avg)) return null;
  const diff = score - avg;
  if (Math.abs(diff) < 0.5) return `총점 ${Math.round(score)}점, 전체 평균이랑 비슷해요`;
  return diff > 0
    ? `총점 ${Math.round(score)}점, 전체 평균(${Math.round(avg)}점)보다 높아요`
    : `총점 ${Math.round(score)}점, 전체 평균(${Math.round(avg)}점)보다 낮아요`;
}

export default function StrategySection({ strategyCards, avgTotalScore }) {
  return (
    <section className="strategySection">
      <div className="sectionHeaderRow">
        <div>
          <h2 className="sectionTitle">오늘 볼 만한 거 3개</h2>
          <p className="sectionDesc">
            얼마나 오래 들고 갈지에 따라 나눠봤어요.
          </p>
        </div>
      </div>

      <div className="strategyGrid">
        {strategyCards.map((section) => {
          const stock = section.stock;
          const grade = stock ? getUnifiedGrade(stock) : null;
          const compareLine = stock ? buildCompareLine(stock, avgTotalScore) : null;

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
                  <p>현재 기준으로 이 관점에 맞는 후보가 충분하지 않습니다.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
