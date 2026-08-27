// 스크리너 카드의 "왜 이 리스트에 있나"(buildOneLineReason) / "무엇을 조심해야
// 하나"(buildWarningLine) 문구 빌더. 예전엔 RankingTab.js("use client") 안에
// module-scope 함수로 있어서 Node 회귀 테스트에서 import할 수 없었다. 순수
// 함수라(입력: stock + 뷰/리스크) 여기로 빼고, RankingTab과 테스트가 같이 쓴다.
//
// 상승여력은 formatUpsideReasonPart(= formatUpsideDisplay 경유)로만 만든다.
// 비율(부채비율/ROE)은 formatRatio(무부호), 증감(성장률/최근 흐름)은 formatDelta.

// 확장자 명시(.js): Next 번들러 + CI 회귀 검사(순수 Node ESM) 양쪽에서 import된다.
import { formatDelta, formatRatio } from "./formatNumber.js";
import { formatUpsideReasonPart } from "./formatUpside.js";

function formatKrwCompact(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  if (num >= 1_0000_0000_0000) return `${(num / 1_0000_0000_0000).toFixed(1)}조원`;
  if (num >= 1_0000_0000) return `${(num / 1_0000_0000).toFixed(0)}억원`;
  return `${num.toLocaleString("ko-KR")}원`;
}

export function buildOneLineReason(stock, activeView) {
  const parts = [];
  const valueScore = Number(stock?.valueScore ?? 0);
  const totalScore = Number(stock?.totalScore ?? 0);
  const upside = Number(stock?.metrics?.upside);
  const debtRatio = Number(stock?.metrics?.debtRatio);
  const rankPenalty = Number(stock?.rankMeta?.penalty ?? 0);
  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];
  // 적정가 산출이 유효할 때만 non-null. cap 초과값은 이미 라벨로 치환돼 있다.
  const upsidePart = formatUpsideReasonPart(stock);

  if (activeView === "total") {
    if (stock?.rankMeta?.topRankEligible) parts.push("안정성 조건 통과");
    if (totalScore >= 70) parts.push(`총점 ${totalScore}점`);
    if (upsidePart && upside > 0) parts.push(upsidePart);
    if (rankPenalty > 0) parts.push(`패널티 ${rankPenalty}`);
    if (rankFlags.length) parts.push(rankFlags[0]);
  } else if (activeView === "undervalue") {
    if (valueScore > 0) parts.push(`가치 점수 ${valueScore}점`);
    if (Number.isFinite(debtRatio)) parts.push(`부채비율 ${formatRatio(debtRatio)}`);
    if (upsidePart && upside > 0) parts.push(upsidePart);
    if (undervalueFlags.length) parts.push(undervalueFlags[0]);
  } else if (activeView === "upside") {
    if (upsidePart) parts.push(upsidePart);
    if (stock?.rankMeta?.topRankEligible) parts.push("종합 조건 통과");
    if (rankFlags.length) parts.push(rankFlags[0]);
  } else if (activeView === "short") {
    const rate = Number(stock?.metrics?.priceChangeRate ?? stock?.metrics?.momentum);
    if (Number.isFinite(rate)) parts.push(`최근 흐름 ${formatDelta(rate)}`);
    if (upsidePart) parts.push(upsidePart);
    if (Number(stock?.metrics?.avgTradeValue5d ?? 0) > 0) parts.push(`유동성 ${formatKrwCompact(stock?.metrics?.avgTradeValue5d)}`);
  } else if (activeView === "annual") {
    if (stock?.rankMeta?.topRankEligible) parts.push("안정성 조건 통과");
    if (totalScore > 0) parts.push(`총점 ${totalScore}점`);
    if (Number.isFinite(Number(stock?.metrics?.operatingIncomeGrowth))) parts.push(`영업이익 성장 ${formatDelta(stock?.metrics?.operatingIncomeGrowth)}`);
    if (Number.isFinite(Number(stock?.metrics?.revenueGrowth))) parts.push(`매출 성장 ${formatDelta(stock?.metrics?.revenueGrowth)}`);
  } else if (activeView === "long") {
    if (valueScore > 0) parts.push(`가치 점수 ${valueScore}점`);
    if (Number.isFinite(debtRatio)) parts.push(`부채비율 ${formatRatio(debtRatio)}`);
    if (Number.isFinite(Number(stock?.metrics?.roe))) parts.push(`ROE ${formatRatio(stock?.metrics?.roe)}`);
    if (Number.isFinite(Number(stock?.metrics?.pbr))) parts.push(`PBR ${Number(stock.metrics.pbr).toFixed(2)}배`);
  }
  if (!parts.length) return "현재 수치 조합을 기준으로 상대 비교된 결과입니다.";
  return parts.join(" · ");
}

export function buildWarningLine(stock, activeView, activeRisk) {
  const rankPenalty = Number(stock?.rankMeta?.penalty ?? 0);
  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];
  const debtRatio = Number(stock?.metrics?.debtRatio);
  const upside = Number(stock?.metrics?.upside);

  if (activeRisk === "highDebt") return `부채비율 ${formatRatio(debtRatio)} 수준이라 저평가처럼 보여도 재무 리스크를 먼저 확인해야 합니다.`;
  if (activeRisk === "lowLiquidity") return `최근 5일 평균 거래대금 ${formatKrwCompact(stock?.metrics?.avgTradeValue5d)} 수준이라 체결/수급은 보수적으로 봐야 합니다.`;
  if (activeRisk === "unstableEarnings") return "영업이익 또는 순이익 흐름이 약해, 다음 실적 발표와 회복 가능성을 우선 확인해야 합니다.";

  if (activeView === "total" || activeView === "annual") {
    if (rankPenalty > 0) return `종합 해석에는 패널티 ${rankPenalty}점이 반영됩니다.`;
    if (rankFlags.length) return `주의 포인트: ${rankFlags[0]}`;
    if (Number.isFinite(debtRatio) && debtRatio >= 150) return `부채비율 ${formatRatio(debtRatio)}로 보수 해석이 필요합니다.`;
    return "실적·재무·수급 변화에 따라 종합 조건 통과 여부가 바뀔 수 있습니다.";
  }
  if (activeView === "undervalue" || activeView === "long") {
    if (undervalueFlags.length) return `주의 포인트: ${undervalueFlags[0]}`;
    if (Number.isFinite(debtRatio) && debtRatio >= 150) return `저평가처럼 보여도 부채비율 ${formatRatio(debtRatio)}를 함께 확인해야 합니다.`;
    return "가치 점수가 높아도 재무 안정성 해석은 별도로 확인해야 합니다.";
  }
  if (Number.isFinite(upside) && upside <= 0) return "현재 적정가 추정 기준 즉각적인 상승여력은 크지 않을 수 있습니다.";
  if (rankFlags.length) return `주의 포인트: ${rankFlags[0]}`;
  return "상승여력은 참고치이며 실제 결과는 업황·실적·수급에 따라 달라질 수 있습니다.";
}
