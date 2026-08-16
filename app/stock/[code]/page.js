import Link from "next/link";
import { notFound } from "next/navigation";
import stocks from "../../data/stocks.json";
import WishlistButton from "../../components/WishlistButton";
import { getUnifiedGrade } from "../../lib/grade";
import GradeBadge from "../../components/GradeBadge";

const SCORE_META = [
  {
    key: "value",
    label: "가치",
    max: 30,
    desc: "저평가 정도를 반영합니다. PER, PBR, 저평가 보너스를 합산합니다.",
    children: [
      { key: "perScore", label: "PER", max: 12 },
      { key: "pbrScore", label: "PBR", max: 12 },
      { key: "discountBonus", label: "저평가 보너스", max: 6 },
    ],
  },
  {
    key: "quality",
    label: "품질",
    max: 25,
    desc: "수익성과 효율성을 반영합니다. 영업이익률, ROE, 이익 안정성을 반영합니다.",
    children: [
      { key: "operatingMarginScore", label: "영업이익률", max: 10 },
      { key: "roeScore", label: "ROE", max: 10 },
      { key: "profitStabilityScore", label: "이익 안정성", max: 5 },
    ],
  },
  {
    key: "safety",
    label: "안정성",
    max: 20,
    desc: "재무 안정성과 손익 안전성을 반영합니다. 부채비율과 이익 안전성을 기준으로 계산됩니다.",
    children: [
      { key: "debtRatioScore", label: "부채비율", max: 10 },
      { key: "earningsSafetyScore", label: "이익 안전성", max: 10 },
    ],
  },
  {
    key: "market",
    label: "시장성",
    max: 15,
    desc: "시장 규모와 유동성을 반영합니다. 시가총액과 거래대금이 반영됩니다.",
    children: [
      { key: "marketCapScore", label: "시가총액", max: 7 },
      { key: "liquidityScore", label: "유동성", max: 8 },
    ],
  },
  {
    key: "change",
    label: "변화",
    max: 10,
    desc: "성장 흐름을 반영합니다. 매출, 영업이익, 순이익 성장률이 반영됩니다.",
    children: [
      { key: "revenueGrowthScore", label: "매출 성장", max: 4 },
      { key: "operatingIncomeGrowthScore", label: "영업이익 성장", max: 4 },
      { key: "netIncomeGrowthScore", label: "순이익 성장", max: 2 },
    ],
  },
];

