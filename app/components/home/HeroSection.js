"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cleanStockName } from "../../lib/stockName";
import { fetchQuoteSnapshot } from "../../lib/quoteCard";
import StockQuoteCard from "../StockQuoteCard";
import SearchPreviewCard from "./SearchPreviewCard";

const MAX_SUGGESTIONS = 8;
const QUOTE_TIMEOUT_MS = 10000;

// 검색 무입력 시 예시로 띄우는 종목. 삼성전자를 쓰는 이유:
//  (1) 국내 인지도 1위 → "이 서비스가 종목당 어떤 정보를 주는지" 데모가 즉시 이해됨.
//  (2) fairValueStatus=ok라 적정가·상승여력까지 전 항목이 채워진 예시를 보여줄 수 있음.
// stocks.json에 없으면(사실상 불가) 프리뷰를 렌더하지 않는다.
const HOME_PREVIEW_STOCK_CODE = "005930";

function normalize(value) {
  return (value || "").toString().trim().toLowerCase();
}

function searchStocks(stocks, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const matches = stocks.filter((stock) => {
    const name = normalize(stock?.name);
    const code = normalize(stock?.code);
    return name.includes(normalizedQuery) || code === normalizedQuery;
  });

  return matches
    .sort((a, b) => Number(b?.totalScore ?? 0) - Number(a?.totalScore ?? 0))
    .slice(0, MAX_SUGGESTIONS);
}

// 홈 검색 결과 블록(STEP 7): 드롭다운에서 종목을 고르면 /stock 으로 이동하지 않고
// 검색바 바로 아래에 시세 카드(StockQuoteCard)를 인라인으로 띄운다. 상세 분석은
// 카드 안의 "상세 분석 보기" 링크로 간다.
export default function HeroSection({ stocks = [], updatedAt }) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selected, setSelected] = useState(null);
  const [quoteState, setQuoteState] = useState("idle"); // idle | loading | error | ready
  const [quoteError, setQuoteError] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const blurTimeoutRef = useRef(null);
  const abortRef = useRef(null);

  const results = useMemo(() => searchStocks(stocks, query), [stocks, query]);
  const showDropdown = isFocused && query.trim().length > 0;

  // 무입력이고 아직 아무 종목도 안 고른 상태에서만 예시 프리뷰를 보여준다.
  // 검색어가 들어오거나 결과를 고르면 검색 결과 블록이 그 자리를 대신한다.
  const previewStock = useMemo(
    () => stocks.find((s) => s?.code === HOME_PREVIEW_STOCK_CODE) || null,
    [stocks]
  );
  const showPreview = query.trim() === "" && !selected;

  const loadQuote = (stock) => {
    if (!stock?.code) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), QUOTE_TIMEOUT_MS);

    setSelected({ code: stock.code, name: cleanStockName(stock.name), market: stock.market || "" });
    setQuoteState("loading");
    setQuoteError("");
    setSnapshot(null);
    setIsFocused(false);

    fetchQuoteSnapshot(stock.code, { signal: controller.signal })
      .then((data) => {
        setSnapshot(data.snapshot);
        setQuoteState("ready");
      })
      .catch((err) => {
        setQuoteError(
          err?.name === "AbortError"
            ? "시세 조회가 지연되고 있어요. 잠시 후 다시 시도해 주세요."
            : err?.message || "시세를 불러오지 못했습니다."
        );
        setQuoteState("error");
      })
      .finally(() => clearTimeout(timer));
  };

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (results.length > 0) loadQuote(results[0]);
  };

  const handleQueryChange = (value) => {
    setQuery(value);
    // 새로 타이핑하면 이전 결과 블록은 접는다.
    if (selected) {
      setSelected(null);
      setQuoteState("idle");
      setSnapshot(null);
    }
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsFocused(true);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => setIsFocused(false), 120);
  };

  return (
    <section className="compactSearchHero" id="homeSearch">
      <form className="searchBarForm" onSubmit={handleSubmit} role="search">
        <div className="searchBarWrap">
          <input
            id="homeSearchInput"
            type="text"
            className="searchBarInput"
            placeholder="종목명 또는 종목코드로 검색 (예: 삼성전자, 005930)"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-label="종목 검색"
            autoComplete="off"
          />
          <button type="submit" className="searchBarBtn" aria-label="검색">
            검색
          </button>

          {showDropdown && (
            <div className="searchDropdown">
              {results.length > 0 ? (
                <ul className="searchResultList">
                  {results.map((stock) => (
                    <li key={stock.code}>
                      <button
                        type="button"
                        className="searchResultItem"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => loadQuote(stock)}
                      >
                        <span className="searchResultName">{cleanStockName(stock.name)}</span>
                        <span className="searchResultCode">{stock.code}</span>
                        {stock.market && (
                          <span className="searchResultMarket">{stock.market}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="searchNoResult">종목명 일부만 입력해 보세요</p>
              )}
            </div>
          )}
        </div>
      </form>

      {selected && (
        <div className="homeQuoteBlock">
          {quoteState === "loading" && (
            <p className="homeQuoteStatus">{cleanStockName(selected.name)} 시세를 불러오는 중…</p>
          )}
          {quoteState === "error" && (
            <div className="homeQuoteStatus homeQuoteStatus--error">
              <p>{quoteError}</p>
              <button type="button" onClick={() => loadQuote(selected)}>다시 시도</button>
            </div>
          )}
          {quoteState === "ready" && (
            <StockQuoteCard
              name={selected.name}
              market={selected.market}
              code={selected.code}
              snapshot={snapshot}
            />
          )}
        </div>
      )}

      {showPreview && previewStock && <SearchPreviewCard stock={previewStock} />}

      {updatedAt && <p className="updatedAtCaption">최근 업데이트: {updatedAt}</p>}

      <style jsx>{`
        .compactSearchHero {
          position: relative;
          margin-top: 24px;
        }
        .homeQuoteBlock {
          margin-top: 16px;
          max-width: 640px;
        }
        .homeQuoteStatus {
          margin: 0;
          padding: 18px;
          text-align: center;
          color: var(--ink-600);
          font-weight: 700;
          border: 1px solid var(--ink-300);
          border-radius: var(--radius-card);
          background: #ffffff;
        }
        .homeQuoteStatus--error button {
          margin-top: 10px;
          padding: 8px 18px;
          border-radius: 10px;
          border: 1px solid var(--ink-300);
          background: #ffffff;
          font-weight: 800;
          cursor: pointer;
        }
        .updatedAtCaption {
          margin: 10px 0 0;
          color: var(--ink-600);
          font-size: 0.8rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </section>
  );
}
