// 원화 금액을 "조원/억원" 단위로 압축 표기. (VERIFY-2026-08 F-2)
//
// 이전엔 homeData.js / screenerReason.js / quoteCard.js 에 거의 같은 구현이
// 세 벌 있었고, 억원 단위를 정수로 반올림해서(`.toFixed(0)`) 거래대금이
// 20~50억 구간에 몰린 종목 326/500 이 서로 같은 문자열로 표시됐다
// (예: 3,423,346,860 / 3,447,622,198 / 3,379,872,867 → 전부 "34억원").
// 억원 단위에 소수점 1자리를 줘서 구분되게 하고, 구현을 한 곳으로 모은다.

export function formatKrwCompact(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "-";
  const abs = Math.abs(num);
  if (abs >= 1_0000_0000_0000) return `${(num / 1_0000_0000_0000).toFixed(1)}조원`;
  if (abs >= 1_0000_0000) {
    // 소수점 1자리 유지하되 trailing .0 은 버리고 천단위 구분(5,430억원).
    const eok = Number((num / 1_0000_0000).toFixed(1));
    return `${eok.toLocaleString("ko-KR")}억원`;
  }
  return `${Math.round(num).toLocaleString("ko-KR")}원`;
}
