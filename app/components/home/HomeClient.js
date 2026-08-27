"use client";

import { useMemo } from "react";
import SiteHeader from "../SiteHeader";
import MembershipHeroSection from "./MembershipHeroSection";
import HomeBoardSection from "./HomeBoardSection";
import HeroSection from "./HeroSection";
import StrategySection from "./StrategySection";
import PerformanceSummaryCard from "./PerformanceSummaryCard";
import { buildStrategyCards } from "../../lib/homeData";

// 기획서 홈: 5개 섹션.
// ① 멤버십 히어로(WAITLIST 폼 흡수)  ② 데일리 Top10 + 내 관심종목 2열 보드
// ③ 종목검색 바(HeroSection 재사용)  ④ 오늘의 투자전략(StrategySection 재사용)
// ⑤ 우리 성적표 요약(PerformanceSummaryCard)
// 하단 물결은 <main> 밖 장식이라 섹션 수에 안 들어간다(SVG 1개, 루비 톤).
// stocks = stocks.json(빌드 스냅샷) 하나만. /performance·/screener와 숫자 일치.
export default function HomeClient({ stocks, performanceSummary }) {
  const strategyCards = useMemo(() => buildStrategyCards(stocks), [stocks]);
  const updatedAt = stocks[0]?.updatedAt || "-";

  return (
    <>
      <SiteHeader />

      <main className="container" style={{ background: "var(--bg-home)" }}>
        <MembershipHeroSection />

        <HomeBoardSection stocks={stocks} />

        <HeroSection updatedAt={updatedAt} stocks={stocks} />

        <StrategySection strategyCards={strategyCards} />

        <PerformanceSummaryCard performanceSummary={performanceSummary} />
      </main>

      <div className="homeWave" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0 40 C 180 0, 360 80, 540 40 S 900 0, 1080 40 S 1440 80, 1440 40 L 1440 80 L 0 80 Z"
            fill="var(--ruby-100)"
          />
          <path
            d="M0 52 C 180 20, 360 84, 540 52 S 900 20, 1080 52 S 1440 84, 1440 52 L 1440 80 L 0 80 Z"
            fill="var(--ruby-300)"
            opacity="0.5"
          />
        </svg>
      </div>

      <footer className="footer">
        <div className="footerInner">
          <p>HELLO MEDIA · All rights reserved.</p>
          <div className="footerLinks">
            <a href="/notice">이용가이드</a>
            <a href="mailto:iamborghini5757@gmail.com">iamborghini5757@gmail.com</a>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 8px 24px 40px;
          color: var(--ink-900);
        }
        .homeWave {
          max-width: 1180px;
          margin: 0 auto;
          line-height: 0;
        }
        .homeWave svg {
          display: block;
          width: 100%;
          height: 64px;
        }

        /* ── 종목검색 바 (HeroSection.js) ───────────────────────── */
        .searchBarForm {
          margin-top: 0;
          max-width: 640px;
        }
        .searchBarWrap {
          position: relative;
        }
        .searchBarInput {
          width: 100%;
          height: 56px;
          border-radius: 16px;
          border: 1px solid var(--ink-300);
          padding: 0 110px 0 20px;
          font-size: 1.02rem;
          outline: none;
          box-sizing: border-box;
          background: #ffffff;
          box-shadow: var(--shadow-card);
        }
        .searchBarInput:focus {
          border-color: var(--ruby-600);
          box-shadow: 0 0 0 4px rgba(122, 12, 31, 0.12);
        }
        .searchBarBtn {
          position: absolute;
          right: 8px;
          top: 8px;
          height: 40px;
          padding: 0 20px;
          border-radius: 12px;
          border: none;
          background: var(--ruby-700);
          color: #ffffff;
          font-weight: 800;
          cursor: pointer;
          transition: filter 0.18s ease;
        }
        .searchBarBtn:hover {
          filter: brightness(1.08);
        }
        .searchDropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: #ffffff;
          border: 1px solid var(--ink-300);
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
          overflow: hidden;
          z-index: 20;
        }
        .searchResultList {
          list-style: none;
          margin: 0;
          padding: 6px;
          max-height: 320px;
          overflow-y: auto;
        }
        .searchResultItem {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          font-size: 0.95rem;
          transition: background 0.15s ease;
        }
        .searchResultItem:hover {
          background: var(--ruby-50);
        }
        .searchResultName {
          font-weight: 800;
          color: var(--ink-900);
        }
        .searchResultCode {
          color: var(--ink-600);
          font-size: 0.85rem;
        }
        .searchResultMarket {
          margin-left: auto;
          display: inline-flex;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--ruby-100);
          color: var(--ruby-700);
          font-size: 0.75rem;
          font-weight: 800;
        }
        .searchNoResult {
          margin: 0;
          padding: 18px;
          color: var(--ink-600);
          font-size: 0.92rem;
          text-align: center;
        }
        @media (max-width: 640px) {
          .searchBarInput {
            padding-right: 90px;
            height: 52px;
          }
          .searchBarBtn {
            height: 36px;
            padding: 0 14px;
            font-size: 0.9rem;
          }
        }

        /* ── 오늘의 투자전략 (StrategySection.js) ────────────────── */
        .strategySection {
          margin-top: 36px;
        }
        .sectionHeaderRow {
          margin: 0 0 18px;
        }
        .sectionTitle {
          margin: 0 0 8px;
          font-size: var(--font-hero);
          font-weight: var(--font-hero-weight);
          letter-spacing: -0.03em;
          color: var(--ink-900);
        }
        .sectionDesc {
          margin: 0;
          color: var(--ink-600);
          line-height: 1.7;
        }
        .strategyGrid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .strategyCard {
          border-radius: var(--radius-card);
          border: 1px solid var(--ink-300);
          background: #ffffff;
          box-shadow: var(--shadow-card);
          padding: 22px;
        }
        .strategyBadge {
          display: inline-flex;
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          background: var(--ruby-100);
          color: var(--ruby-700);
          font-size: 0.78rem;
          font-weight: 800;
        }
        .strategyCard h3 {
          margin: 12px 0 10px;
          font-size: 1.25rem;
          letter-spacing: -0.03em;
          color: var(--ink-900);
        }
        .gradeBadge {
          display: inline-flex;
          padding: 6px 12px;
          border-radius: var(--radius-chip);
          font-size: 0.8rem;
          font-weight: 800;
          margin-bottom: 12px;
        }
        .conclusionLine {
          margin: 0 0 8px;
          color: #334155;
          line-height: 1.7;
        }
        .compareLine {
          margin: 0 0 16px;
          color: var(--ink-600);
          font-size: 0.84rem;
          font-weight: 700;
        }
        .linkBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-pill);
          padding: 12px 20px;
          font-weight: 800;
          text-decoration: none;
          font-size: 0.94rem;
          background: #ffffff;
          color: var(--ruby-700);
          border: 1px solid var(--ruby-700);
          transition: background 0.18s ease;
        }
        .linkBtn:hover {
          background: var(--ruby-50);
        }
        .emptyStateBox {
          margin-top: 8px;
          border: 1px dashed var(--ink-300);
          border-radius: 16px;
          padding: 18px;
          background: #ffffff;
        }
        .emptyStateBox p {
          margin: 0;
          color: var(--ink-600);
          line-height: 1.8;
        }
        @media (max-width: 900px) {
          .strategyGrid {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            gap: 14px;
            padding-bottom: 4px;
          }
          .strategyGrid .strategyCard {
            flex: 0 0 82%;
            scroll-snap-align: start;
          }
        }

        .footer {
          border-top: 1px solid #e5e7eb;
          background: #ffffff;
        }
        .footerInner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          color: var(--ink-600);
        }
        .footerInner p {
          margin: 0;
        }
        .footerLinks {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
        }
        .footerInner a {
          color: var(--ink-900);
          text-decoration: none;
          font-weight: 700;
        }
        @media (max-width: 640px) {
          .container {
            padding: 4px 18px 32px;
          }
        }
      `}</style>
    </>
  );
}
