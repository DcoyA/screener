export function getSignalLevel(score, max) {
  const numericScore = Number(score || 0);
  const numericMax = Number(max || 0);
  const ratio = numericMax > 0 ? numericScore / numericMax : 0;

  if (ratio >= 0.7) {
    return { level: "good", label: "좋음", color: "#0f766e", bg: "#ccfbf1" };
  }
  if (ratio >= 0.4) {
    return { level: "neutral", label: "보통", color: "#b45309", bg: "#fff7ed" };
  }
  return { level: "caution", label: "주의", color: "#be123c", bg: "#ffe4e6" };
}

export function formatScoreRatio(score, max) {
  return `${Number(score || 0)} / ${Number(max || 0)}`;
}
