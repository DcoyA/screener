"use client";

import { styles } from "../styles";
import { formatWon, formatRate } from "../lib/format";
import { normalizeStockName } from "../../lib/stockName";

export default function PositionTable({ portfolioSummary, loadingPositions, onRefresh }) {
  return (
    <div style={styles.tablePanel}>
      <div style={styles.panelTitleRow}>
        <h2 style={styles.panelTitle}>보유종목</h2>
        <button style={styles.miniButton} onClick={onRefresh} disabled={loadingPositions}>
          {loadingPositions ? "조회 중" : "현재가 새로고침"}
        </button>
      </div>

      {portfolioSummary.length === 0 ? (
        <div style={styles.empty}>아직 보유종목이 없습니다.</div>
      ) : (
        <div style={styles.table} className="dt-position-table">
          <div style={styles.tableHead} className="dt-position-head">
            <span>종목</span><span>수량</span><span>평균단가</span><span>현재가</span><span>평가금액</span><span>평가손익</span>
          </div>
          {portfolioSummary.map((item) => (
            <div key={item.code} style={styles.tableRow} className="dt-position-row">
              <span><strong>{normalizeStockName(item.name)}</strong><br /><em style={styles.codeText}>{item.code}</em></span>
              <span>{item.quantity.toLocaleString()}</span>
              <span>{formatWon(item.avgPrice)}</span>
              <span>{formatWon(item.currentPrice)}</span>
              <span>{formatWon(item.evalAmount)}</span>
              <span style={item.profitLoss >= 0 ? styles.upText : styles.downText}>
                {item.profitLoss >= 0 ? "+" : ""}{formatWon(item.profitLoss)}<br />{formatRate(item.profitRate)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
