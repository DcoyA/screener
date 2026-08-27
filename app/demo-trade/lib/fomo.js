export function calculateFomoScore({ reason, stopLossPrice, targetPrice, holdingDays, totalOrderAmount }) {
  let score = 0;
  const text = String(reason || "").toLowerCase();

  if (text.includes("급등") || text.includes("막차") || text.includes("놓칠") || text.includes("fomo")) score += 28;
  if (text.includes("뉴스") || text.includes("호재") || text.includes("상한가")) score += 15;
  if (!stopLossPrice) score += 20;
  if (!targetPrice) score += 10;
  if (Number(holdingDays) <= 3) score += 15;
  if (totalOrderAmount >= 1000000) score += 12;

  return Math.min(score, 100);
}

// 화면에 구간 기준을 그대로 노출한다(점수만 보고 "왜 낮음?"이 안 되게).
export const FOMO_BANDS = [
  { max: 39, label: "낮음" },
  { max: 69, label: "주의" },
  { max: 100, label: "위험" },
];
export const FOMO_BAND_TEXT = "0–39 낮음 · 40–69 주의 · 70+ 위험";

export function fomoLabelFromScore(score) {
  if (score >= 70) return "위험";
  if (score >= 40) return "주의";
  return "낮음";
}
