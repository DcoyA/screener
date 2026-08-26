import Link from "next/link";
import { formatPrice, getUpsideClass, formatUpsideDisplay, formatTargetPriceBand } from "../../lib/homeData";
import { cleanStockName } from "../../lib/stockName";

export default function StrategySection({ strategyCards }) {
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
                    <h4>{cleanStockName(section.stock.name)}</h4>
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
                    <strong className="targetLine">{formatTargetPriceBand(section.stock)}</strong>
                    {section.stock.holdingDiscount && section.stock.metrics?.targetPrice ? (
                      <small style={{ display: "block", marginTop: 2, color: "#94a3b8", fontSize: ".68rem", fontWeight: 700 }}>지주사 할인 30% 반영</small>
                    ) : null}
                  </div>
                </div>

                <p className={getUpsideClass(section.stock.metrics?.upside)}>
                  상승여력 {formatUpsideDisplay(section.stock)}
                </p>

                {section.momentumWarning ? (
                  <p
                    style={{
                      margin: "0 0 10px",
                      padding: "6px 10px",
                      borderRadius: 10,
                      background: "#fffbeb",
                      color: "#92400e",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                    }}
                  >
                    ⚠ 최근 이미 많이 올랐습니다
                  </p>
                ) : null}

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
