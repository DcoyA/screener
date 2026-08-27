"use client";

import { styles } from "../styles";
import { POPULAR_STOCKS } from "../lib/constants";
import { normalizeStockName } from "../../lib/stockName";

export default function StockSearchPanel({
  searchCode,
  onSearchCodeChange,
  onSearch,
  onSelectPopular,
  selectedPopularCode,
  loadingQuote,
  wishlistStocks,
  code,
  onSelectWishlist,
}) {
  return (
    <aside style={styles.leftPanel}>
      <h2 style={styles.panelTitle}>종목 검색</h2>
      <div style={styles.searchBox}>
        <input
          style={styles.input}
          value={searchCode}
          onChange={(event) => onSearchCodeChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
          placeholder="종목코드 예: 005930"
        />
        <button style={styles.searchButton} onClick={onSearch} disabled={loadingQuote}>
          {loadingQuote ? "조회중" : "조회"}
        </button>
      </div>

      <h3 style={styles.smallTitle}>인기 종목</h3>
      <div style={styles.stockList}>
        {POPULAR_STOCKS.map((stock) => (
          <button
            key={stock.code}
            style={{ ...styles.stockButton, ...(selectedPopularCode === stock.code ? styles.stockButtonActive : {}) }}
            onClick={() => onSelectPopular(stock)}
          >
            <span>{normalizeStockName(stock.name)}</span>
            <em>{stock.code}</em>
          </button>
        ))}
        {wishlistStocks.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 800, marginBottom: "8px" }}>
              내 관심종목
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {wishlistStocks.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => onSelectWishlist(item)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "999px",
                    border: item.code === code ? "1px solid #111827" : "1px solid #dbe3f0",
                    background: item.code === code ? "#111827" : "#fff",
                    color: item.code === code ? "#fff" : "#334155",
                    fontWeight: 800,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ★ {normalizeStockName(item.name)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
