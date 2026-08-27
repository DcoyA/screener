// app/stock/[code]/page.js — 종목 상세 페이지 (canonical). /diagnosis/[code]는
// 이 경로로 301 리다이렉트한다(TASK 7).
import Link from "next/link";
import { notFound } from "next/navigation";
import WishlistButton from "../../components/WishlistButton";
import GradeBadge from "../../components/GradeBadge";
import { getUnifiedGrade } from "../../lib/grade";
import { getStockDiagnosisData, getSimilarStocks, getHoldingForCurrentUser } from "../../lib/diagnosisData";
import { getGradeHistory } from "../../lib/gradeHistory";
import { cleanStockName } from "../../lib/stockName";
import { formatSectorRelative } from "../../lib/sectorRelative";
import { fairValueStatusLabel } from "../../lib/fairValue";
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

function formatRatio(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toFixed(1)}%`;
}

// ① 한 줄 결론 - 등급 라벨이 아니라 사람이 읽는 문장으로. 매수/매도를
// 지시하지 않고("사세요"류 금지) 상태만 서술한다(CLAUDE.md 표현 규칙).
function buildConclusionSentence(stock, grade) {
  const score = Math.round(Number(stock.totalScore) || 0);
  switch (grade.code) {
    case "S":
      return `지금 조건이 가장 좋은 편입니다. 종합 ${score}점으로 상위권입니다.`;
    case "A":
      return "기본 체력은 갖췄지만, 지금 바로 담기보단 확인할 조건이 남았습니다.";
    case "B":
      return "지금 사기엔 애매합니다. 6개월 이상 길게 볼 생각이면 괜찮은 편입니다.";
    case "C":
      return "가격·타이밍 중 일부가 아직 불리합니다. 서두르지 않아도 되는 후보입니다.";
    default:
      return "현재 기준으로는 후보로 보기 어렵습니다.";
  }
}

// ② 왜 그렇게 봤나 - 아이콘 + 비교 기준 3줄. 비교 기준 없이 절대값만
// 보여주면 초보자는 판단할 근거가 없다(TASK 2의 문제의식).
function buildKeyReasons(stock) {
  const reasons = [];

  if (Number.isFinite(stock.per) && stock.per > 0) {
    const comparison = formatSectorRelative(stock, "per");
    const percentile = stock.sectorRelativeMeta?.per?.percentile;
    const cheap = Number.isFinite(percentile) ? percentile <= 50 : null;
    reasons.push({
      icon: "💰",
      label: cheap === null ? "가격 수준" : cheap ? "싸다" : "비싸다",
      detail: `PER ${stock.per.toFixed(1)}배${comparison ? ` · ${comparison}` : ""}`,
    });
  } else {
    reasons.push({
      icon: "💰",
      label: "가격 판단 보류",
      detail: "적자 상태라 PER 기반 저평가 판단이 어렵습니다.",
    });
  }

  const debt = Number(stock.debtRatio);
  const safe = Number.isFinite(debt) && debt < 100;
  reasons.push({
    icon: "🛡",
    label: safe ? "안 망함" : "부채 주의",
    detail: `부채비율 ${formatRatio(debt)} · 100% 넘으면 위험 신호`,
  });

  if (stock.fairValueStatus === "ok") {
    const upsideRising = Number.isFinite(stock.upsideRaw) && stock.upsideRaw > 0;
    reasons.push({
      icon: upsideRising ? "📈" : "📉",
      label: upsideRising ? "오를 여지 있음" : "여지 제한적",
      detail: `상승여력 ${stock.upsideDisplay} · 적정가 대비`,
    });
  } else {
    reasons.push({
      icon: "📉",
      label: "여지 판단 보류",
      detail: `${fairValueStatusLabel(stock.fairValueStatus)} · 적정가 대비 상승여력을 계산하지 않았습니다.`,
    });
  }

  return reasons;
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

export default async function StockDetailPage({ params }) {
  const { code } = await params;
  const stock = await getStockDiagnosisData(code);
  if (!stock) notFound();

  const grade = getUnifiedGrade(stock);
  const conclusion = buildConclusionSentence(stock, grade);
  const keyReasons = buildKeyReasons(stock);

  const scoreGroupsWithValues = SCORE_GROUPS.map((group) => ({
    ...group,
    score: stock[`${group.key}Score`],
  }));

  const [similarStocks, holding, gradeHistory] = await Promise.all([
    getSimilarStocks(stock.code, grade.code),
    getHoldingForCurrentUser(stock.code),
    getGradeHistory(stock.code, stock.unifiedGradeCode),
  ]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 120px", color: "#0f172a" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/screener?tab=ranking" style={{ fontWeight: 800, textDecoration: "none", color: "#334155" }}>
          ← 검색으로 돌아가기
        </Link>
      </div>

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <GradeBadge grade={grade} showDescription />
          <WishlistButton code={stock.code} name={stock.name} />
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: "2.1rem", letterSpacing: "-0.03em" }}>{cleanStockName(stock.name)}</h1>
        <p style={{ margin: "0 0 18px", color: "#64748b", fontWeight: 700 }}>{stock.market} · {stock.code}</p>
      </section>

      {/* ① 한 줄 결론 */}
      <section style={{ marginBottom: 28, border: "1px solid #e5e7eb", borderRadius: 20, padding: 22, background: "#f8fbff" }}>
        <p style={{ margin: 0, fontSize: "1.2rem", lineHeight: 1.7, fontWeight: 800 }}>{conclusion}</p>
      </section>

      <section style={{ marginBottom: 28, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <Metric label="현재가" value={formatPrice(stock.currentPrice)} />
        <Metric
          label="적정가 추정(보수~낙관)"
          value={
            stock.fairValueStatus === "ok"
              ? formatPriceBand(stock.targetPriceConservative ?? stock.targetPrice, stock.targetPriceOptimistic ?? stock.targetPrice)
              : fairValueStatusLabel(stock.fairValueStatus)
          }
          note={stock.fairValueStatus === "ok" && stock.holdingDiscount && stock.targetPrice ? "지주사 할인 30% 반영" : null}
        />
        <Metric label="상승여력" value={stock.fairValueStatus === "ok" ? stock.upsideDisplay : "산출 보류"} accent />
        <Metric label="부채비율" value={formatRatio(stock.debtRatio)} />
      </section>

      {/* ② 왜 그렇게 봤나 */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: "1.2rem" }}>왜 그렇게 봤나</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {keyReasons.map((reason) => (
            <div
              key={reason.icon}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "baseline",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: "14px 16px",
                background: "#fff",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>{reason.icon}</span>
              <span style={{ fontWeight: 800, minWidth: 96 }}>{reason.label}</span>
              <span style={{ color: "#475569" }}>{reason.detail}</span>
            </div>
          ))}
        </div>
      </section>

      {gradeHistory.timeline.some((p) => p.grade) && (
        <section style={{ marginBottom: 28, border: "1px solid #e5e7eb", borderRadius: 20, padding: 18, background: "#fff" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: "1.1rem" }}>등급 변동</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {gradeHistory.timeline.map((point, idx) => (
              <div key={point.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {idx > 0 && <span style={{ color: "#cbd5e1", fontWeight: 900 }}>→</span>}
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      minWidth: 36,
                      padding: "6px 10px",
                      borderRadius: 10,
                      fontWeight: 900,
                      background: point.grade ? "var(--ruby-100)" : "#f8fafc",
                      color: point.grade ? "var(--ruby-700)" : "#cbd5e1",
                    }}
                  >
                    {point.grade || "-"}
                  </div>
                  <span style={{ display: "block", marginTop: 4, fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>
                    {point.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {gradeHistory.bigSwing ? (
            <p
              style={{
                margin: "14px 0 0",
                padding: "10px 14px",
                borderRadius: 10,
                background: "#fffbeb",
                color: "#92400e",
                fontWeight: 700,
                fontSize: "0.88rem",
              }}
            >
              ⚠ 최근 등급 변동이 큽니다. 실적 발표나 주가 급변동을 확인하세요.
            </p>
          ) : null}
        </section>
      )}

      {holding && (
        <section style={{ marginBottom: 28, border: "1px solid #bfdbfe", borderRadius: 20, padding: 18, background: "#eff6ff" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 900, color: "#1d4ed8" }}>이미 이 종목을 보유하고 있어요</p>
          <p style={{ margin: 0, color: "#1e3a8a" }}>
            보유 {Number(holding.quantity).toLocaleString()}주 · 평균단가 {formatPrice(holding.avg_price)}
            {holding.grade_at_first_buy ? ` · 최초 매수 시 등급 ${holding.grade_at_first_buy}` : ""}
          </p>
        </section>
      )}

      {/* ③ 뭘 조심해야 하나 */}
      <section style={{ marginBottom: 28, border: "1px solid #e5e7eb", borderRadius: 20, padding: 20, background: "#fffdfa" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: "1.2rem" }}>뭘 조심해야 하나</h2>
        <p
          style={{
            margin: "0 0 10px",
            fontWeight: 800,
            color: stock.riskMeta.level === "높음" ? "#dc2626" : stock.riskMeta.level === "주의" ? "#ea580c" : "#15803d",
          }}
        >
          리스크 수준: {stock.riskMeta.level || "정보 없음"}
        </p>
        {stock.holdingDiscount ? (
          <p style={{ margin: "0 0 10px", color: "#334155", lineHeight: 1.7 }}>
            지주사라 사업 구조상 시장에서 원래 할인받는 편입니다. 적정가 계산에서도 30% 할인을 반영했습니다.
          </p>
        ) : null}
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

      {/* ④ 숫자로 보기 (기본 접힘 - <details>라 접혀 있어도 크롤링은 됨) */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: "1.3rem" }}>숫자로 보기</h2>
        <ScoreAccordion groups={scoreGroupsWithValues} scoreBreakdown={stock.scoreBreakdown} />
      </section>

      {similarStocks.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>비슷한 조건의 다른 종목</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {similarStocks.map((item) => (
              <Link
                key={item.code}
                href={`/stock/${item.code}`}
                style={{ padding: "10px 16px", borderRadius: 14, border: "1px solid #e5e7eb", textDecoration: "none", color: "#0f172a", fontWeight: 800 }}
              >
                {cleanStockName(item.name)} <span style={{ color: "#94a3b8", fontWeight: 600 }}>{item.code}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ⑤ CTA - 관심종목 담기가 주 CTA. 모의매수는 부가 기능으로 격하(TASK 6-3) */}
      <div style={{ position: "sticky", bottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <WishlistButton code={stock.code} name={stock.name} />
        <Link
          href={`/demo-trade?code=${stock.code}&name=${encodeURIComponent(stock.name)}`}
          style={{ color: "#64748b", fontWeight: 700, fontSize: "0.88rem", textDecoration: "underline" }}
        >
          이 종목으로 가상매수 체험하기
        </Link>
      </div>
    </main>
  );
}
