export const UPSIDE_CAP = 60;
export const UPSIDE_FLOOR = -40;

// 상승여력 표기 규칙(CLAUDE.md): 단일 값 대신 밴드/라벨 처리, 표기 상한 +60%.
// 반환: { display: string, isCapped: boolean, raw: number|null }
export function formatUpside(currentPrice, fairValue) {
  const current = Number(currentPrice);
  const fair = Number(fairValue);

  if (!Number.isFinite(fair) || fair === 0) {
    return { display: "산출 보류", isCapped: false, raw: null };
  }
  // fairValue가 currentPrice와 정확히 같으면 계산 실패 시 현재가를 대입한
  // fallback 흔적으로 본다(우연히 정확히 같은 값이 나올 가능성은 감수한다).
  if (fair === current) {
    return { display: "산출 보류", isCapped: false, raw: null };
  }
  if (!Number.isFinite(current) || current === 0) {
    return { display: "산출 보류", isCapped: false, raw: null };
  }

  const raw = ((fair - current) / current) * 100;

  if (raw > UPSIDE_CAP) {
    return { display: "시장이 구조적 할인을 적용 중인 구간", isCapped: true, raw };
  }
  if (raw < UPSIDE_FLOOR) {
    return { display: "시장가가 산출 적정가를 크게 상회", isCapped: true, raw };
  }

  const sign = raw > 0 ? "+" : "";
  return { display: `${sign}${raw.toFixed(1)}%`, isCapped: false, raw };
}

// 가격 쌍이 아니라 이미 계산되어 있는 upside % 숫자(평균값, market_state.json
// 등에서 미리 계산해둔 값 등)를 표시할 때 쓴다. formatUpside와 같은 상한/하한
// 규칙을 적용해 튀는 숫자가 화면에 그대로 남지 않게 한다.
export function formatUpsidePercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "산출 보류";
  if (num > UPSIDE_CAP) return "시장이 구조적 할인을 적용 중인 구간";
  if (num < UPSIDE_FLOOR) return "시장가가 산출 적정가를 크게 상회";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

// stock 객체(metrics.closePrice/targetPrice)를 그대로 받는 편의 함수.
// RankingTab/FinalPicksTab/homeData/diagnosisData에 각자 따로 있던
// 거의 동일한 formatUpsideDisplay 구현을 이걸로 통일한다.
export function formatUpsideDisplay(stock) {
  return formatUpside(stock?.metrics?.closePrice, stock?.metrics?.targetPrice).display;
}

// 이유 문구용 "상승여력 <값>" 조각. 적정가 산출이 유효할 때만 만든다.
// 로컬 formatPercent로 원본 %를 그대로 찍던 자리(홈 전략 슬롯 / 스크리너 카드
// reason 빌더)를 이걸로 통일한다 - +60% 초과값은 formatUpsideDisplay가 이미
// 라벨로 바꾸므로 숫자가 새지 않는다. 산출 불가면 null → 호출부가 항목을 뺀다.
export function formatUpsideReasonPart(stock) {
  const display = formatUpsideDisplay(stock);
  if (!display || display === "-" || display === "산출 보류") return null;
  return `상승여력 ${display}`;
}
