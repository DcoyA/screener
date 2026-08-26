// app/lib/grade.js

export const GRADE_ORDER = ["S", "A", "B", "C", "D"];

export const GRADE_META = {
  S: { label: "지금 봐도 됨", color: "#0f766e", bg: "#ccfbf1" },
  A: { label: "좀 더 확인하고", color: "#b45309", bg: "#fff7ed" },
  B: { label: "아직은 지켜보기", color: "#2563eb", bg: "#dbeafe" },
  C: { label: "조심해야 함", color: "#ea580c", bg: "#ffedd5" },
  D: { label: "지금은 아님", color: "#be123c", bg: "#ffe4e6" },
};

// 등급은 원칙적으로 scripts/update_data.py가 전체 종목 분포를 놓고
// 백분위(S 상위7% / A 상위25% / B 상위65% / C 나머지, EXCLUDED는 항상 D)로
// 미리 계산해서 stock.unifiedGradeCode / stock.unifiedGradeDowngraded로
// stocks.json(그리고 그걸 그대로 옮겨 담는 Supabase raw_data/컬럼)에 저장해
// 둔다. 종목 하나만 놓고는 전체 분포(백분위 기준)를 알 수 없으므로, 화면
// 렌더링 시점에 이 값을 다시 계산하지 않고 그대로 신뢰해서 쓴다.
function legacyGradeFromFinalScore(finalScore) {
  const score = Number(finalScore);
  if (!Number.isFinite(score)) return "A";
  if (score >= 75) return "S";
  if (score >= 62) return "A";
  if (score >= 46) return "B";
  return "C";
}

// 레거시 폴백: unifiedGradeCode가 아직 없는 오래된 데이터(예: v2 파이프라인
// 이전에 적재된 Supabase 스냅샷)를 위한 절대 점수 기준 근사치. 새 데이터에는
// 쓰이지 않는다 — population 백분위가 아니라 개별 종목 점수만으로 만든
// 근사치라는 걸 명심할 것.
function legacyNormalizeDecisionToGrade(rawDecision, finalScore) {
  const value = String(rawDecision || "").trim().toUpperCase();
  if (value === "EXCLUDED" || value === "EXCLUDE" || rawDecision === "제외") return "D";
  if (value === "INCLUDED" || value === "INCLUDE") return legacyGradeFromFinalScore(finalScore);
  if (value === "BUY" || value === "BUY_CANDIDATE" || rawDecision === "매수 후보") return "S";
  if (value === "WATCH" || rawDecision === "관찰") return "A";
  if (value === "WAIT" || value === "WAIT_FOR_PULLBACK" || rawDecision === "대기") return "B";
  if (value === "RISKY" || rawDecision === "주의") return "C";
  return legacyGradeFromFinalScore(finalScore);
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

  // 종목별 종합판단점수를 문구 앞에 붙인다 — 같은 등급 구간(S/A/B/C/D) 안에
  // 묶여도 종목마다 실제 점수는 다르므로, 라벨만 보고 "다 똑같은 종목"으로
  // 오해하지 않도록 하기 위함이다. finalPickMeta.finalScore가 없으면
  // totalScore로 대체한다.
  const rawScore = stock?.finalPickMeta?.finalScore ?? stock?.totalScore;
  const scoreNum = Number(rawScore);
  const scorePrefix = Number.isFinite(scoreNum) ? `종합판단점수 ${Math.round(scoreNum)}점 · ` : "";

  if (gradeCode === "S") {
    return (
      scorePrefix +
      (financeGood
        ? "재무와 밸류 모두 우량해 우선 검토 가능한 후보입니다."
        : "종합 점수와 리스크가 모두 양호해 우선 검토 가능한 후보입니다.")
    );
  }
  if (gradeCode === "A") {
    return scorePrefix + "기본 체력은 양호하지만 매수 전 뉴스·차트 확인이 필요한 후보입니다.";
  }
  if (gradeCode === "B") {
    return scorePrefix + "가격·타이밍 측면에서 조금 더 지켜볼 필요가 있는 후보입니다.";
  }
  if (gradeCode === "C") {
    if (financeGood && firstReason) {
      return `${scorePrefix}재무는 우량하지만 ${firstReason} 신중한 접근이 필요합니다.`;
    }
    return scorePrefix + (firstReason ? `${firstReason} 신중한 접근이 필요합니다.` : "신중한 접근이 필요한 종목입니다.");
  }
  return (
    scorePrefix +
    (firstReason
      ? `${firstReason} 현재 기준으로는 매수 후보로 보기 어렵습니다.`
      : "현재 기준으로는 매수 후보로 보기 어려운 종목입니다.")
  );
}

export function getUnifiedGrade(stock) {
  if (!stock) {
    return { code: "A", ...GRADE_META.A, description: "데이터가 없어 기본 등급으로 표시합니다.", downgraded: false, hasFinalPickMeta: false };
  }

  let gradeCode;
  let downgraded;

  if (typeof stock.unifiedGradeCode === "string" && GRADE_ORDER.includes(stock.unifiedGradeCode)) {
    // update_data.py(또는 그 값을 그대로 옮겨 실은 Supabase 스냅샷)에서 이미
    // 백분위 기준으로 계산되고 고위험 강등까지 반영된 최종 등급 — 그대로 신뢰한다.
    gradeCode = stock.unifiedGradeCode;
    downgraded = !!stock.unifiedGradeDowngraded;
  } else {
    // 레거시 폴백 (unifiedGradeCode가 없는 옛 데이터)
    const rawDecision = stock?.finalPickMeta?.decision;
    const finalScore = stock?.finalPickMeta?.finalScore ?? stock?.totalScore;
    gradeCode = legacyNormalizeDecisionToGrade(rawDecision, finalScore);
    downgraded = isHighRisk(stock) && gradeCode !== "D";
    if (downgraded) gradeCode = downgrade(gradeCode);
  }

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
