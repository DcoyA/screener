// TASK 2(섹터 상대 위치) 표시 헬퍼. update_data.py가 계산해 저장한
// stock.sectorRelativeMeta.{per,pbr,roe}(각각 {rank, peerCount, percentile,
// usedMajorFallback} 또는 표본 부족 시 null)를 사람이 읽는 문장으로 바꾼다.
//
// "PER 3.6배" 같은 절대값만으로는 초보자가 싼지 비싼지 판단할 수 없다는
// 문제를 풀기 위한 것 - 백분위가 null이면(섹터/대분류 표본 모두 5개 미만)
// 거짓 안심을 주지 않기 위해 비교 문구 자체를 표시하지 않는다.

const LOWER_IS_BETTER = new Set(["per", "pbr"]); // 낮을수록 저평가("쌈")
const HIGHER_IS_BETTER = new Set(["roe"]); // 높을수록 우수

function resolveCategoryName(stock, rankInfo) {
  if (rankInfo.usedMajorFallback) return stock?.sectorRelativeMeta?.majorCategoryName || "같은 대분류";
  return stock?.sectorRelativeMeta?.sectorName || "같은 업종";
}

// 반환: 문자열(표시할 비교 문구) | null(표본 부족 - 아예 표시하지 말 것)
export function formatSectorRelative(stock, metricKey) {
  const rankInfo = stock?.sectorRelativeMeta?.[metricKey];
  if (!rankInfo) return null;

  const { rank, peerCount, percentile } = rankInfo;
  const categoryName = resolveCategoryName(stock, rankInfo);

  if (LOWER_IS_BETTER.has(metricKey)) {
    // percentile은 오름차순 기준(0%=최저값=가장 쌈)으로 이미 계산돼 있다.
    return `${categoryName} ${peerCount}개 중 ${rank}번째로 쌈 (하위 ${percentile}%)`;
  }

  if (HIGHER_IS_BETTER.has(metricKey)) {
    const reverseRank = peerCount - rank + 1;
    const topPercentile = Math.round((100 - percentile) * 10) / 10;
    return `${categoryName} ${peerCount}개 중 ${reverseRank}번째로 우수 (상위 ${topPercentile}%)`;
  }

  return null;
}
