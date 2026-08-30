"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PageTopBar from "../components/PageTopBar";
import WishlistButton from "../components/WishlistButton";
import { getWishlist } from "../lib/wishlist";
import { formatUpsideDisplay, formatUpsidePercent } from "../lib/formatUpside";
import { isFairValueOk } from "../lib/fairValue";
import { cleanStockName } from "../lib/stockName";

// STEP 8: stocks.json(2.4MB)·risks.json 을 클라이언트에서 직접 import 하던 걸
// 서버 컴포넌트(page.js)가 읽어 slim 배열로 내려주도록 바꿨다. slim 항목은
// 관심종목 패널이 실제로 쓰는 필드만 담고, name 은 이미 정제돼 있으며
// riskLevel(risks.json level 우선, 없으면 riskMeta.level)이 병합돼 있다.

const TABS = [
  { key: "wishlist", label: "관심종목" },
  { key: "subscription", label: "구독관리" },
  { key: "notifications", label: "알림설정" },
];

function formatPrice(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

function WishlistPanel({ stocks }) {
  const [wishlistEntries, setWishlistEntries] = useState([]);
  const [mounted, setMounted] = useState(false);
  const stockMap = useMemo(() => new Map(stocks.map((item) => [String(item.code), item])), [stocks]);

  useEffect(() => {
    setMounted(true);
    getWishlist().then((list) => setWishlistEntries(list));
  }, []);

  const wishlistStocks = useMemo(() => {
    return wishlistEntries.map((entry) => stockMap.get(String(entry.code))).filter(Boolean);
  }, [wishlistEntries, stockMap]);

  const insight = useMemo(() => {
    if (!wishlistStocks.length) return null;

    // 적정가 산출이 ok인 종목만 평균에 넣는다(결측/이상치는 upside가 없음).
    const upsideStocks = wishlistStocks.filter(
      (item) => isFairValueOk(item) && Number.isFinite(Number(item?.metrics?.upside))
    );
    const avgUpside = upsideStocks.length
      ? upsideStocks.reduce((sum, item) => sum + Number(item.metrics.upside), 0) / upsideStocks.length
      : null;

    const riskyCount = wishlistStocks.filter((item) => item.riskLevel === "주의").length;

    const sectorCount = new Map();
    wishlistStocks.forEach((item) => {
      const sector = item.sector || "미분류";
      sectorCount.set(sector, (sectorCount.get(sector) || 0) + 1);
    });
    const topSector = [...sectorCount.entries()].sort((a, b) => b[1] - a[1])[0];

    return { avgUpside, riskyCount, topSector };
  }, [wishlistStocks]);

  if (!mounted) return null;

  return (
    <>
      {insight ? (
        <section style={{ marginBottom: 26 }}>
          <div className="rubySurface" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, borderRadius: "var(--radius-card)", padding: 20 }}>
            <div>
              <span style={{ display: "block", marginBottom: 8, color: "rgba(255,255,255,0.6)", fontSize: "0.84rem", fontWeight: 800 }}>평균 상승여력</span>
              <strong style={{ fontSize: "1.4rem", color: "#fff" }}>{insight.avgUpside === null ? "산출 보류" : formatUpsidePercent(insight.avgUpside)}</strong>
            </div>
            <div>
              <span style={{ display: "block", marginBottom: 8, color: "rgba(255,255,255,0.6)", fontSize: "0.84rem", fontWeight: 800 }}>위험 주의 종목</span>
              <strong style={{ fontSize: "1.4rem", color: insight.riskyCount > 0 ? "#fca5a5" : "#86efac" }}>{insight.riskyCount}개</strong>
            </div>
            <div>
              <span style={{ display: "block", marginBottom: 8, color: "rgba(255,255,255,0.6)", fontSize: "0.84rem", fontWeight: 800 }}>가장 많이 담은 업종</span>
              <strong style={{ fontSize: "1.4rem", color: "#fff" }}>{insight.topSector ? `${insight.topSector[0]} (${insight.topSector[1]})` : "-"}</strong>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        {wishlistStocks.length === 0 ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 40, textAlign: "center", background: "#fbfdff" }}>
            <p style={{ margin: "0 0 6px", color: "#0f172a", fontSize: "1.05rem", fontWeight: 800 }}>
              관심종목을 등록하세요
            </p>
            <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6 }}>
              데일리 Top10이나 종목 상세에서 ☆ 를 누르면 여기에 모여요.
            </p>
            <Link href="/screener?tab=ranking" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 14, padding: "12px 18px", textDecoration: "none", fontWeight: 800, background: "#0f172a", color: "#fff" }}>
              데일리 Top10 보기
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {wishlistStocks.map((stock) => {
              const riskLevel = stock.riskLevel || "-";
              return (
                <article key={stock.code} style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 20, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px", fontSize: "1.2rem" }}>{cleanStockName(stock.name)}</h3>
                    <p style={{ margin: 0, color: "#64748b" }}>{stock.market} · {stock.code}</p>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "block", fontSize: "0.8rem", color: "#64748b" }}>현재가</span>
                      <strong>{formatPrice(stock?.metrics?.closePrice)}</strong>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "block", fontSize: "0.8rem", color: "#64748b" }}>상승여력</span>
                      <strong>{isFairValueOk(stock) ? formatUpsideDisplay(stock) : "산출 보류"}</strong>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "block", fontSize: "0.8rem", color: "#64748b" }}>위험도</span>
                      <strong style={{ color: riskLevel === "주의" ? "#dc2626" : riskLevel === "보통" ? "#b45309" : "#15803d" }}>{riskLevel}</strong>
                    </div>
                    <WishlistButton code={stock.code} name={stock.name} size="sm" />
                    <Link href={`/stock/${stock.code}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 40, padding: "0 14px", borderRadius: 12, fontWeight: 800, textDecoration: "none", background: "#0f172a", color: "#fff" }}>
                      상세보기
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

// 로그인 계정과 report_subscribers를 잇는 기능이 아직 없다(TASK 7 조사에서
// 확인 - report_subscribers는 결제 없는 이메일 사전등록 리스트일 뿐 계정과
// 연결되지 않음). 있는 척하는 UI를 만들지 않고, 실제 상태(이메일로 관리됨)를
// 정직하게 보여준다.
function SubscriptionPanel() {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "#fbfdff", textAlign: "center" }}>
      <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: "1.05rem" }}>구독 관리는 준비 중입니다</p>
      <p style={{ margin: "0 0 20px", color: "#64748b", lineHeight: 1.7 }}>
        지금은 리포트 구독·해지가 이메일 기준으로 처리됩니다. 메일 하단의 구독취소 링크를 이용해주세요.
      </p>
      <Link href="/reports" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 14, padding: "12px 18px", textDecoration: "none", fontWeight: 800, background: "#0f172a", color: "#fff" }}>
        리포트 보러 가기
      </Link>
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "#fbfdff", textAlign: "center" }}>
      <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: "1.05rem" }}>알림 설정은 준비 중입니다</p>
      <p style={{ margin: 0, color: "#64748b", lineHeight: 1.7 }}>
        관심종목 등급 변동 알림 등은 추후 지원될 예정입니다.
      </p>
    </div>
  );
}

function MePageContent({ stocks }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requestedTab = (searchParams.get("tab") || "").trim();
  const activeTab = TABS.some((t) => t.key === requestedTab) ? requestedTab : "wishlist";

  const handleTabChange = (nextTab) => {
    router.push(`${pathname}?tab=${nextTab}`, { scroll: false });
  };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 80px", color: "#0f172a", background: "var(--bg-me)" }}>
      <PageTopBar />

      <section style={{ marginBottom: 26 }}>
        <p style={{ display: "inline-flex", padding: "8px 14px", borderRadius: 999, background: "var(--color-surface-tint)", color: "var(--color-primary)", fontSize: "0.82rem", fontWeight: 900, marginBottom: 16 }}>MY</p>
        <h1 style={{ margin: "0 0 12px", fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.04em" }}>내 종목</h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.8, fontSize: "1.02rem" }}>
          데일리 Top10·리스크 체크·실전투자·종목 상세에서 ☆ 버튼을 눌러 추가한 종목을 한곳에서 모아봅니다. 로그인 계정에 저장되어, 다른 기기에서도 같은 목록을 볼 수 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 40,
              padding: "0 16px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid",
              borderColor: activeTab === tab.key ? "var(--color-primary)" : "#dbe3f0",
              background: activeTab === tab.key ? "var(--color-primary)" : "#fff",
              color: activeTab === tab.key ? "#fff" : "#334155",
              fontWeight: 800,
              fontSize: "0.92rem",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === "wishlist" && <WishlistPanel stocks={stocks} />}
      {activeTab === "subscription" && <SubscriptionPanel />}
      {activeTab === "notifications" && <NotificationsPanel />}
    </main>
  );
}

function MePageFallback() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 80px", color: "#0f172a", background: "var(--bg-me)" }}>
      <p style={{ color: "#64748b", fontWeight: 700 }}>불러오는 중...</p>
    </main>
  );
}

export default function MeClient({ stocks }) {
  return (
    <Suspense fallback={<MePageFallback />}>
      <MePageContent stocks={stocks} />
    </Suspense>
  );
}
