
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import stocks from "../data/stocks.json";
import risks from "../data/risks.json";
import MainNav from "../components/MainNav";
import WishlistButton from "../components/WishlistButton";

const GROUPS = {
  buy: { title: "매수 후보", short: "매수", color: "#0f766e", bg: "#ccfbf1", desc: "업종·타이밍·시장 적합도·리스크를 다시 통과한 후보입니다." },
  watch: { title: "관찰 후보", short: "관찰", color: "#b45309", bg: "#fff7ed", desc: "기본 체력은 볼 만하지만 지금 바로 진입하기엔 확인할 조건이 남은 후보입니다." },
  wait: { title: "대기 후보", short: "대기", color: "#2563eb", bg: "#dbeafe", desc: "가격·타이밍·상승여력 측면에서 기다림이 필요한 후보입니다." },
  risky: { title: "주의 후보", short: "주의", color: "#ea580c", bg: "#ffedd5", desc: "테마성, 변동성, 뉴스 플래그, 타이밍 약화 등으로 강하게 보류한 종목입니다." },
  exclude: { title: "제외 후보", short: "제외", color: "#be123c", bg: "#ffe4e6", desc: "랭킹에 올라와도 현재 기준에서는 실전 매수 대상으로 보기 어려운 종목입니다." },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

function formatCompactKrw(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  if (num >= 1_0000_0000_0000) return `${(num / 1_0000_0000_0000).toFixed(1)}조원`;
  if (num >= 1_0000_0000) return `${Math.round(num / 1_0000_0000).toLocaleString("ko-KR")}억원`;
  return `${num.toLocaleString("ko-KR")}원`;
}

function sortForBaselineRanking(items) {
  return [...items].sort((a, b) => {
    const eligibleDiff = Number(!!b?.rankMeta?.topRankEligible) - Number(!!a?.rankMeta?.topRankEligible);
    if (eligibleDiff) return eligibleDiff;
    const scoreDiff = Number(b?.totalScore || 0) - Number(a?.totalScore || 0);
    if (scoreDiff) return scoreDiff;
    return Number(b?.metrics?.avgTradeValue5d || 0) - Number(a?.metrics?.avgTradeValue5d || 0);
  });
}

function normalizeDecision(raw) {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "BUY_CANDIDATE" || value === "BUY" || raw === "매수 후보") return "buy";
  if (value === "WATCH" || raw === "관찰") return "watch";
  if (value === "WAIT" || value === "WAIT_FOR_PULLBACK" || raw === "대기") return "wait";
  if (value === "RISKY" || raw === "주의") return "risky";
  if (value === "EXCLUDED" || value === "EXCLUDE" || raw === "제외") return "exclude";
  return "watch";
}

function getSectorTypeLabel(type) {
  if (type === "theme") return "테마/수급형";
  if (type === "speculative") return "고변동형";
  if (type === "cyclical") return "사이클형";
  if (type === "defensive") return "방어형";
  return "일반형";
}

function fallbackFinalPickMeta(stock) {
  return {
    decision: "WATCH",
    finalScore: Number(stock?.totalScore || 50),
    sectorType: "normal",
    reasons: [
      "아직 finalPickMeta가 생성되지 않아 기존 랭킹 정보를 임시로 표시합니다.",
      "데이터 업데이트 워크플로우를 실행하면 실전투자 전용 판단값이 반영됩니다.",
    ],
    debug: {
      baseScore: Number(stock?.totalScore || 0),
      timingScore: Number(stock?.timingMeta?.score || 0),
      sectorStrength: Number(stock?.sectorMeta?.strengthScore || 0),
      marketFit: Number(stock?.marketContext?.fitScore || 0),
      liquidityScore: Number(stock?.scoreBreakdown?.liquidityScore || 0),
    },
  };
}

function buildRiskMap(items) {
  const map = new Map();
  items.forEach((item) => map.set(String(item.code), item));
  return map;
}