const styles = {
  container: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "32px 24px 80px",
    color: "#0f172a",
  },
  topLinks: { marginBottom: "26px" },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "14px",
    padding: "12px 16px",
    textDecoration: "none",
    fontWeight: 800,
    border: "1px solid #dbe3f0",
    background: "#fff",
    color: "#0f172a",
  },
  pageHero: { marginBottom: "28px" },
  marketBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#4f46e5",
    fontSize: "0.82rem",
    fontWeight: 800,
    margin: "0 0 18px",
  },
  h1: {
    margin: "0 0 14px",
    fontSize: "clamp(2.2rem, 4vw, 3.4rem)",
    letterSpacing: "-0.04em",
  },
  stockCode: {
    margin: "0 0 12px",
    color: "#64748b",
    fontWeight: 700,
  },
  summaryText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.8,
    fontSize: "1.02rem",
    maxWidth: "920px",
  },
  quickSummarySection: { marginBottom: "28px" },
  quickSummaryCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "28px",
    padding: "26px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
  },
  quickSummaryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  quickSummaryTitleWrap: {},
  quickSummaryEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#4f46e5",
    fontSize: "0.82rem",
    fontWeight: 800,
    margin: "0 0 12px",
  },
  quickSummaryTitle: {
    margin: 0,
    fontSize: "1.6rem",
    letterSpacing: "-0.03em",
  },
  quickSummaryLead: {
    margin: "12px 0 0",
    color: "#334155",
    fontSize: "1.02rem",
    lineHeight: 1.8,
    fontWeight: 700,
  },
  chipRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  chipBase: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 11px",
    borderRadius: "999px",
    fontSize: "0.78rem",
    fontWeight: 800,
  },
  investSummaryCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "28px",
    padding: "28px",
    marginBottom: "28px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
  },
  investHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  investEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#ecfeff",
    color: "#0891b2",
    fontSize: "0.82rem",
    fontWeight: 800,
    margin: "0 0 14px",
  },
  investTitle: {
    margin: "0 0 10px",
    fontSize: "1.7rem",
    letterSpacing: "-0.03em",
  },
  investDesc: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.7,
    fontSize: "0.98rem",
    maxWidth: "700px",
  },
  investHero: {
    minWidth: "180px",
    padding: "18px 20px",
    borderRadius: "20px",
    background: "#0f172a",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
  },
  investHeroLabel: {
    fontSize: "0.88rem",
    fontWeight: 700,
    opacity: 0.82,
    marginBottom: "8px",
  },
  investHeroValue: {
    fontSize: "2rem",
    lineHeight: 1,
    letterSpacing: "-0.04em",
    fontWeight: 900,
  },
  investHeroSub: {
    marginTop: "6px",
    fontSize: "0.95rem",
    opacity: 0.82,
  },
  investGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "14px",
  },
  investItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
    background: "#ffffff",
  },
  investItemLabel: {
    display: "block",
    marginBottom: "8px",
    color: "#64748b",
    fontSize: "0.84rem",
    fontWeight: 700,
  },
  investItemValue: {
    margin: 0,
    color: "#0f172a",
    fontSize: "1.15rem",
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  investItemValueSky: {
    margin: 0,
    color: "#0ea5e9",
    fontSize: "1.15rem",
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  investItemValueMuted: {
    margin: 0,
    color: "#64748b",
    fontSize: "1.15rem",
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  investNote: {
    margin: "16px 0 0",
    color: "#64748b",
    fontSize: "0.92rem",
    lineHeight: 1.7,
  },
  rankingMetaSection: { marginBottom: "28px" },
  rankingMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
  },
  rankingMetaCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "24px",
    padding: "22px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
  },
  metaHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  metaTitle: {
    margin: 0,
    fontSize: "1.15rem",
    letterSpacing: "-0.02em",
  },
  metaStatsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "14px",
  },
  metaStat: {
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "12px",
    background: "#ffffff",
  },
  metaStatLabel: {
    display: "block",
    marginBottom: "8px",
    color: "#64748b",
    fontSize: "0.82rem",
    fontWeight: 700,
  },
  metaStatValue: {
    margin: 0,
    color: "#0f172a",
    fontSize: "1rem",
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  metaBadgeRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  metaBadgeBase: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 11px",
    borderRadius: "999px",
    fontSize: "0.78rem",
    fontWeight: 800,
  },
  metaDesc: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.8,
    fontSize: "0.94rem",
  },
  thesisSection: { marginBottom: "28px" },
  thesisGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
  },
  thesisCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "24px",
    padding: "22px",
    background: "#ffffff",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
  },
  thesisEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#f8fafc",
    color: "#334155",
    fontSize: "0.82rem",
    fontWeight: 800,
    margin: "0 0 12px",
  },
  thesisTitle: {
    margin: "0 0 14px",
    fontSize: "1.35rem",
    letterSpacing: "-0.03em",
  },
  bulletList: {
    margin: 0,
    paddingLeft: "20px",
    color: "#475569",
    lineHeight: 1.9,
    fontSize: "0.96rem",
  },
  scenarioSection: { marginBottom: "28px" },
  scenarioCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "28px",
    padding: "28px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
  },
  scenarioHeader: { marginBottom: "16px" },
  scenarioEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#ecfeff",
    color: "#0891b2",
    fontSize: "0.82rem",
    fontWeight: 800,
    margin: "0 0 12px",
  },
  scenarioTitle: {
    margin: "0 0 10px",
    fontSize: "1.6rem",
    letterSpacing: "-0.03em",
  },
  scenarioDesc: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.8,
  },
  scenarioGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },
  scenarioItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "18px",
    background: "#ffffff",
  },
  scenarioItemTitle: {
    margin: "0 0 10px",
    fontSize: "1.05rem",
    letterSpacing: "-0.02em",
  },
  scenarioItemText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.8,
    fontSize: "0.95rem",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "28px",
  },
  infoCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "24px",
    padding: "24px",
    background: "#ffffff",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
  },
  infoH2: {
    margin: "0 0 14px",
    fontSize: "1.6rem",
    letterSpacing: "-0.03em",
  },
  infoP: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.8,
  },
  scoreSection: {
    border: "1px solid #e5e7eb",
    borderRadius: "28px",
    padding: "28px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
  },
  scoreSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "22px",
    flexWrap: "wrap",
  },
  scoreEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#eef2ff",
    color: "#4f46e5",
    fontSize: "0.82rem",
    fontWeight: 800,
    margin: "0 0 14px",
  },
  scoreH2: {
    margin: "0 0 10px",
    fontSize: "1.7rem",
    letterSpacing: "-0.03em",
  },
  scoreDesc: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.7,
    fontSize: "0.98rem",
    maxWidth: "680px",
  },
  totalScoreHero: {
    minWidth: "180px",
    padding: "18px 20px",
    borderRadius: "20px",
    background: "#0f172a",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
  },
  totalScoreLabel: {
    fontSize: "0.88rem",
    fontWeight: 700,
    opacity: 0.82,
    marginBottom: "8px",
  },
  totalScoreStrong: {
    fontSize: "2.2rem",
    lineHeight: 1,
    letterSpacing: "-0.04em",
  },
  totalScoreMax: {
    marginTop: "6px",
    fontSize: "0.95rem",
    opacity: 0.82,
  },
  scoreGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
  },
  scoreCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "20px",
    background: "#ffffff",
  },
  scoreCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  scoreName: {
    fontSize: "1.08rem",
    fontWeight: 800,
    color: "#0f172a",
  },
  scoreValue: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "96px",
    padding: "10px 14px",
    borderRadius: "14px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontWeight: 800,
  },
  scoreMeaning: {
    margin: "0 0 14px",
    color: "#475569",
    lineHeight: 1.75,
    fontSize: "0.95rem",
  },
  scoreBreakdownList: {
    display: "grid",
    gap: "10px",
  },
  scoreBreakdownItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "12px 14px",
    borderRadius: "14px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  scoreBreakdownLabel: {
    color: "#475569",
    fontSize: "0.95rem",
    fontWeight: 700,
  },
  scoreBreakdownValue: {
    color: "#0f172a",
    fontWeight: 800,
    flexShrink: 0,
  },
};

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

