"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PageTopBar from "../components/PageTopBar";
import RankingTab from "../components/search/RankingTab";
import RiskCheckTab from "../components/search/RiskCheckTab";
import FinalPicksTab from "../components/search/FinalPicksTab";

const TABS = [
  { key: "ranking", label: "랭킹", desc: "전체 종목을 점수로 정렬해서 봅니다." },
  { key: "final", label: "실전투자", desc: "통합 등급(S~D) 기준으로 최종 후보를 압축해서 봅니다." },
  { key: "risk", label: "리스크 체크", desc: "종목별 위험 신호와 체크 포인트를 확인합니다." },
];

function SearchPageContent({ stocks, risks }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requestedTab = (searchParams.get("tab") || "").trim();
  const initialTab = TABS.some((t) => t.key === requestedTab) ? requestedTab : "ranking";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    // 탭을 바꿀 때는 이전 탭의 서브 파라미터(view/risk/level/code 등)를 정리한다.
    ["view", "risk", "level", "code", "name"].forEach((key) => params.delete(key));
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

      {activeTab === "ranking" && <RankingTab stocks={stocks} />}
      {activeTab === "final" && <FinalPicksTab stocks={stocks} risks={risks} />}
      {activeTab === "risk" && <RiskCheckTab stocks={stocks} risks={risks} />}

      <style jsx>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 18px 24px 80px;
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

function SearchPageFallback() {
  return (
    <main className="container" style={{ padding: "32px 24px 80px", color: "#0f172a", background: "var(--bg-screen)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ color: "#64748b", fontWeight: 700 }}>검색 화면을 불러오는 중...</p>
      </div>
    </main>
  );
}

export default function SearchPageClient({ stocks, risks }) {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageContent stocks={stocks} risks={risks} />
    </Suspense>
  );
}
