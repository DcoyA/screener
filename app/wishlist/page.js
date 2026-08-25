"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import stocks from "../data/stocks.json";
import risks from "../data/risks.json";
import PageTopBar from "../components/PageTopBar";
import WishlistButton from "../components/WishlistButton";
import { getWishlist } from "../lib/wishlist";

function formatPrice(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function buildRiskMap(items) {
  const map = new Map();
  items.forEach((item) => map.set(String(item.code), item));
  return map;
}

export default function WishlistPage() {
  const [wishlistEntries, setWishlistEntries] = useState([]);
  const [mounted, setMounted] = useState(false);
  const riskMap = useMemo(() => buildRiskMap(risks), []);
  const stockMap = useMemo(() => new Map(stocks.map((item) => [String(item.code), item])), []);

  useEffect(() => {
    setMounted(true);
    getWishlist().then((list) => setWishlistEntries(list));
  }, []);

  const wishlistStocks = useMemo(() => {
    return wishlistEntries.map((entry) => stockMap.get(String(entry.code))).filter(Boolean);
  }, [wishlistEntries, stockMap]);

  const insight = useMemo(() => {
    if (!wishlistStocks.length) return null;

    const avgUpside =
      wishlistStocks.reduce((sum, item) => sum + (Number(item?.metrics?.upside) || 0), 0) / wishlistStocks.length;

    const riskyCount = wishlistStocks.filter((item) => {
      const level = riskMap.get(String(item.code))?.level || item?.riskMeta?.level;
      return level === "주의";
    }).length;

    const sectorCount = new Map();
    wishlistStocks.forEach((item) => {
      const sector = item.sector || "미분류";
      sectorCount.set(sector, (sectorCount.get(sector) || 0) + 1);
    });
    const topSector = [...sectorCount.entries()].sort((a, b) => b[1] - a[1])[0];

    return { avgUpside, riskyCount, topSector };
  }, [wishlistStocks, riskMap]);

  if (!mounted) return null;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 24px 80px", color: "#0f172a" }}>
      <PageTopBar />

      <section style={{ marginBottom: 26 }}>
        <p style={{ display: "inline-flex", padding: "8px 14px", borderRadius: 999, background: "var(--color-surface-tint)", color: "var(--color-primary)", fontSize: "0.82rem", fontWeight: 900, marginBottom: 16 }}>WISHLIST</p>
        <h1 style={{ margin: "0 0 12px", fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.04em" }}>내 관심종목</h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.8, fontSize: "1.02rem" }}>
          랭킹·위험진단·실전투자·종목상세 페이지에서 ☆ 버튼을 눌러 추가한 종목을 한곳에서 모아봅니다. 이 목록은 브라우저에만 저장되며 서버로 전송되지 않습니다.
        </p>
      </section>

      {insight ? (
        <section style={{ marginBottom: 26 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, borderRadius: "var(--radius-card)", background: "var(--color-primary-dark)", padding: 20 }}>
            <div>
              <span style={{ display: "block", marginBottom: 8, color: "rgba(255,255,255,0.6)", fontSize: "0.84rem", fontWeight: 800 }}>평균 상승여력</span>
              <strong style={{ fontSize: "1.4rem", color: "#fff" }}>{formatPercent(insight.avgUpside)}</strong>
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
            <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "1.02rem", fontWeight: 700 }}>
              아직 관심종목이 없습니다. 랭킹이나 종목 상세 페이지에서 ☆ 버튼을 눌러 추가해보세요.
            </p>
            <Link href="/search?tab=ranking" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 14, padding: "12px 18px", textDecoration: "none", fontWeight: 800, background: "#0f172a", color: "#fff" }}>
              랭킹 보러 가기
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {wishlistStocks.map((stock) => {
              const riskLevel = riskMap.get(String(stock.code))?.level || stock?.riskMeta?.level || "-";
              return (
                <article key={stock.code} style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 20, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px", fontSize: "1.2rem" }}>{stock.name}</h3>
                    <p style={{ margin: 0, color: "#64748b" }}>{stock.market} · {stock.code}</p>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "block", fontSize: "0.8rem", color: "#64748b" }}>현재가</span>
                      <strong>{formatPrice(stock?.metrics?.closePrice)}</strong>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "block", fontSize: "0.8rem", color: "#64748b" }}>상승여력</span>
                      <strong>{formatPercent(stock?.metrics?.upside)}</strong>
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
    </main>
  );
}
