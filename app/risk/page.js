"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import risks from "../data/risks.json";
import stocks from "../data/stocks.json";
import MainNav from "../components/MainNav";

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

  const lowerName = name.toLowerCase();
  const lowerQuery = query.toLowerCase();
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
          <MainNav />
        </div>

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

          <div className="updateBox" aria-label="업데이트 날짜">
            <span className="updateLabel">업데이트</span>
            <strong>{updatedAt}</strong>
          </div>
        </section>

        <section className="searchSection">
          <div className="searchCard">
            <div className="searchHeader">
              <div>
                <h2>종목명 검색</h2>
                <p>{resultCountText}</p>
              </div>
            </div>

            <div className="searchRow">
              <div className="searchInputWrap">
                <span className="searchIcon" aria-hidden="true">
                  🔍
                </span>
                <input
                  type="text"
                  className="searchInput"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="종목명으로 검색"
                  aria-label="종목명 검색"
                />
              </div>

              {searchTerm ? (
                <button
                  type="button"
                  className="resetBtn"
                  onClick={() => setSearchTerm("")}
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
              {filteredRisks.map((item) => (
                <article className="riskCard" key={`${item.code}-${item.date}`}>
                  <div className="cardTop">
                    <div>
                      <p className="dateText">{item.date}</p>
                      <h3>{renderHighlightedName(item.name, searchTerm)}</h3>
                      <p className="codeText">종목코드 {item.code}</p>
                      <p className="priceText">
                        최근 종가 {formatPrice(stockPriceMap[item.code])}
                      </p>
                    </div>

                    <span className={getRiskClass(item.level)}>{item.level}</span>
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
                    <Link href={`/stock/${item.code}`} className="detailBtn">
                      종목 상세 보기
                    </Link>
                    <Link href="/" className="ghostBtn">
                      메인으로 가기
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="emptySection">
            <div className="emptyCard">
              <h2>검색 결과가 없습니다.</h2>
              <p>종목명 기준으로만 검색됩니다. 다른 종목명을 입력해 보세요.</p>
              <button
                type="button"
                className="resetBtn large"
                onClick={() => setSearchTerm("")}
              >
                검색 초기화
              </button>
            </div>
          </section>
        )}
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

        .homeBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 12px 16px;
          text-decoration: none;
          font-weight: 800;
          border: 1px solid #0f172a;
          background: #0f172a;
          color: #fff;
        }

        .pageHero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 24px;
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

        .updateLabel {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 0.88rem;
          font-weight: 700;
        }

        .updateBox strong {
          display: block;
          font-size: 1.15rem;
          color: #0f172a;
        }

        .searchSection,
        .listSection,
        .emptySection {
          margin-top: 24px;
        }

        .searchCard,
        .riskCard,
        .emptyCard {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 24px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }

        .searchHeader h2,
        .emptyCard h2 {
          margin: 0 0 10px;
          font-size: 1.4rem;
          letter-spacing: -0.03em;
        }

        .searchHeader p,
        .emptyCard p {
          margin: 0;
          color: #64748b;
          line-height: 1.7;
        }

        .searchRow {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 18px;
          flex-wrap: wrap;
        }

        .searchInputWrap {
          position: relative;
          flex: 1 1 560px;
          min-width: 0;
        }

        .searchIcon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1rem;
          pointer-events: none;
        }

        .searchInput {
          width: 100%;
          height: 52px;
          border-radius: 16px;
          border: 1px solid #dbe3f0;
          padding: 0 16px 0 44px;
          font-size: 1rem;
          color: #0f172a;
          background: #fff;
          box-sizing: border-box;
          outline: none;
        }

        .searchInput:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
        }

        .resetBtn,
        .detailBtn,
        .ghostBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          height: 52px;
          padding: 0 16px;
          font-weight: 800;
          text-decoration: none;
          border: 1px solid transparent;
          cursor: pointer;
          font-size: 0.95rem;
        }

        .resetBtn {
          background: #fff;
          color: #0f172a;
          border-color: #dbe3f0;
        }

        .resetBtn.large {
          margin-top: 18px;
        }

        .detailBtn {
          background: #0f172a;
          color: #fff;
        }

        .ghostBtn {
          background: #fff;
          color: #0f172a;
          border-color: #dbe3f0;
        }

        .riskList {
          display: grid;
          gap: 16px;
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .dateText {
          margin: 0 0 12px;
          color: #64748b;
          font-size: 0.92rem;
          font-weight: 700;
        }

        .riskCard h3 {
          margin: 0 0 8px;
          font-size: 2rem;
          letter-spacing: -0.04em;
          word-break: keep-all;
        }

        .codeText {
          margin: 0 0 8px;
          color: #475569;
          font-weight: 700;
        }

        .priceText {
          margin: 0;
          color: #0ea5e9;
          font-weight: 900;
          font-size: 1.05rem;
        }

        .riskBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border-radius: 999px;
          font-size: 0.82rem;
          font-weight: 900;
          flex-shrink: 0;
        }

        .riskLow {
          background: #dcfce7;
          color: #15803d;
        }

        .riskMid {
          background: #fef3c7;
          color: #b45309;
        }

        .riskHigh {
          background: #fee2e2;
          color: #dc2626;
        }

        .riskBody h4 {
          margin: 0 0 12px;
          font-size: 1.6rem;
          letter-spacing: -0.03em;
        }

        .summaryText {
          margin: 0 0 18px;
          color: #475569;
          line-height: 1.8;
          font-size: 1rem;
        }

        .checkPointBox {
          border: 1px solid #dbe3f0;
          border-radius: 18px;
          padding: 18px;
          background: #fff;
        }

        .checkPointLabel {
          display: block;
          margin-bottom: 8px;
          color: #0f172a;
          font-weight: 900;
        }

        .checkPointBox p {
          margin: 0;
          color: #475569;
          line-height: 1.75;
        }

        .cardActions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .nameMark {
          background: #fef3c7;
          color: #92400e;
          padding: 0 2px;
          border-radius: 4px;
        }

        @media (max-width: 900px) {
          .pageHero,
          .cardTop {
            flex-direction: column;
          }

          .updateBox {
            width: 100%;
            text-align: left;
          }
        }

        @media (max-width: 640px) {
          .container {
            padding: 24px 18px 64px;
          }

          .searchCard,
          .riskCard,
          .emptyCard {
            padding: 20px;
          }

          .searchRow {
            flex-direction: column;
            align-items: stretch;
          }

          .searchInputWrap {
            flex: none;
            width: 100%;
          }

          .searchInput {
            height: 48px;
            min-height: 48px;
            max-height: 48px;
            padding-left: 42px;
            line-height: 48px;
          }

          .resetBtn,
          .detailBtn,
          .ghostBtn {
            width: 100%;
            height: 48px;
          }

          .riskCard h3 {
            font-size: 1.8rem;
          }

          .riskBody h4 {
            font-size: 1.35rem;
          }
        }
      `}</style>
    </>
  );
}
