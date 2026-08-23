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

function formatKrwCompact(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  if (num >= 1_0000_0000_0000) return `${(num / 1_0000_0000_0000).toFixed(1)}조원`;
  if (num >= 1_0000_0000) return `${(num / 1_0000_0000).toFixed(0)}억원`;
  return `${num.toLocaleString("ko-KR")}원`;
}

function getUpsideClass(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "upsideLine";
  if (num > 0) return "upsideLine upsidePositive";
  if (num < 0) return "upsideLine upsideNegative";
  return "upsideLine upsideNeutral";
}

// 상승여력 표시값(fair-value v2): 캡 초과 시 라벨, 아니면 캡 적용값(옛 데이터는 원본).
function formatUpsideDisplay(stock) {
  const label = stock?.display?.upsideLabel;
  if (label) return label;
  const capped = stock?.display?.upsideCapped;
  return formatPercent(capped ?? stock?.metrics?.upside);
}

// 적정가는 단일값이 아니라 보수~낙관 밴드로 표시한다.
function formatTargetPriceBand(stock) {
  const lo = Number(stock?.metrics?.targetPriceConservative);
  const hi = Number(stock?.metrics?.targetPriceOptimistic);
  if (Number.isFinite(lo) && Number.isFinite(hi) && lo > 0 && hi > 0) {
    if (lo === hi) return formatPrice(lo);
    return `${formatPrice(lo)}~${formatPrice(hi)}`;
  }
  return formatPrice(stock?.metrics?.targetPrice);
}

function sortForShortTerm(items) {
  return [...items].sort((a, b) => {
    const aMomentum = Number(a?.metrics?.priceChangeRate ?? a?.metrics?.momentum ?? 0);
    const bMomentum = Number(b?.metrics?.priceChangeRate ?? b?.metrics?.momentum ?? 0);
    if (bMomentum !== aMomentum) return bMomentum - aMomentum;
    const aUpside = Number(a?.metrics?.upside ?? -999999);
    const bUpside = Number(b?.metrics?.upside ?? -999999);
    if (bUpside !== aUpside) return bUpside - aUpside;
    const aLiquidity = Number(a?.metrics?.avgTradeValue5d ?? 0);
    const bLiquidity = Number(b?.metrics?.avgTradeValue5d ?? 0);
    return bLiquidity - aLiquidity;
  });
}

function sortForAnnual(items) {
  return [...items].sort((a, b) => {
    const aEligible = a?.rankMeta?.topRankEligible ? 1 : 0;
    const bEligible = b?.rankMeta?.topRankEligible ? 1 : 0;
    if (bEligible !== aEligible) return bEligible - aEligible;
    const aScore = Number(a?.totalScore ?? 0);
    const bScore = Number(b?.totalScore ?? 0);
    if (bScore !== aScore) return bScore - aScore;
    const aGrowth = Number(a?.metrics?.operatingIncomeGrowth ?? 0) + Number(a?.metrics?.revenueGrowth ?? 0);
    const bGrowth = Number(b?.metrics?.operatingIncomeGrowth ?? 0) + Number(b?.metrics?.revenueGrowth ?? 0);
    if (bGrowth !== aGrowth) return bGrowth - aGrowth;
    const aLiquidity = Number(a?.metrics?.avgTradeValue5d ?? 0);
    const bLiquidity = Number(b?.metrics?.avgTradeValue5d ?? 0);
    return bLiquidity - aLiquidity;
  });
}

function sortForLongTerm(items) {
  return [...items]
    .filter((item) => item?.undervalueMeta?.eligible)
    .sort((a, b) => {
      const aValue = Number(a?.valueScore ?? 0);
      const bValue = Number(b?.valueScore ?? 0);
      if (bValue !== aValue) return bValue - aValue;
      const aDebt = Number(a?.metrics?.debtRatio ?? 999999);
      const bDebt = Number(b?.metrics?.debtRatio ?? 999999);
      if (aDebt !== bDebt) return aDebt - bDebt;
      const aRoe = Number(a?.metrics?.roe ?? -999999);
      const bRoe = Number(b?.metrics?.roe ?? -999999);
      return bRoe - aRoe;
    });
}

function buildReasonLine(parts, fallback) {
  const output = parts.filter(Boolean);
  return output.length ? output.join(" · ") : fallback;
}

function buildShortReason(stock) {
  return buildReasonLine(
    [
      Number.isFinite(Number(stock?.metrics?.priceChangeRate)) ? `최근 흐름 ${formatPercent(stock?.metrics?.priceChangeRate)}` : null,
      Number.isFinite(Number(stock?.metrics?.upside)) ? `상승여력 ${formatPercent(stock?.metrics?.upside)}` : null,
      stock?.metrics?.avgTradeValue5d ? `유동성 ${formatKrwCompact(stock?.metrics?.avgTradeValue5d)}` : null,
      (stock?.rankMeta?.flags || [])[0] || null,
    ],
    "단기 흐름과 거래가 붙는지 중심으로 다시 보는 후보입니다."
  );
}

