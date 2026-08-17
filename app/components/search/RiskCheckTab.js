"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import WishlistButton from "../../components/WishlistButton";
import { getUnifiedGrade } from "../../lib/grade";
import GradeBadge from "../../components/GradeBadge";

const RISK_FILTER_CONFIG = {
  all: { label: "전체", title: "전체 리스크" },
  low: { label: "낮음", title: "낮음 리스크" },
  mid: { label: "보통", title: "보통 리스크" },
  high: { label: "주의", title: "주의 리스크" },
};

function getRiskClass(level) {
  if (level === "주의") return "riskBadge riskHigh";
  if (level === "보통") return "riskBadge riskMid";
  return "riskBadge riskLow";
}

function normalizeKeyword(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, "").trim();
}

function renderHighlightedName(name, query) {
  if (!query) return name;
  const lowerName = String(name).toLowerCase();
  const lowerQuery = String(query).toLowerCase();
  const directIndex = lowerName.indexOf(lowerQuery);
  if (directIndex === -1) return name;

  const before = name.slice(0, directIndex);
  const match = name.slice(directIndex, directIndex + query.length);
  const after = name.slice(directIndex + query.length);

  return (
    <>
      {before}
      <mark className="nameMark">{match}</mark>
      {after}
    </>
  );
}

