// app/diagnosis/[code]/page.js
import Link from "next/link";
import { notFound } from "next/navigation";
import stocks from "../../data/stocks.json";
import risks from "../../data/risks.json";
import WishlistButton from "../../components/WishlistButton";
import GradeBadge from "../../components/GradeBadge";
import { getUnifiedGrade } from "../../lib/grade";

const SCORE_META = [
  { key: "value", label: "가치", max: 30, desc: "저평가 정도를 나타냅니다. PER, PBR, 저평가 보너스를 합산합니다.",
    children: [
      { key: "perScore", label: "PER", max: 12 },
      { key: "pbrScore", label: "PBR", max: 12 },
      { key: "discountBonus", label: "저평가 보너스", max: 6 },
    ] },
  { key: "quality", label: "품질", max: 25, desc: "영업이익률과 안정성을 나타냅니다.",
    children: [
      { key: "operatingMarginScore", label: "영업이익률", max: 10 },
      { key: "roeScore", label: "ROE", max: 10 },
      { key: "profitStabilityScore", label: "이익 안정성", max: 5 },
    ] },
  { key: "safety", label: "안전성", max: 20, desc: "재무 안정성을 나타냅니다.",
    children: [
      { key: "debtRatioScore", label: "부채비율", max: 10 },
      { key: "earningsSafetyScore", label: "이익 안전성", max: 10 },
    ] },
  { key: "market", label: "시장성", max: 15, desc: "시장 규모와 유동성을 나타냅니다.",
    children: [
      { key: "marketCapScore", label: "시가총액", max: 7 },
      { key: "liquidityScore", label: "유동성", max: 8 },
    ] },
  { key: "change", label: "변화", max: 10, desc: "실적 흐름을 나타냅니다.",
    children: [
      { key: "revenueGrowthScore", label: "매출 성장", max: 4 },
      { key: "operatingIncomeGrowthScore", label: "영업이익 성장", max: 4 },
      { key: "netIncomeGrowthScore", label: "순이익 성장", max: 2 },
    ] },
];

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

function Metric({ label, value, accent }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "#fff" }}>
      <span style={{ display: "block", marginBottom: 8, color: "#64748b", fontSize: "0.84rem", fontWeight: 800 }}>{label}</span>
      <strong style={{ fontSize: "1.15rem", color: accent ? "#0ea5e9" : "#0f172a" }}>{value}</strong>
    </div>
  );
}

export default async function DiagnosisPage({ params }) {
  const { code } = await params;
  const stock = stocks.find((item) => String(item.code) === String(code));
  if (!stock) notFound();

  const risk = risks.find((item) => String(item.code) === String(code));
  const grade = getUnifiedGrade(stock);
  const oneLiner = (stock?.finalPickMeta?.reasons || [])[0] || "핵심 판단 근거가 아직 준비되지 않았습니다.";

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 120px", color: "#0f172a" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/search?tab=ranking" style={{ fontWeight: 800, textDecoration: "none", color: "#334155" }}>
          ← 검색으로 돌아가기
        </Link>
      </div>

      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <GradeBadge grade={grade} showDescription />
          <WishlistButton code={stock.code} name={stock.name} />
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: "2.1rem", letterSpacing: "-0.03em" }}>{stock.name}</h1>
        <p style={{ margin: "0 0 18px", color: "#64748b", fontWeight: 700 }}>{stock.market} · {stock.code}</p>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f8fbff" }}>
          <p style={{ margin: 0, fontSize: "1.08rem", lineHeight: 1.7, fontWeight: 700 }}>{oneLiner}</p>
        </div>
      </section>

      <section style={{ marginBottom: 28, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <Metric label="현재가" value={formatPrice(stock?.metrics?.closePrice)} />
        <Metric label="적정가 추정" value={formatPrice(stock?.metrics?.targetPrice)} />
        <Metric label="상승여력" value={formatPercent(stock?.metrics?.upside)} accent />
        <Metric label="부채비율" value={formatPercent(stock?.metrics?.debtRatio)} />
      </section>

      {risk ? (
        <section style={{ marginBottom: 28, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#fffdfa" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: "1.2rem" }}>리스크 체크</h2>
          <p style={{ margin: "0 0 8px", fontWeight: 800, color: risk.level === "주의" ? "#dc2626" : risk.level === "보통" ? "#b45309" : "#15803d" }}>
            리스크 수준: {risk.level}
          </p>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.75 }}>{risk.checkPoint}</p>
        </section>
      ) : null}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: "1.3rem" }}>점수 상세</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {SCORE_META.map((group) => (
            <div key={group.key} style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <strong>{group.label}</strong>
                <span>{Number(stock?.scoreBreakdown?.[group.key] ?? 0)} / {group.max}</span>
              </div>
              <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: "0.9rem" }}>{group.desc}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {group.children.map((child) => (
                  <span key={child.key} style={{ fontSize: "0.82rem", color: "#475569", background: "#f1f5f9", borderRadius: 999, padding: "4px 10px" }}>
                    {child.label} {Number(stock?.scoreBreakdown?.[child.key] ?? 0)}/{child.max}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ position: "sticky", bottom: 16, display: "flex", justifyContent: "center" }}>
        <Link
          href={`/demo-trade?code=${stock.code}&name=${encodeURIComponent(stock.name)}`}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 54, padding: "0 28px", borderRadius: 999, background: "#0f172a", color: "#fff", fontWeight: 900, fontSize: "1.05rem", textDecoration: "none", boxShadow: "0 20px 40px rgba(15,23,42,0.25)" }}
        >
          이 종목으로 가상매수 체험하기
        </Link>
      </div>
    </main>
  );
}
