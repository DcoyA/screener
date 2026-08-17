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

export function fomoLabelFromScore(score) {
  if (score >= 70) return "위험";
  if (score >= 40) return "주의";
  return "낮음";
}
