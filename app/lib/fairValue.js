// 적정가(fairValue) 산출 상태 판정 + 표시 문구. scripts/update_data.py의
// compute_fair_value_band()가 종목별로 s.fairValueStatus에 아래 enum 중 하나를
// 넣는다. 이 파일이 "숫자를 보여줄지 / 사유 문구를 보여줄지"의 단일 창구다.

export const FAIR_VALUE_STATUS_LABEL = {
  insufficient_data: "적정가 산출 데이터 부족",
  negative_earnings: "적자로 적정가 산출 불가",
  sector_unmapped: "업종 미분류로 산출 보류",
  outlier_rejected: "추정 편차가 커 표시하지 않음",
};

// stock 객체에서 fairValueStatus를 읽는다. metrics 형태(stocks.json / Supabase
// raw_data)와, diagnosisData.js가 평탄화한 형태({ currentPrice, targetPrice })를
// 모두 받는다.
//
// 하위호환: fairValueStatus가 없는 예전 스냅샷/JSON은 targetPrice로 유추한다.
// - targetPrice가 없거나 0 이하 → insufficient_data
// - targetPrice가 closePrice와 정확히 같음(구 fallback 흔적) → insufficient_data
// - 그 외 → ok
export function getFairValueStatus(stock) {
  const explicit = stock?.fairValueStatus ?? stock?.fairValueMeta?.status;
  if (explicit && explicit !== "ok") return explicit;
  if (explicit === "ok") return "ok";

  const closePrice = Number(
    stock?.metrics?.closePrice ?? stock?.currentPrice ?? stock?.closePrice
  );
  const targetPrice = Number(stock?.metrics?.targetPrice ?? stock?.targetPrice);
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) return "insufficient_data";
  if (Number.isFinite(closePrice) && closePrice === targetPrice) return "insufficient_data";
  return "ok";
}

export function isFairValueOk(stock) {
  return getFairValueStatus(stock) === "ok";
}

// status가 ok가 아닐 때 적정가/상승여력 자리에 숫자 대신 보여줄 문구.
export function fairValueStatusLabel(status) {
  return FAIR_VALUE_STATUS_LABEL[status] || "적정가 산출 보류";
}

// 적정가는 단일값이 아니라 보수/낙관 밴드로 표시한다(fair-value v2). 만원 단위 반올림.
// 상세 페이지(app/stock/[code])와 홈 검색 프리뷰가 같은 함수를 봐야 표기가 일치한다.
export function formatPriceBand(low, high) {
  const loNum = Number(low);
  const hiNum = Number(high);
  if (!Number.isFinite(loNum) || !Number.isFinite(hiNum) || (!loNum && !hiNum)) return "-";
  const toManwon = (n) => Math.round(n / 10000);
  const lo = toManwon(loNum);
  const hi = toManwon(hiNum);
  if (lo === hi) return `${lo.toLocaleString("ko-KR")}만원`;
  return `${lo.toLocaleString("ko-KR")}만~${hi.toLocaleString("ko-KR")}만원`;
}
