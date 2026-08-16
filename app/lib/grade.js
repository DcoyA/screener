// app/lib/grade.js

export const GRADE_ORDER = ["S", "A", "B", "C", "D"];

export const GRADE_META = {
  S: { label: "우량 후보", color: "#0f766e", bg: "#ccfbf1" },
  A: { label: "관심 후보", color: "#b45309", bg: "#fff7ed" },
  B: { label: "중립·관망", color: "#2563eb", bg: "#dbeafe" },
  C: { label: "신중 필요", color: "#ea580c", bg: "#ffedd5" },
  D: { label: "제외 권장", color: "#be123c", bg: "#ffe4e6" },
};

function normalizeDecisionToGrade(rawDecision) {
  const value = String(rawDecision || "").trim().toUpperCase();
  if (value === "BUY" || value === "BUY_CANDIDATE" || rawDecision === "매수 후보") return "S";
  if (value === "WATCH" || rawDecision === "관찰") return "A";
  if (value === "WAIT" || value === "WAIT_FOR_PULLBACK" || rawDecision === "대기") return "B";
  if (value === "RISKY" || rawDecision === "주의") return "C";
  if (value === "EXCLUDED" || value === "EXCLUDE" || rawDecision === "제외") return "D";
  return "A";
}

function isHighRisk(stock) {
  const level = stock?.riskMeta?.level;
  return level === "높음" || level === "주의";
}

function downgrade(gradeCode) {
  const idx = GRADE_ORDER.indexOf(gradeCode);
  if (idx === -1) return gradeCode;
  return GRADE_ORDER[Math.min(idx + 1, GRADE_ORDER.length - 1)];
}

function buildDescription(stock, gradeCode) {
  const reasons = Array.isArray(stock?.finalPickMeta?.reasons) ? stock.finalPickMeta.reasons : [];
  const firstReason = (reasons[0] || "").replace(/\.$/, "");
  const financeScore =
    Number(stock?.valueScore || 0) + Number(stock?.qualityScore || 0) + Number(stock?.safetyScore || 0);
  const financeGood = financeScore >= 45;

  if (gradeCode === "S") {
    return financeGood
      ? "재무와 밸류 모두 우량해 우선 검토 가능한 후보입니다."
      : "종합 점수와 리스크가 모두 양호해 우선 검토 가능한 후보입니다.";
  }
  if (gradeCode === "A") {
    return "기본 체력은 양호하지만 매수 전 뉴스·차트 확인이 필요한 후보입니다.";
  }
  if (gradeCode === "B") {
    return "가격·타이밍 측면에서 조금 더 지켜볼 필요가 있는 후보입니다.";
  }
  if (gradeCode === "C") {
    if (financeGood && firstReason) {
      return `재무는 우량하지만 ${firstReason} 신중한 접근이 필요합니다.`;
    }
    return firstReason ? `${firstReason} 신중한 접근이 필요합니다.` : "신중한 접근이 필요한 종목입니다.";
  }
  return firstReason
    ? `${firstReason} 현재 기준으로는 매수 후보로 보기 어렵습니다.`
    : "현재 기준으로는 매수 후보로 보기 어려운 종목입니다.";
}

export function getUnifiedGrade(stock) {
  if (!stock) {
    return { code: "A", ...GRADE_META.A, description: "데이터가 없어 기본 등급으로 표시합니다.", downgraded: false, hasFinalPickMeta: false };
  }

  const rawDecision = stock?.finalPickMeta?.decision;
  let gradeCode = normalizeDecisionToGrade(rawDecision);

  const downgraded = isHighRisk(stock) && gradeCode !== "D";
  if (downgraded) gradeCode = downgrade(gradeCode);

  const meta = GRADE_META[gradeCode];
  return {
    code: gradeCode,
    label: meta.label,
    color: meta.color,
    bg: meta.bg,
    description: buildDescription(stock, gradeCode),
    downgraded,
    hasFinalPickMeta: !!stock?.finalPickMeta,
  };
}
