"use client";

import Link from "next/link";
import { styles } from "../styles";
import { formatWon, formatRate, toNumber } from "../lib/format";
import { normalizeStockName } from "../../lib/stockName";

export default function ChartPanel({
  name,
  code,
  price,
  change,
  rate,
  candles,
  chartData,
  loadingQuote,
  quoteError,
  tradeMarkers,
  onRefresh,
  fomoScore,
  fomoLabel,
  showFomoTip,
  onDismissFomoTip,
}) {
  return (
    <section style={styles.centerPanel}>
      <div style={styles.quoteHeader} className="dt-quote-header">
        <div>
          <div style={styles.stockName}>{name ? normalizeStockName(name) : code}</div>
          <div style={styles.stockCode}>{code}</div>
          {code && (
            <Link
              href={`/stock/${code}`}
              style={{ display: "inline-block", marginTop: "6px", fontSize: "13px", fontWeight: 800, color: "#0369a1", textDecoration: "none" }}
            >
              종목 상세 진단 보기 →
            </Link>
          )}
        </div>
        <div style={styles.priceArea}>
          <div style={styles.nowPrice}>{price ? formatWon(price) : "-"}</div>
          <div style={toNumber(rate) >= 0 ? styles.upText : styles.downText}>
            {change ? formatWon(change) : "-"} / {rate ? formatRate(rate) : "-"}
          </div>
        </div>
      </div>

      <div style={styles.chartPanel}>
        <div style={styles.chartToolbar} className="dt-chart-toolbar">
          <div>
            <strong>당일 1분봉</strong>
            <span style={styles.chartSubText}>최근 {candles.length || 0}개 캔들 · 체결마커 {tradeMarkers.length}개</span>
          </div>
          <button style={styles.chartRefreshButton} onClick={onRefresh} disabled={loadingQuote}>
            {loadingQuote ? "조회 중" : "시세/차트 새로고침"}
          </button>
        </div>

        {quoteError && <div style={styles.chartWarning}>{quoteError}</div>}

        <div style={styles.realChart} className="dt-real-chart">
          {chartData.length === 0 ? (
            <div style={styles.chartEmpty}>{loadingQuote ? "분봉 데이터를 불러오는 중입니다." : "분봉 데이터가 없습니다."}</div>
          ) : (
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
                      background: item.isUp ? "#ef4444" : "#2563eb",
                    }}
                  />
                  <div
                    style={{
                      ...styles.realCandle,
                      top: `${item.bodyTop}%`,
                      height: `${item.bodyHeight}%`,
                      background: item.isUp ? "#ef4444" : "#2563eb",
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
          )}
        </div>
      </div>

      {showFomoTip && (
        <div style={styles.fomoTip}>
          <p>
            FOMO 위험도는 매수 사유, 손절가 설정 여부, 보유기간, 주문금액을 기준으로
            충동매수 가능성을 계산해요. 실전 투자에서도 손절가·목표가를 미리 정하는 습관을 연습해보세요.
          </p>
          <button style={styles.miniButton} onClick={onDismissFomoTip}>확인했어요</button>
        </div>
      )}

      <div style={styles.fomoBox} className="dt-fomo-box">
        <div>
          <strong>FOMO 위험도 · {fomoLabel}</strong>
          <p>매수 이유, 손절가 여부, 보유기간, 주문금액을 기준으로 충동매수 가능성을 임시 계산합니다.</p>
        </div>
        <div style={styles.fomoScore}>{fomoScore}</div>
      </div>
    </section>
  );
}
