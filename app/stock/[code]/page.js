import Link from "next/link";
import { notFound } from "next/navigation";
import stocks from "../../data/stocks.json";

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

function getCategoryScore(stock, key) {
  if (stock?.scoreBreakdown?.[key] !== undefined) {
    return stock.scoreBreakdown[key];
  }
  if (key === "value") return stock?.valueScore ?? 0;
  if (key === "quality") return stock?.qualityScore ?? 0;
  if (key === "safety") return stock?.safetyScore ?? 0;
  if (key === "market") return stock?.marketScore ?? 0;
  if (key === "change") return stock?.changeScore ?? 0;
  return 0;
}

function getChildScore(stock, key) {
  return stock?.scoreBreakdown?.[key] ?? 0;
}

export default async function StockDetailPage({ params }) {
  const { code } = await params;
  const stock = stocks.find((item) => item.code === code);

  if (!stock) {
    notFound();
  }

  return (
    <main style={styles.container}>
      <div style={styles.topLinks}>
        <Link href="/ranking" style={styles.backBtn}>
          ← 랭킹으로 돌아가기
        </Link>
      </div>

      <section style={styles.pageHero}>
        <div>
          <p style={styles.marketBadge}>{stock.market}</p>
          <h1 style={styles.h1}>{stock.name}</h1>
          <p style={styles.stockCode}>종목코드 {stock.code}</p>
          <p style={styles.summaryText}>{stock.summary}</p>
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
