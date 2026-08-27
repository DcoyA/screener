// 퍼센트 표기 두 갈래. 예전엔 화면마다 로컬 formatPercent 하나로 뭉뚱그려
// 부채비율·승률에까지 "+" 부호가 붙었다(예: "부채비율 +32.0%").
//
// - formatDelta: 증감(수익률, 초과수익, 성장률, 5일 등락률). +/- 부호를 붙인다.
// - formatRatio: 비율(부채비율, 승률, 영업이익률, ROE, 비중). 부호를 붙이지 않는다.
//
// 둘 다 값이 없으면 "-"를 돌려준다(기존 formatPercent와 동일).

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function formatDelta(value) {
  const num = toNumber(value);
  if (num === null) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

export function formatRatio(value) {
  const num = toNumber(value);
  if (num === null) return "-";
  return `${num.toFixed(1)}%`;
}
