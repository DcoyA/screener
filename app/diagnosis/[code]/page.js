// app/diagnosis/[code]/page.js
import Link from "next/link";
import { notFound } from "next/navigation";
import WishlistButton from "../../components/WishlistButton";
import GradeBadge from "../../components/GradeBadge";
import { getUnifiedGrade } from "../../lib/grade";
import { getStockDiagnosisData, getSimilarStocks, getHoldingForCurrentUser } from "../../lib/diagnosisData";
import { cleanStockName } from "../../lib/stockName";
import ScoreAccordion from "./components/ScoreAccordion";

const SCORE_GROUPS = [
  {
    key: "value", label: "가치", max: 30, desc: "저평가 정도를 나타냅니다. PER, PBR, 저평가 보너스를 합산합니다.",
    children: [
      { key: "perScore", label: "PER", max: 12 },
      { key: "pbrScore", label: "PBR", max: 12 },
      { key: "discountBonus", label: "저평가 보너스", max: 6 },
    ],
  },
  {
    key: "quality", label: "품질", max: 25, desc: "영업이익률과 안정성을 나타냅니다.",
    children: [
      { key: "operatingMarginScore", label: "영업이익률", max: 10 },
      { key: "roeScore", label: "ROE", max: 10 },
      { key: "profitStabilityScore", label: "이익 안정성", max: 5 },
    ],
  },
  {
    key: "safety", label: "안전성", max: 20, desc: "재무 안정성을 나타냅니다.",
    children: [
      { key: "debtRatioScore", label: "부채비율", max: 10 },
      { key: "earningsSafetyScore", label: "이익 안전성", max: 10 },
    ],
  },
  {
    key: "market", label: "시장성", max: 15, desc: "시장 규모와 유동성을 나타냅니다.",
    children: [
      { key: "marketCapScore", label: "시가총액", max: 7 },
      { key: "liquidityScore", label: "유동성", max: 8 },
    ],
  },
  {
    key: "change", label: "변화", max: 10, desc: "실적 흐름을 나타냅니다.",
    children: [
      { key: "revenueGrowthScore", label: "매출 성장", max: 4 },
      { key: "operatingIncomeGrowthScore", label: "영업이익 성장", max: 4 },
      { key: "netIncomeGrowthScore", label: "순이익 성장", max: 2 },
    ],
  },
];

