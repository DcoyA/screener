// 종합판단점수(finalPickMeta.finalScore) 분포 통계 - 단일 창구.
//
// ⚠ 화면별 자체 계산 금지. 예전에 StrategySection이 market_state.json의
//   avgTotalScore(≈ totalScore 상위 30 평균 74)를 "전체 평균 75점"이라고
//   부르면서, 실제로는 전체 상위권인 62점 종목이 "평균보다 낮아요"로
//   찍히는 버그가 있었다. 홈/스크리너/상세가 전부 이 모듈만 import한다.
//
// 모집단(POPULATION): app/data/stocks.json 같은 스냅샷에서 finalScore가
//   null이 아닌 전 종목. 필터링된 풀이 아니다.
// 통계량: 평균이 아니라 중앙값(SCORE_MEDIAN). EXCLUDED 종목 finalScore가
//   0으로 깔려 분포가 좌편향이라 평균은 극단값에 끌린다.
// 산출 시점: 모듈 로드 시 1회(빌드 타임). stocks.json이 갱신되면 값도 갱신된다.
//   따라서 STEP-1(적정가 fallback 제거) 후 파이프라인이 재실행되면
//   median/p70/cut이 자동으로 재측정된다 - 상수 하드코딩 금지의 이유.

import stocksData from "../data/stocks.json" with { type: "json" };

const SLOT_SCORE_FLOOR = 60; // STEP-0의 INCLUDED 평균. 시장 전체가 내려간 날
//   p70만 쓰면 바도 따라 내려가므로 max로 하방을 고정한다.

function finalScoreOf(stock) {
  const v = Number(stock?.finalPickMeta?.finalScore);
  return Number.isFinite(v) ? v : null;
}

function percentileRankTop(sortedAsc, score) {
  // "상위 N%" = 이 점수 이상을 받은 종목 비율.
  if (!sortedAsc.length || !Number.isFinite(score)) return null;
  let gte = 0;
  for (let i = sortedAsc.length - 1; i >= 0; i -= 1) {
    if (sortedAsc[i] >= score) gte += 1;
    else break;
  }
  const ratio = gte / sortedAsc.length;
  return Math.max(1, Math.round(ratio * 100));
}

function quantile(sortedAsc, q) {
  if (!sortedAsc.length) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.round((q / 100) * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

const rows = Array.isArray(stocksData) ? stocksData : [];
const allScores = rows.map(finalScoreOf).filter((v) => v !== null).sort((a, b) => a - b);
const includedScores = rows
  .filter((s) => s?.finalPickMeta?.decision === "INCLUDED")
  .map(finalScoreOf)
  .filter((v) => v !== null)
  .sort((a, b) => a - b);

export const POPULATION_SIZE = allScores.length;

export const SCORE_MEDIAN =
  allScores.length === 0
    ? null
    : allScores.length % 2
      ? allScores[(allScores.length - 1) / 2]
      : Math.round((allScores[allScores.length / 2 - 1] + allScores[allScores.length / 2]) / 2);

export const INCLUDED_P70 = quantile(includedScores, 70);

// 전략 슬롯 공통 컷. max(INCLUDED p70, 60).
export const SLOT_SCORE_CUT = Math.max(INCLUDED_P70 ?? SLOT_SCORE_FLOOR, SLOT_SCORE_FLOOR);

function toScore(score) {
  if (score === null || score === undefined || score === "") return NaN;
  return Number(score);
}

// 전 종목 대비 백분위. null이면 산출 불가.
export function percentileOf(score) {
  return percentileRankTop(allScores, toScore(score));
}

// 1순위 표기: "82점 · 전체 500개 중 상위 12%".
// 백분위 산출 불가 시에만 "82점 (전체 중앙값 57점)"으로 폴백.
export function formatScoreRank(score) {
  const s = toScore(score);
  if (!Number.isFinite(s)) return "-";
  const pct = percentileOf(s);
  if (pct === null) {
    return SCORE_MEDIAN === null ? `${Math.round(s)}점` : `${Math.round(s)}점 (전체 중앙값 ${SCORE_MEDIAN}점)`;
  }
  return `${Math.round(s)}점 · 전체 ${POPULATION_SIZE}개 중 상위 ${pct}%`;
}

// 색 구간: 상위 20% 이내 --ruby-600 / 20~60% --ink-600 / 60% 밖 --ink-300.
// (중앙값 ±3pt 방식은 구간이 좁아 대부분 회색이 되므로 폐기)
export function scoreColor(score) {
  const s = toScore(score);
  if (!Number.isFinite(s)) return "var(--ink-600)";
  const pct = percentileOf(s);
  if (pct === null) return "var(--ink-600)";
  if (pct <= 20) return "var(--ruby-600)";
  if (pct <= 60) return "var(--ink-600)";
  return "var(--ink-300)";
}

// 빌드 로그: "왜 오늘 단기 슬롯이 비었나"를 나중에 추적할 수 있게 남긴다.
if (typeof console !== "undefined") {
  console.log(
    `[슬롯컷] p70=${INCLUDED_P70} floor=${SLOT_SCORE_FLOOR} 적용=${SLOT_SCORE_CUT} ` +
      `INCLUDED=${includedScores.length}건 | 전체중앙값=${SCORE_MEDIAN} 모집단=${POPULATION_SIZE}`,
  );
}
