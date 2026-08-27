"use client";

import Link from "next/link";
import { styles } from "../styles";
import { formatWon, formatRate, toNumber } from "../lib/format";
import { normalizeStockName } from "../../lib/stockName";
import { FOMO_BAND_TEXT } from "../lib/fomo";

function PriceBasisTag({ priceBasis, marketOpen }) {
  // 실시간 시세가 아니라 종가 기준이면 반드시 알린다(실시간 오해 방지).
  const isRealtime = priceBasis === "realtime" || marketOpen === true;
  return (
    <span
      style={{
        display: "inline-block",
        marginTop: "6px",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 800,
        background: isRealtime ? "var(--ruby-100)" : "var(--ruby-100)",
        color: isRealtime ? "var(--ruby-700)" : "var(--ruby-700)",
      }}
    >
      {isRealtime ? "장중 실시간" : "종가 기준 모의체결"}
    </span>
  );
}

function CandleArea({ quoteState, candles, candleInterval, chartData, tradeMarkers, marketOpen, onRetry }) {
  if (quoteState === "loading") {
    return <div style={styles.chartEmpty}>차트를 불러오는 중입니다…</div>;
  }
  if (quoteState === "error") {
    return (
      <div style={styles.chartEmpty}>
        차트 데이터를 불러오지 못했습니다.
        <button style={{ ...styles.chartRefreshButton, marginTop: 12 }} onClick={onRetry}>
          다시 시도
        </button>
      </div>
    );
  }
  if (chartData.length === 0) {
    // ready인데 캔들이 없다 = 고장이 아님. 1분봉이면 장 시작 전, 그 외면 무데이터.
    if (candleInterval === "minute" && marketOpen === false) {
      return <div style={styles.chartEmpty}>1분봉은 장 시작 후 표시됩니다 (평일 09:00~15:30).</div>;
    }
    return <div style={styles.chartEmpty}>표시할 차트 데이터가 없습니다.</div>;
  }

  return (
    <div style={styles.candleChart}>
      {chartData.map((item, index) => (
        <div
          key={`${item.date}-${item.time}-${index}`}
          style={styles.realCandleWrap}
          title={`${item.label} / O ${item.open} H ${item.high} L ${item.low} C ${item.close}`}
        >
          <div
            style={{
              ...styles.wick,
              top: `${item.highTop}%`,
              height: `${Math.max(item.lowTop - item.highTop, 2)}%`,
              background: item.isUp ? "var(--signal-up)" : "var(--signal-down)",
            }}
          />
          <div
            style={{
              ...styles.realCandle,
              top: `${item.bodyTop}%`,
              height: `${item.bodyHeight}%`,
              background: item.isUp ? "var(--signal-up)" : "var(--signal-down)",
            }}
          />
          {index % 5 === 0 && <span style={styles.timeLabel}>{item.label}</span>}
        </div>
      ))}

      {tradeMarkers.map((marker) => (
        <div
          key={marker.id}
          style={{
            ...styles.tradeMarker,
            left: `${marker.left}%`,
            top: `${marker.top}%`,
            ...(marker.side === "BUY" ? styles.buyMarker : styles.sellMarker),
          }}
          title={`${marker.label} ${formatWon(marker.price)} / ${marker.quantity.toLocaleString()}주`}
        >
          {marker.label}
        </div>
      ))}
    </div>
  );
}

export default function ChartPanel({
  name,
  code,
  price,
  change,
  rate,
  candles,
  candleInterval,
  chartData,
  quoteState,
  quoteError,
  marketOpen,
  priceBasis,
  tradeMarkers,
  onRetry,
  fomoScore,
  fomoLabel,
  showFomoTip,
  onDismissFomoTip,
}) {
  const chartTitle = candleInterval === "day" ? "일봉 (KIS 분봉 대체)" : "당일 1분봉";

  return (
    <section style={styles.centerPanel}>
      <div style={styles.quoteHeader} className="dt-quote-header">
        <div>
          <div style={styles.stockName}>{name ? normalizeStockName(name) : code}</div>
          <div style={styles.stockCode}>{code}</div>
          {code && (
            <Link
              href={`/stock/${code}`}
              style={{ display: "inline-block", marginTop: "6px", fontSize: "13px", fontWeight: 800, color: "var(--ruby-700)", textDecoration: "none" }}
            >
              종목 상세 진단 보기 →
            </Link>
          )}
        </div>
        <div style={styles.priceArea}>
          <div style={styles.nowPrice}>{quoteState === "ready" && price ? formatWon(price) : "-"}</div>
          <div style={toNumber(rate) >= 0 ? styles.upText : styles.downText}>
            {quoteState === "ready" && change ? formatWon(change) : "-"} / {quoteState === "ready" && rate ? formatRate(rate) : "-"}
          </div>
          <div>
            <PriceBasisTag priceBasis={priceBasis} marketOpen={marketOpen} />
          </div>
        </div>
      </div>

      <div style={styles.chartPanel}>
        <div style={styles.chartToolbar} className="dt-chart-toolbar">
          <div>
            <strong>{chartTitle}</strong>
            <span style={styles.chartSubText}>
              최근 {candles.length || 0}개 캔들 · 체결마커 {tradeMarkers.length}개
            </span>
          </div>
          <button style={styles.chartRefreshButton} onClick={onRetry} disabled={quoteState === "loading"}>
            {quoteState === "loading" ? "조회 중" : "시세/차트 새로고침"}
          </button>
        </div>

        {quoteError ? <div style={styles.chartWarning}>{quoteError}</div> : null}

        <div style={styles.realChart} className="dt-real-chart">
          <CandleArea
            quoteState={quoteState}
            candles={candles}
            candleInterval={candleInterval}
            chartData={chartData}
            tradeMarkers={tradeMarkers}
            marketOpen={marketOpen}
            onRetry={onRetry}
          />
        </div>
      </div>

      {showFomoTip && (
        <div style={styles.fomoTip}>
          <p>
            FOMO 위험도는 매수 사유, 손절가 설정 여부, 보유기간, 주문금액을 기준으로 충동매수
            가능성을 점수화합니다. 실전에서도 손절가·목표가를 미리 정하는 습관을 연습해 보세요.
          </p>
          <button style={styles.miniButton} onClick={onDismissFomoTip}>확인했어요</button>
        </div>
      )}

      <div style={styles.fomoBox} className="dt-fomo-box">
        <div>
          <strong>FOMO 위험도 · {fomoLabel}</strong>
          <p style={{ margin: "4px 0 0", fontSize: "12px", opacity: 0.75 }}>구간 기준 {FOMO_BAND_TEXT}</p>
        </div>
        <div style={styles.fomoScore}>
          {fomoScore}
          <span style={{ fontSize: "12px", fontWeight: 700, opacity: 0.6 }}> / 100</span>
        </div>
      </div>
    </section>
  );
}