function buildFinalPicks(stocksData, risksData) {
  const ranked = sortForBaselineRanking(stocksData);
  const rankMap = new Map(ranked.map((item, idx) => [String(item.code), idx + 1]));
  const riskMap = buildRiskMap(risksData);

  const evaluated = ranked.map((stock) => {
    const meta = stock?.finalPickMeta || fallbackFinalPickMeta(stock);
    const decisionKey = normalizeDecision(meta.decision);
    const riskItem = riskMap.get(String(stock.code));
    return {
      ...stock,
      meta,
      decisionKey,
      decision: GROUPS[decisionKey],
      finalScore: Math.round(clamp(Number(meta.finalScore ?? stock.totalScore ?? 0), 0, 100)),
      reasons: Array.isArray(meta.reasons) && meta.reasons.length ? meta.reasons : ["실전투자 판단 사유가 아직 없습니다."],
      debug: meta.debug || {},
      sectorType: meta.sectorType || "normal",
      baselineRank: rankMap.get(String(stock.code)),
      riskLevel: riskItem?.level || stock?.riskMeta?.level || "낮음",
    };
  });

  const order = { buy: 0, watch: 1, wait: 2, risky: 3, exclude: 4 };
  evaluated.sort((a, b) => {
    const group = order[a.decisionKey] - order[b.decisionKey];
    if (group) return group;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return (a.baselineRank || 9999) - (b.baselineRank || 9999);
  });

  return {
    buy: evaluated.filter((item) => item.decisionKey === "buy"),
    watch: evaluated.filter((item) => item.decisionKey === "watch"),
    wait: evaluated.filter((item) => item.decisionKey === "wait"),
    risky: evaluated.filter((item) => item.decisionKey === "risky"),
    exclude: evaluated.filter((item) => item.decisionKey === "exclude"),
  };
}

const S = {
  page: { maxWidth: 1180, margin: "0 auto", padding: "32px 24px 80px", color: "#0f172a" },
  topLinks: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 26, flexWrap: "wrap" },
  homeBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 14, padding: "12px 16px", textDecoration: "none", fontWeight: 800, border: "1px solid #0f172a", background: "#0f172a", color: "#fff" },
  card: { border: "1px solid #e5e7eb", borderRadius: 28, background: "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)", boxShadow: "0 20px 50px rgba(15,23,42,.06)" },
  badge: { display: "inline-flex", padding: "8px 14px", borderRadius: 999, background: "#eef2ff", color: "#4f46e5", fontSize: ".82rem", fontWeight: 900, marginBottom: 16 },
};

function Chip({ children, color = "#475569", bg = "#f1f5f9" }) {
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "7px 12px", borderRadius: 999, fontSize: ".8rem", fontWeight: 900, color, background: bg }}>{children}</span>;
}

function Metric({ label, value, accent }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, background: "#fff" }}>
      <span style={{ display: "block", marginBottom: 8, color: "#64748b", fontSize: ".84rem", fontWeight: 800 }}>{label}</span>
      <strong style={{ display: "block", fontSize: "1.08rem", lineHeight: 1.35, color: accent ? "#0ea5e9" : "#0f172a" }}>{value}</strong>
    </div>
  );
}

function DebugScore({ label, value }) {
  const display = Number.isFinite(Number(value)) ? Math.round(Number(value)) : "-";
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 12, background: "#fbfdff" }}>
      <span style={{ display: "block", marginBottom: 6, color: "#64748b", fontSize: ".78rem", fontWeight: 800 }}>{label}</span>
      <strong style={{ display: "block", fontSize: "1.15rem" }}>{display}</strong>
    </div>
  );
}

