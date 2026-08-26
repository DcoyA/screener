"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cleanStockName } from "../../lib/stockName";

const MAX_SUGGESTIONS = 8;

function normalize(value) {
  return (value || "").toString().trim().toLowerCase();
}

function searchStocks(stocks, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const matches = stocks.filter((stock) => {
    const name = normalize(stock?.name);
    const code = normalize(stock?.code);
    return name.includes(normalizedQuery) || code.includes(normalizedQuery);
  });

  return matches
    .sort((a, b) => Number(b?.totalScore ?? 0) - Number(a?.totalScore ?? 0))
    .slice(0, MAX_SUGGESTIONS);
}

// CLEO 홈 화면의 검색바처럼 압축된 형태로만 제공한다.
// (긴 마케팅 카피, 캐릭터 이미지, 중복 CTA 버튼은 상단 네비/구독 배너와 역할이
// 겹쳐서 제거했다 - 이전에는 캐릭터 이미지가 아래 버튼과 겹쳐 클릭이 막히는
// 문제도 있었다.)
export default function HeroSection({ stocks = [], updatedAt }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeoutRef = useRef(null);

  const results = useMemo(() => searchStocks(stocks, query), [stocks, query]);
  const showDropdown = isFocused && query.trim().length > 0;

  const goToStock = (code) => {
    if (!code) return;
    setQuery("");
    setIsFocused(false);
    router.push(`/stock/${code}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (results.length > 0) {
      goToStock(results[0].code);
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
    // 클릭 이벤트가 먼저 처리되도록 약간의 지연을 둔다
    blurTimeoutRef.current = setTimeout(() => {
      setIsFocused(false);
    }, 120);
  };

  return (
    <section className="compactSearchHero">
      <form className="searchBarForm" onSubmit={handleSubmit} role="search">
        <div className="searchBarWrap">
          <input
            type="text"
            className="searchBarInput"
            placeholder="종목명 또는 종목코드로 검색 (예: 삼성전자, 005930)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
                        onClick={() => goToStock(stock.code)}
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
                <p className="searchNoResult">
                  검색 결과가 없습니다. 종목명 또는 코드를 다시 확인해주세요.
                </p>
              )}
            </div>
          )}
        </div>
      </form>
      {updatedAt && <p className="updatedAtCaption">최근 업데이트: {updatedAt}</p>}

      <style jsx>{`
        .compactSearchHero {
          position: relative;
          margin-top: 24px;
        }
        .updatedAtCaption {
          margin: 10px 0 0;
          color: #94a3b8;
          font-size: 0.8rem;
          font-weight: 700;
        }
      `}</style>
    </section>
  );
}
