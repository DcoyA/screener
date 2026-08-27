"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StockQuoteCard from "../components/StockQuoteCard";
import { fetchQuoteSnapshot } from "../lib/quoteCard";
import { cleanStockName } from "../lib/stockName";

const MAX_RESULTS = 20;
const QUOTE_TIMEOUT_MS = 10000;

function normalize(value) {
  return (value || "").toString().trim().toLowerCase();
}

// 종목명 부분일치 + 종목코드 정확일치. 초성 검색은 이번 범위 밖.
function runSearch(index, query) {
  const q = normalize(query);
  if (!q) return [];
  const matched = index.filter((item) => {
    const name = normalize(item.name);
    const code = normalize(item.code);
    return name.includes(q) || code === q;
  });
  // 코드 정확일치 → 이름이 질의로 시작 → 나머지, 그 안에서는 이름 짧은 순.
  return matched
    .sort((a, b) => {
      const aCode = normalize(a.code) === q ? 0 : 1;
      const bCode = normalize(b.code) === q ? 0 : 1;
      if (aCode !== bCode) return aCode - bCode;
      const aStarts = normalize(a.name).startsWith(q) ? 0 : 1;
      const bStarts = normalize(b.name).startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.length - b.name.length;
    })
    .slice(0, MAX_RESULTS);
}

export default function SearchClient({ index = [] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // {code, name, market}
  const [quoteState, setQuoteState] = useState("idle"); // idle | loading | error | ready
  const [quoteError, setQuoteError] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const abortRef = useRef(null);

  const results = useMemo(() => runSearch(index, query), [index, query]);

  const loadQuote = (stock) => {
    if (!stock?.code) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), QUOTE_TIMEOUT_MS);

    setSelected(stock);
    setQuoteState("loading");
    setQuoteError("");
    setSnapshot(null);

    fetchQuoteSnapshot(stock.code, { signal: controller.signal })
      .then((data) => {
        setSnapshot(data.snapshot);
        setQuoteState("ready");
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          setQuoteError("시세 조회가 지연되고 있어요. 잠시 후 다시 시도해 주세요.");
        } else {
          setQuoteError(err?.message || "시세를 불러오지 못했습니다.");
        }
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

  const showResults = query.trim().length > 0;

  return (
    <section className="searchPage">
      <h1 className="searchPageTitle">종목검색</h1>
      <p className="searchPageDesc">종목명 일부 또는 종목코드(6자리)로 찾을 수 있어요.</p>

      <form className="searchForm" onSubmit={handleSubmit} role="search">
        <input
          type="text"
          className="searchInput"
          placeholder="예: 삼성전자, 005930"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="종목 검색"
          autoComplete="off"
          autoFocus
        />
        <button type="submit" className="searchSubmit">검색</button>
      </form>

      {showResults && (
        <div className="searchResults">
          {results.length > 0 ? (
            <ul className="resultList">
              {results.map((stock) => (
                <li key={stock.code}>
                  <button
                    type="button"
                    className={`resultItem${selected?.code === stock.code ? " is-selected" : ""}`}
                    onClick={() => loadQuote(stock)}
                  >
                    <span className="resultName">{cleanStockName(stock.name)}</span>
                    <span className="resultCode">{stock.market ? `${stock.market} · ` : ""}{stock.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="noResult">종목명 일부만 입력해 보세요</p>
          )}
        </div>
      )}

      {selected && (
        <div className="quoteArea">
          {quoteState === "loading" && (
            <p className="quoteStatus">{cleanStockName(selected.name)} 시세를 불러오는 중…</p>
          )}
          {quoteState === "error" && (
            <div className="quoteStatus quoteStatus--error">
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

      <p className="searchDisclaimer">
        시세는 조회 시점 기준이며, 장중에는 지연될 수 있습니다. 투자 판단의 참고용입니다.
      </p>

      <style jsx>{`
        .searchPage {
          max-width: 640px;
          margin: 24px auto 60px;
        }
        .searchPageTitle {
          margin: 0 0 6px;
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--ink-900);
        }
        .searchPageDesc {
          margin: 0 0 18px;
          color: var(--ink-600);
          font-size: 0.92rem;
        }
        .searchForm {
          display: flex;
          gap: 8px;
        }
        .searchInput {
          flex: 1;
          height: 52px;
          border-radius: 14px;
          border: 1px solid var(--ink-300);
          padding: 0 16px;
          font-size: 1rem;
          outline: none;
          background: #ffffff;
          box-shadow: var(--shadow-card);
        }
        .searchInput:focus {
          border-color: var(--ruby-600);
          box-shadow: 0 0 0 4px rgba(122, 12, 31, 0.12);
        }
        .searchSubmit {
          height: 52px;
          padding: 0 22px;
          border-radius: 14px;
          border: none;
          background: var(--ruby-700);
          color: #ffffff;
          font-weight: 800;
          cursor: pointer;
        }
        .searchSubmit:hover {
          filter: brightness(1.08);
        }
        .searchResults {
          margin-top: 14px;
        }
        .resultList {
          list-style: none;
          margin: 0;
          padding: 0;
          border: 1px solid var(--ink-300);
          border-radius: 14px;
          overflow: hidden;
          background: #ffffff;
        }
        .resultList li + li {
          border-top: 1px solid var(--ink-300);
        }
        .resultItem {
          width: 100%;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
        }
        .resultItem:hover,
        .resultItem.is-selected {
          background: var(--page-bg);
        }
        .resultName {
          font-weight: 800;
          color: var(--ink-900);
        }
        .resultCode {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--ink-600);
        }
        .noResult {
          margin: 0;
          padding: 20px;
          text-align: center;
          color: var(--ink-600);
          font-weight: 700;
          border: 1px dashed var(--ink-300);
          border-radius: 14px;
        }
        .quoteArea {
          margin-top: 20px;
        }
        .quoteStatus {
          margin: 0;
          padding: 20px;
          text-align: center;
          color: var(--ink-600);
          font-weight: 700;
          border: 1px solid var(--ink-300);
          border-radius: var(--radius-card);
          background: #ffffff;
        }
        .quoteStatus--error button {
          margin-top: 10px;
          padding: 8px 18px;
          border-radius: 10px;
          border: 1px solid var(--ink-300);
          background: #ffffff;
          font-weight: 800;
          cursor: pointer;
        }
        .searchDisclaimer {
          margin: 28px 0 0;
          font-size: 0.78rem;
          color: var(--ink-600);
          line-height: 1.6;
        }
      `}</style>
    </section>
  );
}