function buildAnnualReason(stock) {
  return buildReasonLine(
    [
      stock?.rankMeta?.topRankEligible ? "안정성 조건 통과" : null,
      Number(stock?.totalScore ?? 0) ? `총점 ${Number(stock.totalScore).toFixed(0)}점` : null,
      Number.isFinite(Number(stock?.metrics?.operatingIncomeGrowth)) ? `영업이익 성장 ${formatPercent(stock?.metrics?.operatingIncomeGrowth)}` : null,
      Number.isFinite(Number(stock?.metrics?.revenueGrowth)) ? `매출 성장 ${formatPercent(stock?.metrics?.revenueGrowth)}` : null,
    ],
    "연간 보유 관점에서 무난하게 가져갈 수 있는 후보입니다."
  );
}

function buildLongReason(stock) {
  return buildReasonLine(
    [
      Number(stock?.valueScore ?? 0) ? `가치 점수 ${Number(stock.valueScore).toFixed(0)}점` : null,
      Number.isFinite(Number(stock?.metrics?.debtRatio)) ? `부채비율 ${formatPercent(stock?.metrics?.debtRatio)}` : null,
      Number.isFinite(Number(stock?.metrics?.roe)) ? `ROE ${formatPercent(stock?.metrics?.roe)}` : null,
      Number.isFinite(Number(stock?.metrics?.pbr)) ? `PBR ${Number(stock.metrics.pbr).toFixed(2)}배` : null,
    ],
    "장기 보유 관점에서 가격보다 구조를 먼저 보는 후보입니다."
  );
}

export function buildAvoidSummary(items) {
  const highDebt = items.filter((item) => Number(item?.metrics?.debtRatio ?? 0) >= 200).length;
  const weakLiquidity = items.filter((item) => Number(item?.metrics?.avgTradeValue5d ?? 0) < 10_0000_0000).length;
  const unstable = items.filter(
    (item) => Number(item?.metrics?.operatingIncome ?? 0) <= 0 || Number(item?.metrics?.netIncome ?? 0) <= 0
  ).length;

  return [
    {
      label: "고부채",
      count: highDebt,
      desc: "저평가처럼 보여도 재무가 불안한 타입",
      href: "/search?tab=ranking&risk=highDebt",
    },
    {
      label: "저유동성",
      count: weakLiquidity,
      desc: "점수 대비 실제 거래가 약한 타입",
      href: "/search?tab=ranking&risk=lowLiquidity",
    },
    {
      label: "이익 불안정",
      count: unstable,
      desc: "영업이익/순이익 흐름이 약한 타입",
      href: "/search?tab=ranking&risk=unstableEarnings",
    },
  ];
}

export function buildStrategyCards(items) {
  const shortTerm = sortForShortTerm(items)[0] || null;
  const annual = sortForAnnual(items)[0] || null;
  const longTerm = sortForLongTerm(items)[0] || null;

  return [
    {
      key: "short",
      badge: "1주~1개월",
      title: "단기 투자에 좋은 후보",
      desc: "최근 흐름, 거래대금, 상승여력을 같이 봐서 지금 당장 반응 가능한 쪽을 고릅니다.",
      stock: shortTerm,
      reason: shortTerm ? buildShortReason(shortTerm) : "단기 관점 후보가 아직 부족합니다.",
      actionLabel: "단기 흐름 더 보기",
      actionHref: "/search?tab=ranking&view=short",
    },
    {
      key: "annual",
      badge: "6개월~1년",
      title: "연간 투자에 좋은 후보",
      desc: "종합 점수, 실적 안정성, 성장 흐름을 묶어서 올해 안에 다시 볼 만한 종목을 고릅니다.",
      stock: annual,
      reason: annual ? buildAnnualReason(annual) : "연간 관점 후보가 아직 부족합니다.",
      actionLabel: "연간 투자 더 보기",
      actionHref: "/search?tab=ranking&view=annual",
    },
    {
      key: "long",
      badge: "1년 이상",
      title: "장기 투자에 좋은 후보",
      desc: "저평가와 재무 안정성 기준으로, 당장보다 구조를 보고 들고 갈 만한 종목을 고릅니다.",
      stock: longTerm,
      reason: longTerm ? buildLongReason(longTerm) : "장기 관점 후보가 아직 부족합니다.",
      actionLabel: "장기 투자 더 보기",
      actionHref: "/search?tab=ranking&view=long",
    },
  ];
}

export {
  formatPrice,
  formatPercent,
  formatKrwCompact,
  getUpsideClass,
  formatUpsideDisplay,
  formatTargetPriceBand,
};
