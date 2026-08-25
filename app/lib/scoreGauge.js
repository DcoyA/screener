// 70점 이상: 초록 / 40~69점: 주황 / 40 미만: 빨강 (app/globals.css의 --color-score-* 토큰과 짝을 이룸)
export function getScoreGaugeColor(score) {
  const num = Number(score ?? 0);
  if (num >= 70) return "var(--color-score-good)";
  if (num >= 40) return "var(--color-score-mid)";
  return "var(--color-score-bad)";
}