function getCategoryScore(stock, key) {
  if (stock?.scoreBreakdown?.[key] !== undefined) {
    return Number(stock.scoreBreakdown[key]) || 0;
  }
  if (key === "value") return Number(stock?.valueScore ?? 0);
  if (key === "quality") return Number(stock?.qualityScore ?? 0);
  if (key === "safety") return Number(stock?.safetyScore ?? 0);
  if (key === "market") return Number(stock?.marketScore ?? 0);
  if (key === "change") return Number(stock?.changeScore ?? 0);
  return 0;
}

function getChildScore(stock, key) {
  return Number(stock?.scoreBreakdown?.[key] ?? 0);
}

function getUpsideTone(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return styles.investItemValueMuted;
  if (num > 0) return styles.investItemValueSky;
  return styles.investItemValueMuted;
}

function getRankingStatus(stock) {
  if (stock?.rankMeta?.topRankEligible) return "종합 상위 후보";
  return "종합 상위 제외";
}

function getBadgeStyle(kind) {
  const base = styles.metaBadgeBase;
  const map = {
    good: { background: "#ecfeff", color: "#0891b2" },
    warn: { background: "#fff7ed", color: "#c2410c" },
    soft: { background: "#eef2ff", color: "#4f46e5" },
    sky: { background: "#e0f2fe", color: "#0284c7" },
    muted: { background: "#f1f5f9", color: "#475569" },
    neutral: { background: "#f8fafc", color: "#64748b" },
    value: { background: "#f1f5f9", color: "#334155" },
  };
  return { ...base, ...(map[kind] || map.neutral) };
}

