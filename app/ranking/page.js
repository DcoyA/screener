"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import stocks from "../data/stocks.json";

function normalizeKeyword(value = "") {
  return value.toLowerCase().replace(/\s+/g, "").trim();
}

function renderHighlightedName(name, query) {
  if (!query) return name;

  const directIndex = name.toLowerCase().indexOf(query.toLowerCase());
  if (directIndex === -1) return name;

  const before = name.slice(0, directIndex);
  const match = name.slice(directIndex, directIndex + query.length);
  const after = name.slice(directIndex + query.length);

  return (
    <>
      {before}
      <mark className="nameHighlight">{match}</mark>
      {after}
    </>
  );
}

function getRankBadgeClass(rank) {
  if (rank === 1) return "rankBadge rank1";
  if (rank === 2) return "rankBadge rank2";
  if (rank === 3) return "rankBadge rank3";
  return "rankBadge rankDefault";
}

function formatPrice(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

export default function RankingPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const rankedStocks = useMemo(
    () =>
      [...stocks]
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((stock, index) => ({
          ...stock,
          originalRank: index + 1,
        })),
    []
  );

  const updatedAt = rankedStocks[0]?.updatedAt || "-";
  const normalizedSearchTerm = normalizeKeyword(searchTerm);

  const filteredStocks = useMemo(() => {
    if (!normalizedSearchTerm) return rankedStocks;

    return rankedStocks.filter((stock) =>
      normalizeKeyword(stock.name).includes(normalizedSearchTerm)
    );
  }, [rankedStocks, normalizedSearchTerm]);

  const resultCountText = normalizedSearchTerm
    ? `검색 결과 ${filteredStocks.length}개 / 전체 ${rankedStocks.length}개`
    : `상위 ${rankedStocks.length}개 종목에 대해서만 제공합니다`;

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">
            홈으로 가기
          </Link>
          <div className="subNav">
            <Link href="/notice">공지</Link>
            <Link href="/risk">리스크</Link>
            <Link href="/reports">리포트</Link>
          </div>
        </div>

        <section className="pageHero">
          <div>
            <p className="badge">RANKING</p>
            <h1>종목 랭킹</h1>
            <p className="desc">
              OpenDART 공시와 KRX 시장 데이터를 바탕으로 AI 점수를 계산해 상위
              종목을 정렬한 페이지입니다. <br /> 가치·품질·안전성·시장성·변화 점수를
              함께 반영합니다.
            </p>
          </div>
          <div className="updateBox">
            <span className="updateLabel">업데이트</span>
            <strong>{updatedAt}</strong>
          </div>
        </section>

        <div className="floatingSearchWrap">
          <div className="floatingSearchCard">
            <div className="searchHeader">
              <div>
                <p className="searchLabel">종목명 검색</p>
                <p className="searchMeta">{resultCountText}</p>
              </div>
            </div>

            <div className="searchInputRow">
              <div className="searchInputBox">
                <span className="searchIcon" aria-hidden="true">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="종목명으로 검색"
                  aria-label="종목명 검색"
                />
              </div>

              {searchTerm ? (
                <button
                  type="button"
                  className="clearBtn"
                  onClick={() => setSearchTerm("")}
                >
                  초기화
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="listWrap">
          {filteredStocks.length > 0 ? (
            filteredStocks.map((stock) => (
              <div className="listCard" key={stock.code}>
                <div className="listTop">
                  <div className="rankHeader">
                    <div className={getRankBadgeClass(stock.originalRank)}>
                      <span className="rankHash">#</span>
                      <span className="rankNumber">{stock.originalRank}</span>
                    </div>

                    <div className="titleBlock">
                      <h2>{renderHighlightedName(stock.name, searchTerm)}</h2>
                      <p className="stockCode">
                        {stock.market} · {stock.code} · 최근 종가 {formatPrice(stock.metrics?.closePrice)}
                      </p>
                    </div>
                  </div>

                  <div className="scoreBadge">{stock.totalScore}점</div>
                </div>

                <p className="summaryText">{stock.summary}</p>

                <div className="actionsRow">
                  <Link className="linkBtn" href={`/stock/${stock.code}`}>
                    종목 상세 보기
                  </Link>
                  <Link className="ghostBtn" href="/">
                    메인으로 가기
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="emptyState">
              <p className="emptyTitle">검색 결과가 없습니다.</p>
              <p className="emptyDesc">
                종목명 기준으로만 검색됩니다. 다른 종목명을 입력해 보세요.
              </p>
              <button
                type="button"
                className="ghostBtn"
                onClick={() => setSearchTerm("")}
              >
                검색 초기화
              </button>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          color: #0f172a;
        }
        .topLinks {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 26px;
          flex-wrap: wrap;
        }
        .subNav {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .subNav a {
          color: #475569;
          text-decoration: none;
          font-weight: 700;
        }
        .pageHero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .badge {
          display: inline-flex;
          padding: 8px 14px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.82rem;
          font-weight: 800;
          margin: 0 0 18px;
        }
        h1 {
          margin: 0 0 12px;
          font-size: clamp(2rem, 4vw, 3rem);
          letter-spacing: -0.04em;
        }
        .desc {
          margin: 0;
          max-width: 760px;
          color: #475569;
          line-height: 1.8;
          font-size: 1.02rem;
        }
        .updateBox {
          min-width: 180px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
          text-align: right;
        }
        
        .updateLabel,
        .muted,
        .stockCode {
          color: #64748b;
        }
        
        .stockCode {
          line-height: 1.7;
        }

        .updateLabel {
          display: block;
          margin-bottom: 6px;
          font-size: 0.88rem;
          font-weight: 700;
        }
        .floatingSearchWrap {
          position: sticky;
          top: 16px;
          z-index: 30;
          margin-bottom: 18px;
        }
        .floatingSearchCard {
          border: 1px solid rgba(219, 227, 240, 0.95);
          border-radius: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(12px);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
        }
        .searchHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .searchLabel {
          margin: 0;
          font-size: 0.92rem;
          font-weight: 800;
          color: #0f172a;
        }
        .searchMeta {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.88rem;
        }
        .searchInputRow {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .searchInputBox {
          flex: 1 1 320px;
          display: flex;
          align-items: center;
          gap: 10px;
          height: 54px;
          border-radius: 16px;
          border: 1px solid #dbe3f0;
          background: #ffffff;
          padding: 0 14px;
        }
        .searchInputBox:focus-within {
          border-color: #4f46e5;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
        }
        .searchIcon {
          font-size: 1rem;
          line-height: 1;
        }
        .searchInputBox input {
          flex: 1;
          height: 100%;
          border: none;
          outline: none;
          background: transparent;
          color: #0f172a;
          font-size: 1rem;
        }
        .clearBtn {
          height: 54px;
          padding: 0 16px;
          border-radius: 16px;
          border: 1px solid #dbe3f0;
          background: #ffffff;
          color: #0f172a;
          font-weight: 800;
          cursor: pointer;
        }
        .listWrap {
          display: grid;
          gap: 18px;
        }
        .listCard {
          border-radius: 24px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }
        .listTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 10px;
        }
        .rankHeader {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          min-width: 0;
        }
        .titleBlock {
          min-width: 0;
        }
        .rankBadge {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 82px;
          height: 82px;
          border-radius: 24px;
          padding: 0 16px;
          font-weight: 900;
          letter-spacing: -0.04em;
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
          border: 1px solid transparent;
          flex-shrink: 0;
        }
        .rankHash {
          font-size: 1.1rem;
          line-height: 1;
          margin-right: 2px;
          opacity: 0.92;
        }
        .rankNumber {
          font-size: 2rem;
          line-height: 1;
        }
        .rank1 {
          background: linear-gradient(135deg, #facc15 0%, #f59e0b 100%);
          color: #111827;
          border-color: rgba(245, 158, 11, 0.35);
        }
        .rank2 {
          background: linear-gradient(135deg, #e5e7eb 0%, #94a3b8 100%);
          color: #0f172a;
          border-color: rgba(148, 163, 184, 0.38);
        }
        .rank3 {
          background: linear-gradient(135deg, #fdba74 0%, #ea580c 100%);
          color: #fff;
          border-color: rgba(234, 88, 12, 0.3);
        }
        .rankDefault {
          background: #f8fafc;
          color: #334155;
          border-color: #e2e8f0;
          box-shadow: none;
        }
        h2 {
          margin: 4px 0 10px;
          font-size: 1.9rem;
          letter-spacing: -0.03em;
          word-break: keep-all;
        }
        .nameHighlight {
          background: #fef08a;
          color: inherit;
          padding: 0 2px;
          border-radius: 4px;
        }
        .summaryText {
          margin: 14px 0 20px;
          color: #475569;
          line-height: 1.8;
        }
        .scoreBadge {
          background: #0f172a;
          color: #fff;
          border-radius: 14px;
          padding: 12px 16px;
          font-weight: 800;
          min-width: 64px;
          text-align: center;
          flex-shrink: 0;
        }
        .actionsRow {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .emptyState {
          border-radius: 24px;
          padding: 36px 24px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          border: 1px solid #e5e7eb;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
          text-align: center;
        }
        .emptyTitle {
          margin: 0 0 8px;
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
        }
        .emptyDesc {
          margin: 0 0 18px;
          color: #64748b;
          line-height: 1.7;
        }
        .homeBtn,
        .linkBtn,
        .ghostBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 12px 16px;
          text-decoration: none;
          font-weight: 800;
          border: 1px solid #dbe3f0;
          background: #fff;
          color: #0f172a;
          cursor: pointer;
        }
        .homeBtn {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }
        @media (max-width: 720px) {
          .container {
            padding: 24px 18px 64px;
          }
          .pageHero,
          .listTop,
          .rankHeader {
            flex-direction: column;
          }
          .updateBox {
            width: 100%;
            text-align: left;
          }
          .floatingSearchWrap {
            top: 12px;
          }
          .searchInputRow {
            flex-direction: column;
            align-items: stretch;
          }
          .clearBtn,
          .homeBtn,
          .linkBtn,
          .ghostBtn {
            width: 100%;
          }
          .rankBadge {
            width: 86px;
          }
        }
      `}</style>
    </>
  );
}
