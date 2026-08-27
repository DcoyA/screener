// 확장자 명시(.js): 이 모듈은 Next 번들러뿐 아니라 CI 회귀 검사
// (scripts/test/check-upside-display.mjs)가 순수 Node ESM으로도 import한다.
import { formatUpsideDisplay, formatUpsideReasonPart } from "./formatUpside.js";
import { isFairValueOk } from "./fairValue.js";
import { formatDelta, formatRatio } from "./formatNumber.js";

function formatPrice(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
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

const MIN_STRATEGY_SCORE = 40;
const MIN_STRATEGY_LIQUIDITY = 10_0000_0000; // 10억원 (buildAvoidSummary의 저유동성 기준과 동일)
// 문서 스펙은 "최근 20일 수익률"이지만, 파이프라인이 실제로 계산해 저장하는
// 값은 5일 수익률(metrics.priceChangeRate)뿐이다(20일치 가격 히스토리 자체가
// 수집되지 않음). 20일 지표를 새로 만드는 건 이번 수정 범위를 넘어서므로,
// 있는 유일한 모멘텀 지표(5일)에 문서와 동일한 임계값을 적용한다.
const SHORT_TERM_MOMENTUM_WARN_PCT = 25;
const SHORT_TERM_MOMENTUM_EXCLUDE_PCT = 50;

// 전 슬롯 공통 하드 필터. 초보자 대상 화면에 부적격 종목이 올라가는 걸 막는
// 최소 안전장치라 정렬 로직보다 먼저 적용한다.
function passesHardFilter(stock) {
  const score = Number(stock?.totalScore ?? 0);
  if (score < MIN_STRATEGY_SCORE) return false;

  // fairValue 결측/이상치(status !== 'ok')면 상승여력 기반 슬롯에서 제외한다.
  // 예전엔 targetPrice > 0 만 봤는데, 구 fallback으로 targetPrice에 현재가가
  // 들어간 종목은 이 조건을 통과해버려 실효가 없었다.
  if (!isFairValueOk(stock)) return false;

  const liquidity = Number(stock?.metrics?.avgTradeValue5d ?? 0);
  if (liquidity < MIN_STRATEGY_LIQUIDITY) return false;

  return true;
}

// "단기" 슬롯 전용 추가 필터. 최근 영업손실(연간 수치 - 분기 합산 데이터는
// 파이프라인에 없음) 종목과, 이미 단기간에 과도하게 오른 종목을 제외한다.
function passesShortTermFilter(stock) {
  const operatingIncome = Number(stock?.metrics?.operatingIncome ?? 0);
  if (operatingIncome < 0) return false;

  const momentum = Number(stock?.metrics?.priceChangeRate ?? 0);
  if (momentum > SHORT_TERM_MOMENTUM_EXCLUDE_PCT) return false;

  return true;
}

function needsMomentumWarning(stock) {
  const momentum = Number(stock?.metrics?.priceChangeRate ?? 0);
  return momentum > SHORT_TERM_MOMENTUM_WARN_PCT;
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
      Number.isFinite(Number(stock?.metrics?.priceChangeRate)) ? `최근 흐름 ${formatDelta(stock?.metrics?.priceChangeRate)}` : null,
      formatUpsideReasonPart(stock),
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
      Number.isFinite(Number(stock?.metrics?.operatingIncomeGrowth)) ? `영업이익 성장 ${formatDelta(stock?.metrics?.operatingIncomeGrowth)}` : null,
      Number.isFinite(Number(stock?.metrics?.revenueGrowth)) ? `매출 성장 ${formatDelta(stock?.metrics?.revenueGrowth)}` : null,
    ],
    "연간 보유 관점에서 무난하게 가져갈 수 있는 후보입니다."
  );
}

function buildLongReason(stock) {
  return buildReasonLine(
    [
      Number(stock?.valueScore ?? 0) ? `가치 점수 ${Number(stock.valueScore).toFixed(0)}점` : null,
      Number.isFinite(Number(stock?.metrics?.debtRatio)) ? `부채비율 ${formatRatio(stock?.metrics?.debtRatio)}` : null,
      Number.isFinite(Number(stock?.metrics?.roe)) ? `ROE ${formatRatio(stock?.metrics?.roe)}` : null,
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
      href: "/screener?tab=ranking&risk=highDebt",
    },
    {
      label: "저유동성",
      count: weakLiquidity,
      desc: "점수 대비 실제 거래가 약한 타입",
      href: "/screener?tab=ranking&risk=lowLiquidity",
    },
    {
      label: "이익 불안정",
      count: unstable,
      desc: "영업이익/순이익 흐름이 약한 타입",
      href: "/screener?tab=ranking&risk=unstableEarnings",
    },
  ];
}

// 슬롯 간 중복 배제. 우선순위 장기 → 연간 → 단기로 순차 선정하고, 이미 다른
// 슬롯에 뽑힌 종목은 다음 슬롯 후보 풀에서 제외한다.
export function buildStrategyCards(items) {
  const eligible = items.filter(passesHardFilter);

  const longTerm = sortForLongTerm(eligible)[0] || null;
  const usedCodes = new Set([longTerm?.code].filter(Boolean));

  const annualPool = eligible.filter((item) => !usedCodes.has(item.code));
  const annual = sortForAnnual(annualPool)[0] || null;
  if (annual) usedCodes.add(annual.code);

  const shortPool = eligible.filter((item) => !usedCodes.has(item.code) && passesShortTermFilter(item));
  const shortTerm = sortForShortTerm(shortPool)[0] || null;

  return [
    {
      key: "short",
      badge: "1주~1개월",
      title: "최근 거래가 몰린 종목",
      desc: "최근 흐름, 거래대금, 상승여력을 같이 봐서 지금 당장 반응 가능한 쪽을 고릅니다.",
      stock: shortTerm,
      reason: shortTerm ? buildShortReason(shortTerm) : "단기 관점 후보가 아직 부족합니다.",
      momentumWarning: shortTerm ? needsMomentumWarning(shortTerm) : false,
      actionLabel: "단기 흐름 더 보기",
      actionHref: "/screener?tab=ranking&view=short",
    },
    {
      key: "annual",
      badge: "6개월~1년",
      title: "올해 안에 다시 볼 종목",
      desc: "종합 점수, 실적 안정성, 성장 흐름을 묶어서 올해 안에 다시 볼 만한 종목을 고릅니다.",
      stock: annual,
      reason: annual ? buildAnnualReason(annual) : "연간 관점 후보가 아직 부족합니다.",
      actionLabel: "연간 투자 더 보기",
      actionHref: "/screener?tab=ranking&view=annual",
    },
    {
      key: "long",
      badge: "1년 이상",
      title: "구조를 보고 담을 종목",
      desc: "저평가와 재무 안정성 기준으로, 당장보다 구조를 보고 들고 갈 만한 종목을 고릅니다.",
      stock: longTerm,
      reason: longTerm ? buildLongReason(longTerm) : "장기 관점 후보가 아직 부족합니다.",
      actionLabel: "장기 투자 더 보기",
      actionHref: "/screener?tab=ranking&view=long",
    },
  ];
}

export {
  formatPrice,
  formatKrwCompact,
  getUpsideClass,
  formatUpsideDisplay,
  formatTargetPriceBand,
};