function buildQuickConclusion(stock) {
  const totalScore = Number(stock?.totalScore ?? 0);
  const rawTotalScore = Number(stock?.rawTotalScore ?? totalScore);
  const valueScore = Number(stock?.valueScore ?? 0);
  const upside = Number(stock?.metrics?.upside);
  const penalty = Number(stock?.rankMeta?.penalty || 0);
  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];
  const topEligible = !!stock?.rankMeta?.topRankEligible;
  const undervalueEligible = !!stock?.undervalueMeta?.eligible;

  const stance = topEligible
    ? penalty > 0
      ? "종합 관점에서는 편입 가능한 후보지만 리스크 보정이 일부 반영된 상태입니다."
      : "종합 관점에서 우선 검토 가능한 후보입니다."
    : undervalueEligible
      ? "종합 관점에서는 보수적으로 보되, 저평가 관점에서는 따로 검토할 수 있는 종목입니다."
      : "현재는 종합과 저평가 모두 보수적으로 해석할 필요가 있는 종목입니다.";

  const chips = [];
  chips.push(topEligible ? { text: "종합 상위 후보", kind: "good" } : { text: "종합 상위 제외", kind: "warn" });
  chips.push(undervalueEligible ? { text: "저평가 후보", kind: "sky" } : { text: "저평가 후보 제외", kind: "muted" });

  if (Number.isFinite(upside)) {
    if (upside >= 15) chips.push({ text: `상승여력 ${formatPercent(upside)}`, kind: "sky" });
    else chips.push({ text: `상승여력 ${formatPercent(upside)}`, kind: "neutral" });
  }

  if (penalty > 0) chips.push({ text: `패널티 ${penalty}`, kind: "muted" });

  const flagTexts = [...rankFlags, ...undervalueFlags].slice(0, 3);
  flagTexts.forEach((flag) => chips.push({ text: flag, kind: "soft" }));

  return {
    stance,
    chips,
    summary: `보정 점수 ${totalScore}점 / 원점수 ${rawTotalScore}점 / 가치 점수 ${valueScore}점`,
  };
}

function buildPositivePoints(stock) {
  const points = [];
  const valueScore = getCategoryScore(stock, "value");
  const qualityScore = getCategoryScore(stock, "quality");
  const safetyScore = getCategoryScore(stock, "safety");
  const marketScore = getCategoryScore(stock, "market");
  const changeScore = getCategoryScore(stock, "change");
  const upside = Number(stock?.metrics?.upside);

  if (valueScore >= 18) points.push(`가치 점수 ${valueScore}점으로 저평가 관점 해석이 가능한 편입니다.`);
  if (qualityScore >= 15) points.push(`품질 점수 ${qualityScore}점으로 수익성과 효율성 해석이 우호적입니다.`);
  if (safetyScore >= 12) points.push(`안정성 점수 ${safetyScore}점으로 재무 부담이 상대적으로 낮은 편입니다.`);
  if (marketScore >= 8) points.push(`시장성 점수 ${marketScore}점으로 규모·유동성 측면의 부담이 상대적으로 낮습니다.`);
  if (changeScore >= 6) points.push(`변화 점수 ${changeScore}점으로 최근 실적 흐름이 점수에 우호적으로 반영되었습니다.`);
  if (Number.isFinite(upside) && upside > 0) points.push(`적정가 추정 대비 현재 상승여력 ${formatPercent(upside)}가 남아 있습니다.`);

  if (points.length === 0) {
    points.push("일부 항목은 평균 수준이지만, 특정 요인 하나보다 종합 점수의 조합으로 해석하는 종목입니다.");
  }

  return points.slice(0, 5);
}

function buildRiskPoints(stock) {
  const points = [];
  const safetyScore = getCategoryScore(stock, "safety");
  const changeScore = getCategoryScore(stock, "change");
  const penalty = Number(stock?.rankMeta?.penalty || 0);
  const upside = Number(stock?.metrics?.upside);
  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];

  if (penalty > 0) points.push(`종합 해석에서 패널티 ${penalty}점이 반영되고 있습니다.`);
  rankFlags.forEach((flag) => points.push(`종합 해석 기준 플래그: ${flag}`));
  undervalueFlags.forEach((flag) => points.push(`저평가 해석 기준 플래그: ${flag}`));
  if (safetyScore < 8) points.push(`안정성 점수 ${safetyScore}점으로 재무 안전성 해석은 보수적으로 보는 편이 좋습니다.`);
  if (changeScore < 4) points.push(`변화 점수 ${changeScore}점으로 최근 성장 흐름의 뒷받침은 강하지 않을 수 있습니다.`);
  if (Number.isFinite(upside) && upside <= 0) points.push("현재 적정가 추정 기준으로는 즉각적인 상승여력 해석이 크지 않습니다.");

  if (points.length === 0) {
    points.push("뚜렷한 패널티나 플래그는 많지 않지만, 업황·실적·수급 변화에 따라 해석은 빠르게 바뀔 수 있습니다.");
  }

  return points.slice(0, 6);
}

