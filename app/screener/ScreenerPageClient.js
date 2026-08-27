"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PageTopBar from "../components/PageTopBar";
import RankingTab from "../components/search/RankingTab";
import RiskCheckTab from "../components/search/RiskCheckTab";
import FinalPicksTab from "../components/search/FinalPicksTab";
import AlternativeTab from "../components/search/AlternativeTab";

const TABS = [
  { key: "ranking", label: "랭킹", desc: "전체 종목을 점수로 정렬해서 봅니다." },
  { key: "final", label: "실전투자", desc: "통합 등급(S~D) 기준으로 최종 후보를 압축해서 봅니다." },
  { key: "risk", label: "리스크 체크", desc: "종목별 위험 신호와 체크 포인트를 확인합니다." },
  { key: "alternative", label: "대안투자", desc: "개별주 외에 ETF/배당 같은 대안 접근을 살펴봅니다." },
];

// TASK 5(디자인·IA 개편): tab/view/risk 초기값은 서버 컴포넌트(page.js)가
// searchParams를 읽어 props로 내려준다. 여기서 useSearchParams()를 쓰지
// 않아야(그 훅을 쓰는 순간 이 트리 전체가 다시 Suspense fallback으로
// 빠진다) 서버가 첫 응답에 진짜 랭킹 목록을 담아 보낼 수 있다. 탭 전환
// 등 이후 URL 갱신은 useRouter/usePathname만으로 충분하다 - 둘 다
// useSearchParams와 달리 Suspense가 필요 없다.
export default function ScreenerPageClient({ stocks, risks, initialTab, initialView, initialRisk }) {
  const router = useRouter();
  const pathname = usePathname();

  const resolvedInitialTab = TABS.some((t) => t.key === initialTab) ? initialTab : "ranking";
  const [activeTab, setActiveTab] = useState(resolvedInitialTab);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    const params = new URLSearchParams();
    params.set("tab", nextTab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const activeMeta = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <main className="container" style={{ background: "var(--bg-screen)" }}>
      <PageTopBar />

      <section className="pageHero">
        <div>
          <p className="badge">SEARCH</p>
          <h1>종목 검색</h1>
          <p className="desc">{activeMeta.desc}</p>
        </div>
      </section>

      <section className="tabSwitchSection">
        <div className="tabSwitchRow">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tabBtn ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "ranking" && (
        <RankingTab stocks={stocks} initialView={initialView} initialRisk={initialRisk} />
      )}
      {activeTab === "final" && <FinalPicksTab stocks={stocks} risks={risks} />}
      {activeTab === "risk" && <RiskCheckTab stocks={stocks} risks={risks} />}
      {activeTab === "alternative" && <AlternativeTab />}

      <style jsx>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px 80px;
          color: #0f172a;
        }
        .pageHero {
          margin-bottom: 18px;
        }
        .badge {
          display: inline-flex;
          padding: 8px 14px;
          border-radius: var(--radius-pill);
          background: var(--color-surface-tint);
          color: var(--color-primary);
          font-size: 0.82rem;
          font-weight: 800;
          margin: 0 0 14px;
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
        .tabSwitchSection {
          margin-bottom: 24px;
        }
        .tabSwitchRow {
          display: inline-flex;
          gap: 8px;
          padding: 6px;
          border-radius: 999px;
          background: #f1f5f9;
        }
        .tabBtn {
          border: none;
          background: transparent;
          padding: 12px 22px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 0.95rem;
          color: #64748b;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .tabBtn.active {
          background: var(--color-primary);
          color: #fff;
        }
        @media (max-width: 640px) {
          .tabSwitchRow {
            width: 100%;
            overflow-x: auto;
          }
          .tabBtn {
            flex-shrink: 0;
          }
        }
      `}</style>
    </main>
  );
}