function formatPrice(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

// 적정가는 단일값이 아니라 보수/낙관 밴드로 표시한다(fair-value v2).
// 만 단위로 반올림해서 "48만~72만원" 형태로 보여준다.
function formatPriceBand(low, high) {
  const loNum = Number(low);
  const hiNum = Number(high);
  if (!Number.isFinite(loNum) || !Number.isFinite(hiNum) || (!loNum && !hiNum)) return "-";
  const toManwon = (n) => Math.round(n / 10000);
  const lo = toManwon(loNum);
  const hi = toManwon(hiNum);
  if (lo === hi) return `${lo.toLocaleString("ko-KR")}만원`;
  return `${lo.toLocaleString("ko-KR")}만~${hi.toLocaleString("ko-KR")}만원`;
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function formatRatio(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toFixed(1)}%`;
}

function Metric({ label, value, accent, note }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "#fff" }}>
      <span style={{ display: "block", marginBottom: 8, color: "#64748b", fontSize: "0.84rem", fontWeight: 800 }}>{label}</span>
      <strong style={{ fontSize: "1.15rem", color: accent ? "#0ea5e9" : "#0f172a" }}>{value}</strong>
      {note ? (
        <span style={{ display: "block", marginTop: 4, color: "#94a3b8", fontSize: "0.72rem", fontWeight: 700 }}>{note}</span>
      ) : null}
    </div>
  );
}

export default async function DiagnosisPage({ params }) {
  const { code } = await params;
  const stock = await getStockDiagnosisData(code);
  if (!stock) notFound();

  const grade = getUnifiedGrade(stock);
  const oneLiner = stock.finalPickMeta.reasons[0] || "핵심 판단 근거가 아직 준비되지 않았습니다.";

  const scoreGroupsWithValues = SCORE_GROUPS.map((group) => ({
    ...group,
    score: stock[`${group.key}Score`],
  }));

  const [similarStocks, holding] = await Promise.all([
    getSimilarStocks(stock.code, grade.code),
    getHoldingForCurrentUser(stock.code),
  ]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 120px", color: "#0f172a" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/search?tab=ranking" style={{ fontWeight: 800, textDecoration: "none", color: "#334155" }}>
          ← 검색으로 돌아가기
        </Link>
      </div>

      {/* 1순위: 등급, 결론, 가격, CTA */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <GradeBadge grade={grade} showDescription />
          <WishlistButton code={stock.code} name={stock.name} />
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: "2.1rem", letterSpacing: "-0.03em" }}>{cleanStockName(stock.name)}</h1>
        <p style={{ margin: "0 0 18px", color: "#64748b", fontWeight: 700 }}>{stock.market} · {stock.code}</p>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#f8fbff" }}>
          <p style={{ margin: 0, fontSize: "1.08rem", lineHeight: 1.7, fontWeight: 700 }}>{oneLiner}</p>
        </div>
      </section>

      <section style={{ marginBottom: 28, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <Metric label="현재가" value={formatPrice(stock.currentPrice)} />
        <Metric
          label="적정가 추정(보수~낙관)"
          value={formatPriceBand(stock.targetPriceConservative ?? stock.targetPrice, stock.targetPriceOptimistic ?? stock.targetPrice)}
          note={stock.holdingDiscount && stock.targetPrice ? "지주사 할인 30% 반영" : null}
        />
        <Metric
          label="상승여력"
          value={stock.upsideDisplay}
          accent
        />
        <Metric label="부채비율" value={formatRatio(stock.debtRatio)} />
      </section>

      {holding && (
        <section style={{ marginBottom: 28, border: "1px solid #bfdbfe", borderRadius: 20, padding: 18, background: "#eff6ff" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 900, color: "#1d4ed8" }}>이미 이 종목을 보유하고 있어요</p>
          <p style={{ margin: 0, color: "#1e3a8a" }}>
            보유 {Number(holding.quantity).toLocaleString()}주 · 평균단가 {formatPrice(holding.avg_price)}
            {holding.grade_at_first_buy ? ` · 최초 매수 시 등급 ${holding.grade_at_first_buy}` : ""}
          </p>
        </section>
      )}

      {/* 2순위: 다섯 축 신호등 + 접힘 세부점수 */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: "1.3rem" }}>한눈에 보는 진단</h2>
        <ScoreAccordion groups={scoreGroupsWithValues} scoreBreakdown={stock.scoreBreakdown} />
      </section>

      {/* 3순위: 리스크, 태그, 유사종목 */}
      <section style={{ marginBottom: 28, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#fffdfa" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: "1.2rem" }}>리스크 체크</h2>
        <p
          style={{
            margin: "0 0 10px",
            fontWeight: 800,
            color: stock.riskMeta.level === "높음" ? "#dc2626" : stock.riskMeta.level === "주의" ? "#ea580c" : "#15803d",
          }}
        >
          리스크 수준: {stock.riskMeta.level || "정보 없음"}
        </p>
        {stock.riskMeta.flags.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stock.riskMeta.flags.map((flag, index) => (
              <span key={`${flag}-${index}`} style={{ fontSize: "0.85rem", color: "#9a3412", background: "#ffedd5", borderRadius: 999, padding: "6px 12px" }}>
                {flag}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: "#475569" }}>현재 특별한 위험 신호는 감지되지 않았습니다.</p>
        )}
      </section>

      {(stock.rankFlags.length > 0 || stock.undervalueFlags.length > 0) && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>관련 이슈</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[...stock.rankFlags, ...stock.undervalueFlags].map((flag, index) => (
              <span key={`${flag}-${index}`} style={{ fontSize: "0.85rem", color: "#334155", background: "#e2e8f0", borderRadius: 999, padding: "6px 12px" }}>
                {flag}
              </span>
            ))}
          </div>
        </section>
      )}

      {similarStocks.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>비슷한 조건의 다른 종목</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {similarStocks.map((item) => (
              <Link
                key={item.code}
                href={`/diagnosis/${item.code}`}
                style={{ padding: "10px 16px", borderRadius: 14, border: "1px solid #e5e7eb", textDecoration: "none", color: "#0f172a", fontWeight: 800 }}
              >
                {cleanStockName(item.name)} <span style={{ color: "#94a3b8", fontWeight: 600 }}>{item.code}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