function buildScenarioTexts(stock) {
  const upside = Number(stock?.metrics?.upside);
  const momentum = Number(stock?.metrics?.momentum);
  const topEligible = !!stock?.rankMeta?.topRankEligible;
  const undervalueEligible = !!stock?.undervalueMeta?.eligible;
  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];

  const positive = topEligible
    ? `현재 종합 기준을 통과한 상태를 유지하고, 다음 실적·공시에서 이익 안정성 훼손이 없으면 재평가 가능성이 이어질 수 있습니다${Number.isFinite(upside) ? ` (현재 상승여력 ${formatPercent(upside)})` : ""}.`
    : undervalueEligible
      ? `종합 관점은 보수적이지만 가치지표가 유지되고 실적 우려가 완화되면 저평가 해석에서 재주목 받을 수 있습니다${Number.isFinite(upside) ? ` (현재 상승여력 ${formatPercent(upside)})` : ""}.`
      : `당장은 보수적 해석이 맞지만, 실적·재무·수급 지표가 동시에 개선되면 종합 점수와 가치 해석이 함께 회복될 수 있습니다.`;

  const negative = rankFlags.length || undervalueFlags.length
    ? `현재 플래그(${[...rankFlags, ...undervalueFlags].slice(0, 3).join(", ")})가 실제로 심화되면 종합 해석과 저평가 해석이 동시에 약해질 수 있습니다.`
    : `실적 둔화, 재무 부담 확대, 수급 약화가 겹치면 현재 점수 체계에서 보수 보정 폭이 더 커질 수 있습니다.`;

  const checkpoint = `다음 분기 실적, 주요 공시, 시장 심리와 수급 변화${Number.isFinite(momentum) ? ` (현재 최근 흐름 ${formatPercent(momentum)})` : ""}를 함께 확인하는 것이 좋습니다. 이 페이지의 점수와 플래그 변화가 일관되게 개선되는지를 같이 보세요.`;

  return { positive, negative, checkpoint };
}