function PickCard({ item }) {
  const color = item.decision.color;
  const bg = item.decision.bg;
  const debug = item.debug || {};

  return (
    <article style={{ ...S.card, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ minWidth: 0, flex: "1 1 560px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Chip color="#4f46e5" bg="#eef2ff">기존 랭킹 #{item.baselineRank ?? "-"}</Chip>
            <Chip color={color} bg={bg}>{item.decision.title}</Chip>
            <Chip color={item.riskLevel === "주의" ? "#dc2626" : item.riskLevel === "보통" ? "#b45309" : "#15803d"} bg={item.riskLevel === "주의" ? "#fee2e2" : item.riskLevel === "보통" ? "#fef3c7" : "#dcfce7"}>리스크 {item.riskLevel}</Chip>
            <Chip>{getSectorTypeLabel(item.sectorType)}</Chip>
            {item?.rankMeta?.topRankEligible ? <Chip color="#0284c7" bg="#e0f2fe">랭킹 적격</Chip> : null}
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: "1.72rem", letterSpacing: "-0.03em", wordBreak: "keep-all" }}>{item.name}</h3>
          <p style={{ margin: 0, color: "#64748b" }}>{item.market} · {item.code} · {item.sector || "업종 미분류"}</p>
          <div style={{ marginTop: 10 }}>
            <WishlistButton code={item.code} name={item.name} size="sm" />
          </div>
        </div>

        <div style={{ minWidth: 170, border: "1px solid #e5e7eb", borderRadius: 22, padding: 16, background: "#fff", textAlign: "right" }}>
          <span style={{ display: "block", marginBottom: 6, color: "#64748b", fontSize: ".84rem", fontWeight: 800 }}>실전투자 점수</span>
          <strong style={{ display: "block", fontSize: "2rem", lineHeight: 1, color }}>{item.finalScore}점</strong>
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, background: "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)", padding: 20, boxShadow: "0 18px 40px rgba(15,23,42,.06)" }}>
        <div className="metricGrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 14 }}>
          <Metric label="현재가" value={formatPrice(item?.metrics?.closePrice)} />
          <Metric label="적정가 추정" value={formatPrice(item?.metrics?.targetPrice)} />
          <Metric label="상승여력" value={formatPercent(item?.metrics?.upside)} accent />
          <Metric label="거래대금" value={formatCompactKrw(item?.metrics?.avgTradeValue5d)} />
          <Metric label="PER" value={item?.metrics?.per ? `${Number(item.metrics.per).toFixed(1)}배` : "-"} />
          <Metric label="PBR" value={item?.metrics?.pbr ? `${Number(item.metrics.pbr).toFixed(1)}배` : "-"} />
          <Metric label="부채비율" value={item?.metrics?.debtRatio ? `${Number(item.metrics.debtRatio).toFixed(1)}%` : "-"} />
          <Metric label="5일 등락률" value={formatPercent(item?.metrics?.priceChangeRate)} accent />
        </div>

        <div style={{ border: "1px solid #0f172a", borderRadius: 18, padding: 16, background: "#0f172a", color: "#fff", marginBottom: 12 }}>
          <span style={{ display: "block", marginBottom: 8, fontSize: ".84rem", fontWeight: 900 }}>최종 판단</span>
          <p style={{ margin: 0, color: "#e5e7eb", lineHeight: 1.78 }}>
            기존 랭킹 #{item.baselineRank ?? "-"} 후보였지만, finalPickMeta 기준으로 업종 타입·타이밍·시장 적합도·리스크를 다시 계산한 결과 <b style={{ color: "#fff" }}>{item.decision.title}</b>로 분류했습니다.
          </p>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, background: "#fff", marginBottom: 12 }}>
          <span style={{ display: "block", marginBottom: 8, fontSize: ".84rem", fontWeight: 900 }}>판정 이유</span>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#475569", lineHeight: 1.8 }}>
            {item.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>

        <div className="scoreGrid" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
          <DebugScore label="랭킹" value={debug.baseScore ?? item.totalScore} />
          <DebugScore label="타이밍" value={debug.timingScore ?? item.timingMeta?.score} />
          <DebugScore label="업종" value={debug.sectorStrength ?? item.sectorMeta?.strengthScore} />
          <DebugScore label="시장" value={debug.marketFit ?? item.marketContext?.fitScore} />
          <DebugScore label="유동성" value={debug.liquidityScore} />
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, background: "#fbfdff" }}>
          <span style={{ display: "block", marginBottom: 8, fontSize: ".84rem", fontWeight: 900 }}>읽는 법</span>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.78 }}>랭킹 상위 종목도 테마성 업종, 타이밍 약화, 뉴스 플래그, 시장 부적합성이 있으면 주의 또는 제외로 내려갑니다. 이 페이지는 매수 추천이 아니라 실전 검토 우선순위 정리입니다.</p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <Link href={`/stock/${item.code}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 46, padding: "0 16px", borderRadius: 14, fontWeight: 800, textDecoration: "none", background: "#0f172a", color: "#fff" }}>종목 상세 보기</Link>
          <Link href={`/risk?code=${item.code}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 46, padding: "0 16px", borderRadius: 14, fontWeight: 800, textDecoration: "none", background: "#fff", color: "#0f172a", border: "1px solid #dbe3f0" }}>리스크 확인</Link>
        </div>
      </div>
    </article>
  );
}

