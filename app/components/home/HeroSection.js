"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function HeroSection({ updatedAt, stocks = [] }) {
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
    <section className="hero">
      <div className="heroTop">
        <div className="heroMain">
          <p className="badge">OFFICIAL DATA LIVE</p>
          <h1>
            종목을 발굴하려면, <br />
            데이터부터 분석해야 한다
          </h1>
          <p className="desc">
            메인에서는 데이터 기반으로 접근 방식을 정리합니다.
            <br />
            단기 / 연간 / 장기 관점을 나눠서, 같은 종목도 지금은 어떻게 봐야 하는지 다르게 보여줍니다.
            <br />
            종목을 자세히 보고 싶다면 랭킹 페이지에서 확인하세요.
          </p>

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
                            <span className="searchResultName">{stock.name}</span>
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

          <div className="heroPointRow">
            <span className="heroPoint">단기: 흐름과 거래대금 중심</span>
            <span className="heroPoint">연간: 점수와 실적 안정성 중심</span>
            <span className="heroPoint">장기: 저평가와 재무 구조 중심</span>
          </div>
          <div className="heroActions">
            <Link className="primaryBtn" href="/ranking">
              상위 랭킹 보기
            </Link>
            <Link className="secondaryBtn" href="/reports">
              이번 주 리포트 보기
            </Link>
          </div>
        </div>

        <aside className="updateBox" aria-label="업데이트 날짜">
          <span className="updateLabel">업데이트</span>
          <strong>{updatedAt}</strong>
          <p className="updateDesc">최근 자동 수집 및 분석 반영일</p>
        </aside>

        <div className="heroCharacter" aria-hidden="true">
          <div className="heroCharacterGlow" />
          <Image src="/vegeta-style.png" alt="" fill className="heroCharacterImage" priority />
        </div>
      </div>
    </section>
  );
}