export default async function StockDetailPage({ params }) {
  const { code } = await params;
  const stock = stocks.find((item) => item.code === code);
  const summaryBlock = buildQuickConclusion(stock);
  const unifiedGrade = getUnifiedGrade(stock);

  if (!stock) {
    notFound();
  }

  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];
  const rankPenalty = Number(stock?.rankMeta?.penalty || 0);
  const rawTotalScore = stock?.rawTotalScore ?? stock?.totalScore ?? 0;
  const totalScore = stock?.totalScore ?? 0;
  const undervalueEligible = !!stock?.undervalueMeta?.eligible;
  const summaryBlock = buildQuickConclusion(stock);
  const positivePoints = buildPositivePoints(stock);
  const riskPoints = buildRiskPoints(stock);
  const scenarios = buildScenarioTexts(stock);

  return (
    <main style={styles.container}>
      <div style={styles.topLinks}>
        <Link href="/ranking" style={styles.backBtn}>
          ← 랭킹으로 돌아가기
        </Link>
      </div>

      <section style={styles.pageHero}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={styles.marketBadge}>{stock.market}</p>
            <h1 style={styles.h1}>{stock.name}</h1>
            <p style={styles.stockCode}>종목코드 {stock.code}</p>
            <p style={styles.summaryText}>{stock.summary}</p>
          </div>
          <WishlistButton code={stock.code} name={stock.name} />
        </div>
      </section>

      <section style={styles.quickSummarySection}>
        <div style={styles.quickSummaryCard}>
          <div style={styles.quickSummaryTop}>
            <div style={styles.quickSummaryTitleWrap}>
              <p style={styles.quickSummaryEyebrow}>QUICK TAKE</p>
              <h2 style={styles.quickSummaryTitle}>한눈에 보는 종목 해석</h2>
            </div>
            <div style={styles.chipRow}>
              <GradeBadge grade={unifiedGrade} />
              {summaryBlock.chips.map((chip, idx) => (
                <span key={`${chip.text}-${idx}`} style={getBadgeStyle(chip.kind)}>{chip.text}</span>
              ))}
            </div>
          </div>
          <div style={styles.quickSummaryTop}>
          <p style={styles.quickSummaryLead}>{summaryBlock.stance}</p>
          <div style={styles.chipRow}>
            <span style={getBadgeStyle("value")}>{summaryBlock.summary}</span>
          </div>
        </div>
      </section>

      <section style={styles.investSummaryCard}>
        <div style={styles.investHeader}>
          <div>
            <p style={styles.investEyebrow}>INVESTMENT VIEW</p>
            <h2 style={styles.investTitle}>투자 관점 요약</h2>
            <p style={styles.investDesc}>
              현재 가격과 적정가 추정, 상승여력, 최근 흐름을 함께 보여주는 요약 카드입니다.
              적정가 추정은 현재 재무 및 시장 데이터를 기준으로 계산한 참고 수치입니다.
            </p>
          </div>
          <div style={styles.investHero}>
            <span style={styles.investHeroLabel}>적정가 추정</span>
            <strong style={styles.investHeroValue}>{formatPrice(stock.metrics?.targetPrice)}</strong>
            <span style={styles.investHeroSub}>현재가 대비 기대 구간</span>
          </div>
        </div>

        <div style={styles.investGrid}>
          <div style={styles.investItem}>
            <span style={styles.investItemLabel}>최근 종가</span>
            <p style={styles.investItemValue}>{formatPrice(stock.metrics?.closePrice)}</p>
          </div>
          <div style={styles.investItem}>
            <span style={styles.investItemLabel}>직전 종가</span>
            <p style={styles.investItemValueMuted}>{formatPrice(stock.metrics?.prevClosePrice)}</p>
          </div>
          <div style={styles.investItem}>
            <span style={styles.investItemLabel}>상승여력</span>
            <p style={getUpsideTone(stock.metrics?.upside)}>{formatPercent(stock.metrics?.upside)}</p>
          </div>
          <div style={styles.investItem}>
            <span style={styles.investItemLabel}>최근 흐름</span>
            <p style={getUpsideTone(stock.metrics?.momentum)}>{formatPercent(stock.metrics?.momentum)}</p>
          </div>
        </div>

        <p style={styles.investNote}>
          ※ 적정가 추정과 상승여력은 참고용 정보이며, 실제 시장 가격은 업황·심리·공시·정책 변수에 따라 크게 달라질 수 있습니다.
        </p>
      </section>

      <section style={styles.rankingMetaSection}>
        <div style={styles.rankingMetaGrid}>
          <div style={styles.rankingMetaCard}>
            <div style={styles.metaHeader}>
              <h3 style={styles.metaTitle}>종합랭킹 참고</h3>
              <span style={getBadgeStyle(stock?.rankMeta?.topRankEligible ? "good" : "warn")}>
                {getRankingStatus(stock)}
              </span>
            </div>

            <div style={styles.metaStatsRow}>
              <div style={styles.metaStat}>
                <span style={styles.metaStatLabel}>보정 점수</span>
                <p style={styles.metaStatValue}>{totalScore}</p>
              </div>
              <div style={styles.metaStat}>
                <span style={styles.metaStatLabel}>원점수</span>
                <p style={styles.metaStatValue}>{rawTotalScore}</p>
              </div>
              <div style={styles.metaStat}>
                <span style={styles.metaStatLabel}>패널티</span>
                <p style={styles.metaStatValue}>{rankPenalty}</p>
              </div>
            </div>

            <div style={styles.metaBadgeRow}>
              {rankFlags.length > 0 ? (
                rankFlags.map((flag) => (
                  <span key={flag} style={getBadgeStyle("soft")}>
                    {flag}
                  </span>
                ))
              ) : (
                <span style={getBadgeStyle("neutral")}>특이 플래그 없음</span>
              )}
            </div>

            <p style={styles.metaDesc}>
              종합랭킹은 저평가 수치만이 아니라 재무 안정성과 이익 상태를 함께 반영합니다.
              따라서 원점수가 높아도 부채비율·자본 상태·이익 안정성 조건에 따라 실제 종합 반영 점수는 조정될 수 있습니다.
            </p>
          </div>

          <div style={styles.rankingMetaCard}>
            <div style={styles.metaHeader}>
              <h3 style={styles.metaTitle}>저평가 관점 참고</h3>
              <span style={getBadgeStyle("value")}>
                가치 점수 {stock?.valueScore ?? 0}점
              </span>
            </div>

            <div style={styles.metaBadgeRow}>
              {undervalueEligible ? (
                <span style={getBadgeStyle("sky")}>저평가 후보</span>
              ) : (
                <span style={getBadgeStyle("muted")}>저평가 후보 제외</span>
              )}

              {undervalueFlags.length > 0 ? (
                undervalueFlags.map((flag) => (
                  <span key={flag} style={getBadgeStyle("soft")}>
                    {flag}
                  </span>
                ))
              ) : (
                <span style={getBadgeStyle("neutral")}>특이 플래그 없음</span>
              )}
            </div>

            <p style={styles.metaDesc}>
              저평가 관점은 PER·PBR 등 가치지표를 중심으로 보는 해석입니다.
              따라서 종합랭킹에서는 불리한 종목도, 저평가 랭킹에서는 별도 후보로 해석될 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <section style={styles.thesisSection}>
        <div style={styles.thesisGrid}>
          <div style={styles.thesisCard}>
            <p style={styles.thesisEyebrow}>WHY INCLUDED</p>
            <h2 style={styles.thesisTitle}>왜 추천/검토 대상인가</h2>
            <ul style={styles.bulletList}>
              {positivePoints.map((point, index) => (
                <li key={`positive-${index}`}>{point}</li>
              ))}
            </ul>
          </div>

          <div style={styles.thesisCard}>
            <p style={styles.thesisEyebrow}>WHY CAUTION</p>
            <h2 style={styles.thesisTitle}>왜 제외/주의 해석이 가능한가</h2>
            <ul style={styles.bulletList}>
              {riskPoints.map((point, index) => (
                <li key={`risk-${index}`}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section style={styles.scenarioSection}>
        <div style={styles.scenarioCard}>
          <div style={styles.scenarioHeader}>
            <p style={styles.scenarioEyebrow}>SCENARIO VIEW</p>
            <h2 style={styles.scenarioTitle}>시나리오 해석</h2>
            <p style={styles.scenarioDesc}>
              확정 수익을 의미하는 것이 아니라, 현재 점수와 플래그를 바탕으로 어떤 조건에서 재평가가 가능하고 어떤 경우 보수적으로 봐야 하는지를 정리한 참고 시나리오입니다.
            </p>
          </div>

          <div style={styles.scenarioGrid}>
            <div style={styles.scenarioItem}>
              <h3 style={styles.scenarioItemTitle}>긍정 시나리오</h3>
              <p style={styles.scenarioItemText}>{scenarios.positive}</p>
            </div>
            <div style={styles.scenarioItem}>
              <h3 style={styles.scenarioItemTitle}>부정 시나리오</h3>
              <p style={styles.scenarioItemText}>{scenarios.negative}</p>
            </div>
            <div style={styles.scenarioItem}>
              <h3 style={styles.scenarioItemTitle}>체크 타이밍</h3>
              <p style={styles.scenarioItemText}>{scenarios.checkpoint}</p>
            </div>
          </div>
        </div>
      </section>

      <div style={styles.infoGrid}>
        <section style={styles.infoCard}>
          <h2 style={styles.infoH2}>상세 설명</h2>
          <p style={styles.infoP}>{stock.description}</p>
        </section>
        <section style={styles.infoCard}>
          <h2 style={styles.infoH2}>리스크 체크</h2>
          <p style={styles.infoP}>{stock.risk}</p>
        </section>
      </div>

      <section style={styles.scoreSection}>
        <div style={styles.scoreSectionHeader}>
          <div>
            <p style={styles.scoreEyebrow}>SCORE SYSTEM</p>
            <h2 style={styles.scoreH2}>점수 구성</h2>
            <p style={styles.scoreDesc}>
              총점은 100점 만점이며, 가치·품질·안정성·시장성·변화 5개 축으로 계산됩니다.
            </p>
          </div>
          <div style={styles.totalScoreHero}>
            <span style={styles.totalScoreLabel}>총점</span>
            <strong style={styles.totalScoreStrong}>{stock.totalScore}</strong>
            <span style={styles.totalScoreMax}>/ 100점</span>
          </div>
        </div>

        <div style={styles.scoreGrid}>
          {SCORE_META.map((item) => (
            <div style={styles.scoreCard} key={item.key}>
              <div style={styles.scoreCardTop}>
                <span style={styles.scoreName}>{item.label}</span>
                <span style={styles.scoreValue}>
                  {getCategoryScore(stock, item.key)} / {item.max}
                </span>
              </div>
              <p style={styles.scoreMeaning}>{item.desc}</p>
              <div style={styles.scoreBreakdownList}>
                {item.children.map((child) => (
                  <div style={styles.scoreBreakdownItem} key={child.key}>
                    <span style={styles.scoreBreakdownLabel}>{child.label}</span>
                    <span style={styles.scoreBreakdownValue}>
                      {getChildScore(stock, child.key)} / {child.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