function formatPrice(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

function buildRiskReason(item, price) {
  const parts = [];
  if (item?.level) parts.push(`리스크 수준 ${item.level}`);
  if (price && price !== "-") parts.push(`최근 종가 ${price}`);
  if (item?.title) parts.push(item.title);
  if (!parts.length) return "최근 확인이 필요한 위험 신호를 요약한 항목입니다.";
  return parts.join(" · ");
}

function buildCheckPointGuide(item) {
  if (item?.checkPoint) return item.checkPoint;
  return "최근 공시, 실적, 업황 변화 여부를 함께 확인하세요.";
}

function RiskCheckTabContent({ stocks, risks }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requestedCode = searchParams.get("code")?.trim() || "";
  const requestedName = searchParams.get("name")?.trim() || "";
  const requestedLevel = searchParams.get("level")?.trim() || "all";

  const initialKeyword = requestedCode || requestedName || "";
  const initialLevel = RISK_FILTER_CONFIG[requestedLevel] ? requestedLevel : "all";

  const [searchTerm, setSearchTerm] = useState(initialKeyword);
  const [selectedLevel, setSelectedLevel] = useState(initialLevel);
  const [highlightedCode, setHighlightedCode] = useState(requestedCode || "");
  const didAutoFocus = useRef(false);

  const updatedAt = risks[0]?.date || "-";
  const normalizedSearchTerm = normalizeKeyword(searchTerm);

  const stockMap = useMemo(() => {
    return Object.fromEntries(stocks.map((item) => [item.code, item]));
  }, []);

  useEffect(() => {
    setSelectedLevel(initialLevel);
  }, [initialLevel]);

  useEffect(() => {
    if (!initialKeyword) return;
    setSearchTerm(initialKeyword);
    if (requestedCode) setHighlightedCode(requestedCode);
  }, [initialKeyword, requestedCode]);

  const updateRoute = (nextLevel) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextLevel || nextLevel === "all") {
      params.delete("level");
    } else {
      params.set("level", nextLevel);
    }
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  };

  const handleLevelFilter = (nextLevel) => {
    setSelectedLevel(nextLevel);
    updateRoute(nextLevel);
    didAutoFocus.current = false;
  };

  const filteredRisks = useMemo(() => {
    let levelFiltered = risks;

    if (selectedLevel === "low") {
      levelFiltered = risks.filter((item) => item.level === "낮음");
    } else if (selectedLevel === "mid") {
      levelFiltered = risks.filter((item) => item.level === "보통");
    } else if (selectedLevel === "high") {
      levelFiltered = risks.filter((item) => item.level === "주의");
    }

    if (!normalizedSearchTerm) return levelFiltered;

    return levelFiltered.filter((item) => {
      const nameMatch = normalizeKeyword(item.name).includes(normalizedSearchTerm);
      const codeMatch = normalizeKeyword(item.code).includes(normalizedSearchTerm);
      return nameMatch || codeMatch;
    });
  }, [normalizedSearchTerm, selectedLevel]);

  useEffect(() => {
    if (!requestedCode || didAutoFocus.current) return;
    const exact = filteredRisks.find((item) => String(item.code) === String(requestedCode));
    if (!exact) return;

    const timer = setTimeout(() => {
      const target = document.getElementById(`risk-${exact.code}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        didAutoFocus.current = true;
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [requestedCode, filteredRisks]);

  const lowCount = useMemo(() => risks.filter((item) => item.level === "낮음").length, []);
  const midCount = useMemo(() => risks.filter((item) => item.level === "보통").length, []);
  const highCount = useMemo(() => risks.filter((item) => item.level === "주의").length, []);

  const levelTitle = RISK_FILTER_CONFIG[selectedLevel]?.title || "전체 리스크";
  const resultCountText = normalizedSearchTerm
    ? `검색 결과 ${filteredRisks.length}개 / ${levelTitle} 기준`
    : selectedLevel === "all"
      ? `상위 ${risks.length}개 종목에 대해서만 제공합니다.`
      : `${levelTitle} 기준 ${filteredRisks.length}개 종목을 보고 있습니다.`;

  return (
    <>
      <section className="pageHero">
        <div>
          <p className="badge">RISK CENTER</p>
          <h1>리스크 페이지</h1>
          <p className="desc">
            종목별로 최근 확인해야 할 위험 신호와 체크 포인트를 정리한 페이지입니다.
            <br />
            리스크 수준과 함께 다음 확인 항목을 빠르게 볼 수 있도록 구성했습니다.
          </p>
        </div>

        <div className="heroMetaWrap">
          <div className="updateBox">
            <span className="updateLabel">업데이트</span>
            <strong>{updatedAt}</strong>
          </div>

          <div className="riskCountRow">
            <button
              type="button"
              className={`miniStatCard low ${selectedLevel === "low" ? "active" : ""}`}
              onClick={() => handleLevelFilter("low")}
            >
              <span>낮음</span>
              <strong>{lowCount}</strong>
            </button>
            <button
              type="button"
              className={`miniStatCard mid ${selectedLevel === "mid" ? "active" : ""}`}
              onClick={() => handleLevelFilter("mid")}
            >
              <span>보통</span>
              <strong>{midCount}</strong>
            </button>
            <button
              type="button"
              className={`miniStatCard high ${selectedLevel === "high" ? "active" : ""}`}
              onClick={() => handleLevelFilter("high")}
            >
              <span>주의</span>
              <strong>{highCount}</strong>
            </button>
          </div>
        </div>
      </section>

      <section className="guideSection">
        <div className="guideCard">
          <h2>리스크 해석 가이드</h2>
          <div className="guideGrid">
            <div className="guideItem">
              <strong>낮음</strong>
              <span>즉시 경고 신호는 약하지만, 업황·공시·실적 변화는 계속 확인해야 합니다.</span>
            </div>
            <div className="guideItem">
              <strong>보통</strong>
              <span>당장 치명적이지는 않아도 다음 분기 실적 또는 이벤트에 따라 해석이 변할 수 있습니다.</span>
            </div>
            <div className="guideItem">
              <strong>주의</strong>
              <span>최근 신호가 뚜렷하므로 추격보다 원인 확인이 먼저 필요합니다.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="searchSection">
        <div className="searchCard">
          <div className="searchTop">
            <div>
              <h2>종목명 검색</h2>
              <p className="searchDesc">{resultCountText}</p>
            </div>
            {selectedLevel !== "all" ? (
              <button type="button" className="filterResetBtn" onClick={() => handleLevelFilter("all")}>
                필터 전체 해제
              </button>
            ) : null}
          </div>

          <div className="searchRow">
            <div className="searchInputWrap">
              <span className="searchIcon" aria-hidden="true">🔍</span>
              <input
                type="text"
                className="searchInput"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (!e.target.value.trim()) setHighlightedCode("");
                }}
                placeholder="종목명 또는 종목코드로 검색"
                aria-label="종목명 또는 종목코드 검색"
              />
            </div>
            {searchTerm ? (
              <button
                type="button"
                className="resetBtn"
                onClick={() => {
                  setSearchTerm("");
                  setHighlightedCode("");
                  didAutoFocus.current = false;
                }}
              >
                초기화
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {filteredRisks.length > 0 ? (
        <section className="listSection">
          <div className="riskList">
            {filteredRisks.map((item) => {
              const currentPrice = formatPrice(stockMap[item.code]?.metrics?.closePrice);
              const unifiedGrade = getUnifiedGrade(stockMap[item.code]);
              const isFocused = highlightedCode && String(highlightedCode) === String(item.code);

              return (
                <article
                  className={`riskCard ${isFocused ? "targetCard" : ""}`}
                  key={`${item.code}-${item.date}`}
                  id={`risk-${item.code}`}
                >
                  <div className="cardTop">
                    <div>
                      <p className="dateText">{item.date}</p>
                      <h3>{renderHighlightedName(item.name, searchTerm)}</h3>
                      <p className="codeText">종목코드 {item.code}</p>
                      <p className="priceText">최근 종가 {currentPrice}</p>
                      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <GradeBadge grade={unifiedGrade} size="sm" />
                        <WishlistButton code={item.code} name={item.name} size="sm" />
                      </div>
                    </div>
                    <span className={getRiskClass(item.level)}>{item.level}</span>
                  </div>

                  <div className="reasonCard goodCard">
                    <span className="reasonLabel">현재 체크 이유</span>
                    <p>{buildRiskReason(item, currentPrice)}</p>
                  </div>

                  <div className="reasonCard warnCard">
                    <span className="reasonLabel">지금 확인할 것</span>
                    <p>{buildCheckPointGuide(item)}</p>
                  </div>

                  <div className="riskBody">
                    <h4>{item.title}</h4>
                    <p className="summaryText">{item.summary}</p>
                    <div className="checkPointBox">
                      <span className="checkPointLabel">체크 포인트</span>
                      <p>{item.checkPoint}</p>
                    </div>
                  </div>

                  <div className="cardActions">
                    <Link href={`/stock/${item.code}`} className="detailBtn">종목 상세 보기</Link>
                    <Link href="/" className="ghostBtn">메인으로 가기</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="emptySection">
          <div className="emptyCard">
            <h2>검색 결과가 없습니다.</h2>
            <p>종목명 또는 종목코드 기준으로 검색됩니다. 다른 키워드를 입력해 보세요.</p>
            <button
              type="button"
              className="resetBtn large"
              onClick={() => {
                setSearchTerm("");
                setHighlightedCode("");
                didAutoFocus.current = false;
                handleLevelFilter("all");
              }}
            >
              검색 초기화
            </button>
          </div>
        </section>
      )}

      <style jsx>{`
        .pageHero { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
        .badge { display: inline-flex; padding: 8px 14px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 0.82rem; font-weight: 800; margin: 0 0 18px; }
        h1 { margin: 0 0 12px; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.04em; }
        .desc { margin: 0; max-width: 760px; color: #475569; line-height: 1.8; font-size: 1.02rem; }
        .heroMetaWrap { display: grid; gap: 12px; min-width: 260px; width: 320px; }
        .updateBox { padding: 16px 18px; border-radius: 18px; background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05); text-align: right; }
        .updateLabel { display: block; margin-bottom: 6px; color: #64748b; font-size: 0.88rem; font-weight: 700; }
        .updateBox strong { display: block; font-size: 1.15rem; color: #0f172a; }
        .riskCountRow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .miniStatCard { border: 1px solid #e5e7eb; border-radius: 18px; padding: 14px; background: #ffffff; text-align: left; cursor: pointer; transition: all .18s ease; }
        .miniStatCard:hover { transform: translateY(-1px); border-color: #cbd5e1; }
        .miniStatCard.active { box-shadow: 0 0 0 2px rgba(15,23,42,0.08); }
        .miniStatCard span { display: block; margin-bottom: 8px; font-size: 0.82rem; font-weight: 700; }
        .miniStatCard strong { font-size: 1.3rem; line-height: 1; letter-spacing: -0.03em; }
        .miniStatCard.low span, .miniStatCard.low strong { color: #15803d; }
        .miniStatCard.mid span, .miniStatCard.mid strong { color: #b45309; }
        .miniStatCard.high span, .miniStatCard.high strong { color: #dc2626; }
        .guideSection, .searchSection, .listSection, .emptySection { margin-top: 24px; }
        .guideCard, .searchCard, .riskCard, .emptyCard { border: 1px solid #e5e7eb; border-radius: 28px; padding: 24px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); box-shadow: 0 20px 50px rgba(15,23,42,0.06); }
        .guideCard h2, .searchCard h2, .emptyCard h2 { margin: 0 0 16px; font-size: 1.4rem; letter-spacing: -0.03em; }
        .guideGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .guideItem { border: 1px solid #e5e7eb; border-radius: 18px; padding: 16px; background: #fff; display: flex; flex-direction: column; gap: 8px; }
        .guideItem strong { color: #0f172a; }
        .guideItem span { color: #64748b; line-height: 1.7; font-size: .94rem; }
        .searchTop { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .searchDesc { margin: 0; color: #64748b; line-height: 1.7; }
        .searchRow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .searchInputWrap { position: relative; flex: 1 1 560px; min-width: 0; }
        .searchIcon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 1rem; pointer-events: none; }
        .searchInput { width: 100%; height: 52px; border-radius: 16px; border: 1px solid #dbe3f0; padding: 0 16px 0 44px; font-size: 1rem; color: #0f172a; background: #fff; box-sizing: border-box; outline: none; }
        .searchInput:focus { border-color: #4f46e5; box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12); }
        .filterResetBtn, .resetBtn, .detailBtn, .ghostBtn { display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; height: 52px; padding: 0 16px; font-weight: 800; text-decoration: none; border: 1px solid transparent; cursor: pointer; font-size: 0.95rem; }
        .filterResetBtn, .resetBtn { background: #fff; color: #0f172a; border-color: #dbe3f0; }
        .resetBtn.large { margin-top: 18px; }
        .detailBtn { background: #0f172a; color: #fff; }
        .ghostBtn { background: #fff; color: #0f172a; border-color: #dbe3f0; }
        .riskList { display: grid; gap: 16px; }
        .cardTop { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .dateText { margin: 0 0 12px; color: #64748b; font-size: 0.92rem; font-weight: 700; }
        .riskCard h3 { margin: 0 0 8px; font-size: 2rem; letter-spacing: -0.04em; word-break: keep-all; }
        .codeText { margin: 0 0 8px; color: #475569; font-weight: 700; }
        .priceText { margin: 0; color: #0ea5e9; font-weight: 900; font-size: 1.05rem; }
        .riskBadge { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 999px; font-size: 0.82rem; font-weight: 900; flex-shrink: 0; }
        .riskLow { background: #dcfce7; color: #15803d; }
        .riskMid { background: #fef3c7; color: #b45309; }
        .riskHigh { background: #fee2e2; color: #dc2626; }
        .reasonCard { border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; margin-bottom: 12px; }
        .goodCard { background: #f8fbff; }
        .warnCard { background: #fffdfa; }
        .reasonLabel { display: block; margin-bottom: 8px; color: #0f172a; font-size: .84rem; font-weight: 800; }
        .reasonCard p { margin: 0; color: #475569; line-height: 1.75; }
        .riskBody h4 { margin: 0 0 12px; font-size: 1.6rem; letter-spacing: -0.03em; }
        .summaryText { margin: 0 0 18px; color: #475569; line-height: 1.8; font-size: 1rem; }
        .checkPointBox { border: 1px solid #dbe3f0; border-radius: 18px; padding: 18px; background: #fff; }
        .checkPointLabel { display: block; margin-bottom: 8px; color: #0f172a; font-weight: 900; }
        .checkPointBox p { margin: 0; color: #475569; line-height: 1.75; }
        .cardActions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
        .nameMark { background: #fef3c7; color: #92400e; padding: 0 2px; border-radius: 4px; }
        .targetCard { border-color: #818cf8; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12), 0 20px 50px rgba(15,23,42,0.06); }
        @media (max-width: 900px) {
          .pageHero { flex-direction: column; }
          .guideGrid { grid-template-columns: 1fr; }
          .heroMetaWrap, .updateBox { width: 100%; }
          .updateBox { text-align: left; }
          .riskCountRow { grid-template-columns: 1fr; }
          .cardTop { flex-direction: column; }
        }
        @media (max-width: 640px) {
          .guideCard, .searchCard, .riskCard, .emptyCard { padding: 20px; }
          .searchRow { flex-direction: column; align-items: stretch; }
          .searchInputWrap { flex: none; width: 100%; }
          .searchInput { height: 48px; min-height: 48px; max-height: 48px; padding-left: 42px; line-height: 48px; }
          .filterResetBtn, .resetBtn, .detailBtn, .ghostBtn { width: 100%; height: 48px; }
          .riskCard h3 { font-size: 1.8rem; }
          .riskBody h4 { font-size: 1.35rem; }
        }
      `}</style>
    </>
  );
}

function RiskCheckTabFallback() {
  return <p style={{ color: "#64748b", fontWeight: 700 }}>리스크 체크 화면을 불러오는 중...</p>;
}

export default function RiskCheckTab({ stocks, risks }) {
  return (
    <Suspense fallback={<RiskCheckTabFallback />}>
      <RiskCheckTabContent stocks={stocks} risks={risks} />
    </Suspense>
  );
}