export default function FinalPicksPage() {
  const [selectedGroup, setSelectedGroup] = useState("watch");
  const finalPicks = useMemo(() => buildFinalPicks(stocks, risks), []);
  const current = finalPicks[selectedGroup] || [];
  const hasFinalPickMeta = stocks.some((stock) => stock?.finalPickMeta);

  return (
    <main style={S.page}>
      <div style={S.topLinks}>
        <Link href="/" style={S.homeBtn}>홈으로 가기</Link>
        <MainNav />
      </div>

      <section style={{ ...S.card, padding: 28, marginBottom: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 640px" }}>
            <p style={S.badge}>FINAL PICKS</p>
            <h1 style={{ margin: "0 0 12px", fontSize: "clamp(2rem,4vw,3rem)", letterSpacing: "-0.04em", wordBreak: "keep-all" }}>랭킹 이후, 실전 투자 후보만 한 번 더 걸러봅니다</h1>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.8, fontSize: "1.02rem" }}>랭킹이 1차 후보를 만든다면, 실전투자 페이지는 finalPickMeta를 기준으로 업종 성격, 시장 적합도, 타이밍, 뉴스/리스크 플래그를 다시 반영해 후보를 압축합니다.</p>
            {!hasFinalPickMeta ? <div style={{ marginTop: 16, border: "1px solid #fde68a", borderRadius: 18, background: "#fffbeb", color: "#92400e", padding: "14px 16px", fontWeight: 900, lineHeight: 1.65 }}>아직 stocks.json에 finalPickMeta가 없습니다. 수정된 update_data.py로 데이터 업데이트 워크플로우를 먼저 실행해야 새 실전투자 로직이 완전히 반영됩니다.</div> : null}
          </div>

          <div className="heroCountGrid" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 10, minWidth: 500, width: 560 }}>
            {Object.entries(GROUPS).map(([key, meta]) => <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 16, background: "#fff" }}><span style={{ display: "block", marginBottom: 8, fontSize: ".82rem", fontWeight: 900, color: meta.color }}>{meta.short}</span><strong style={{ fontSize: "1.55rem", color: meta.color }}>{finalPicks[key]?.length ?? 0}</strong></div>)}
          </div>
        </div>
      </section>

      <section style={{ ...S.card, padding: 24, marginBottom: 26 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(GROUPS).map(([key, meta]) => (
            <button key={key} type="button" onClick={() => setSelectedGroup(key)} style={{ height: 44, padding: "0 18px", borderRadius: 999, border: selectedGroup === key ? "1px solid #0f172a" : "1px solid #dbe3f0", background: selectedGroup === key ? "#0f172a" : "#fff", color: selectedGroup === key ? "#fff" : "#0f172a", fontWeight: 900, cursor: "pointer" }}>
              {meta.short} <span style={{ opacity: 0.72 }}>{finalPicks[key]?.length ?? 0}</span>
            </button>
          ))}
        </div>
        <p style={{ margin: "14px 0 0", color: "#64748b", lineHeight: 1.7 }}>현재 선택: {GROUPS[selectedGroup].title} · {GROUPS[selectedGroup].desc}</p>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.8rem", letterSpacing: "-0.03em" }}>{GROUPS[selectedGroup].title}</h2>
            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.72 }}>{GROUPS[selectedGroup].desc}</p>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 74, height: 42, padding: "0 14px", borderRadius: 14, background: "#0f172a", color: "#fff", fontWeight: 900 }}>{current.length}개</span>
        </div>

        {current.length ? <div style={{ display: "grid", gap: 18 }}>{current.map((item) => <PickCard key={`${item.decisionKey}-${item.code}`} item={item} />)}</div> : <div style={{ ...S.card, padding: 24 }}><p style={{ margin: 0, color: "#64748b", fontWeight: 900 }}>현재 기준으로 표시할 종목이 없습니다.</p></div>}
      </section>

      <section style={{ ...S.card, padding: 24, marginTop: 26 }}>
        <p style={{ ...S.badge, marginBottom: 10 }}>LOGIC NOTE</p>
        <h2 style={{ margin: "0 0 16px", fontSize: "1.5rem", letterSpacing: "-0.03em" }}>왜 랭킹과 실전투자 결과가 다를 수 있나</h2>
        <div className="logicGrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
          {["랭킹은 재무, 밸류, 유동성 중심의 1차 후보 발굴입니다.", "실전투자는 finalPickMeta 기준으로 업종, 타이밍, 시장, 뉴스, 리스크를 재평가합니다.", "테마/엔터/고변동 업종은 점수와 타이밍이 충분히 높지 않으면 주의 또는 제외로 분류합니다.", "최종 판단은 매수 추천이 아니라 실제 검토 우선순위를 나누는 보조 도구입니다."].map((text) => <div key={text} style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, background: "#fff", color: "#64748b", lineHeight: 1.7 }}>{text}</div>)}
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 980px) {
          .heroCountGrid, .metricGrid, .scoreGrid, .logicGrid { grid-template-columns: 1fr 1fr !important; width: 100% !important; min-width: 0 !important; }
        }
        @media (max-width: 760px) {
          .heroCountGrid, .metricGrid, .scoreGrid, .logicGrid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
