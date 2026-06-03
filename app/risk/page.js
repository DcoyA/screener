"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import risks from "../data/risks.json";
import stocks from "../data/stocks.json";

function getRiskClass(level) {
  if (level === "주의") return "riskBadge riskHigh";
  if (level === "보통") return "riskBadge riskMid";
  return "riskBadge riskLow";
}

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

function formatPrice(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

export default function RiskPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const updatedAt = risks[0]?.date || "-";
  const normalizedSearchTerm = normalizeKeyword(searchTerm);
  const stockPriceMap = useMemo(() => {
    return Object.fromEntries(
      stocks.map((item) => [item.code, item.metrics?.closePrice || 0])
    );
  }, []);
  const filteredRisks = useMemo(() => {
    if (!normalizedSearchTerm) return risks;

    return risks.filter((item) =>
      normalizeKeyword(item.name).includes(normalizedSearchTerm)
    );
  }, [normalizedSearchTerm]);

  const resultCountText = normalizedSearchTerm
    ? `검색 결과 ${filteredRisks.length}개 / 전체 ${risks.length}개`
    : `상위 ${risks.length}개 종목에 대해서만 제공합니다.`;

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">
            홈으로 가기
          </Link>
          <div className="subNav">
            <Link href="/notice">공지</Link>
            <Link href="/ranking">랭킹</Link>
            <Link href="/reports">리포트</Link>
          </div>
        </div>

        <section className="pageHero">
          <div>
            <p className="badge">RISK CENTER</p>
            <h1>리스크 페이지</h1>
            <p className="desc">
              종목별로 최근 확인해야 할 위험 신호와 체크 포인트를 정리한
              페이지입니다. 리스크 수준과 함께 다음 확인 항목을 빠르게 볼 수
              있도록 구성했습니다.
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

        <div className="riskList">
          {filteredRisks.length > 0 ? (
            filteredRisks.map((item) => (
              <div className="riskCard" key={item.code}>
                <div className="riskTop">
                  <div>
                    <p className="stockCode">{item.date}</p>
                    <h2>{renderHighlightedName(item.name, searchTerm)}</h2>
                    <p className="stockCode">종목코드 {item.code}</p>
                    <p className="priceLine">
                      최근 종가 {formatPrice(stockPriceMap[item.code])}
                    </p>
                  </div>

                  <span className={getRiskClass(item.level)}>{item.level}</span>
                </div>

                <h3 className="riskTitle">{item.title}</h3>
                <p className="summaryText">{item.summary}</p>

                <div className="checkBox">
                  <strong>체크 포인트</strong>
                  <p>{item.checkPoint}</p>
                </div>

                <div className="actionsRow">
                  <Link className="linkBtn" href={`/stock/${item.code}`}>
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
        
        .stockCode,
        .priceLine {
          color: #64748b;
        }
        
        .priceLine {
          margin-top: 6px;
          font-weight: 800;
          color: #0f172a;
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
        .riskList {
          display: grid;
          gap: 18px;
        }
        .riskCard {
          border-radius: 24px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }
        .riskTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        h2 {
          margin: 8px 0 10px;
          font-size: 1.8rem;
          letter-spacing: -0.03em;
          word-break: keep-all;
        }
        .nameHighlight {
          background: #fef08a;
          color: inherit;
          padding: 0 2px;
          border-radius: 4px;
        }
        .riskTitle {
          margin: 18px 0 10px;
          font-size: 1.2rem;
        }
        .summaryText,
        .checkBox p {
          color: #475569;
          line-height: 1.8;
          margin: 0;
        }
        .checkBox {
          margin-top: 16px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .checkBox strong {
          display: block;
          margin-bottom: 8px;
        }
        .riskBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 72px;
          padding: 10px 14px;
          border-radius: 999px;
          font-weight: 800;
        }
        .riskHigh {
          background: #fee2e2;
          color: #b91c1c;
        }
        .riskMid {
          background: #fef3c7;
          color: #b45309;
        }
        .riskLow {
          background: #dcfce7;
          color: #15803d;
        }
        .actionsRow {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
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
          .riskTop {
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
        }
      `}</style>
    </>
  );
}
