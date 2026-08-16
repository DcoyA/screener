import Link from "next/link";
import { formatPrice, formatPercent, getUpsideClass } from "../../lib/homeData";

export default function StrategySection({ strategyCards }) {
  return (
    <section className="strategySection">
      <div className="sectionHeaderRow">
        <div>
          <h2 className="sectionTitle">오늘의 투자 전략 3가지</h2>
          <p className="sectionDesc">
            종합/저평가 같은 기술적 기준보다, 지금 시장에서 실제로 어떻게 들고 갈지에 맞춘 관점으로 나눴습니다.
          </p>
        </div>
      </div>

      <div className="strategyGrid">
        {strategyCards.map((section) => (
          <div className="strategyCard" key={section.key}>
            <div className="strategyHeader">
              <span className="strategyBadge">{section.badge}</span>
              <Link href={section.actionHref} className="miniActionLink">
                {section.actionLabel}
              </Link>
            </div>
            <h3>{section.title}</h3>
            <p className="strategyDesc">{section.desc}</p>

            {section.stock ? (
              <>
                <div className="strategyStockTop">
                  <div>
                    <h4>{section.stock.name}</h4>
                    <p className="stockCode">{section.stock.market} · {section.stock.code}</p>
                  </div>
                  <div className="scoreChip">총점 {Number(section.stock.totalScore || 0).toFixed(0)}점</div>
                </div>

                <div className="candidatePriceMeta strategyMetaGrid">
                  <div className="candidatePriceItem">
                    <span className="candidatePriceLabel">최근 종가</span>
                    <strong className="priceLine">{formatPrice(section.stock.metrics?.closePrice)}</strong>
                  </div>
                  <div className="candidatePriceItem">
                    <span className="candidatePriceLabel">적정가 추정</span>
                    <strong className="targetLine">{formatPrice(section.stock.metrics?.targetPrice)}</strong>
                  </div>
                </div>

                <p className={getUpsideClass(section.stock.metrics?.upside)}>
                  상승여력 {formatPercent(section.stock.metrics?.upside)}
                </p>

                <div className="reasonBox">
                  <span className="reasonLabel">왜 이 관점에서 보나</span>
                  <p>{section.reason}</p>
                </div>

                <p className="summaryText short">{section.stock.summary}</p>
                <Link className="linkBtn" href={`/stock/${section.stock.code}`}>
                  종목 상세 보기
                </Link>
              </>
            ) : (
              <div className="emptyStateBox">
                <p>현재 기준으로 이 관점에 맞는 후보가 충분하지 않습니다.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
