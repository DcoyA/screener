import { toNumber, normalizeSide } from "./format";

// 주문 이력(BUY/SELL)을 순매수 기준으로 접어 보유 포지션과 평가 손익을 낸다.
// app/demo-trade/hooks/useOrders.js의 portfolioSummary 계산과 동일한 규칙
// (매도 시 평균단가로 원가 차감, realizedProfit 별도 누적). 홈의 가상투자
// 섹션과 모의투자 페이지가 같은 숫자를 보도록 여기 한 곳에 둔다.
//
// priceMap: { [code]: 실시간가 }. 없는 종목은 평균단가로 폴백한다.
export function summarizePositions(orders, priceMap = {}) {
  const map = {};

  (orders || []).forEach((order) => {
    const code = String(order?.code || "").trim();
    const side = normalizeSide(order?.side);
    const qty = toNumber(order?.quantity);
    const price = toNumber(order?.price);
    const amount = toNumber(order?.amount) || price * qty;
    if (!code || !qty || !price) return;

    if (!map[code]) {
      map[code] = { code, quantity: 0, buyAmount: 0, realizedProfit: 0 };
      // 라벨용. 저장 시점에 이미 정제된 이름이라 그대로 옮긴다(렌더 아님).
      map[code].label = order?.name || code;
    }

    if (side === "BUY") {
      map[code].quantity += qty;
      map[code].buyAmount += amount;
    } else {
      const avgPrice = map[code].quantity > 0 ? map[code].buyAmount / map[code].quantity : 0;
      map[code].quantity -= qty;
      map[code].buyAmount -= avgPrice * qty;
      map[code].realizedProfit += price * qty - avgPrice * qty;
      if (map[code].quantity <= 0) {
        map[code].quantity = 0;
        map[code].buyAmount = 0;
      }
    }
  });

  const positions = Object.values(map)
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const avgPrice = item.quantity > 0 ? item.buyAmount / item.quantity : 0;
      const realtimePrice = toNumber(priceMap[item.code]) || avgPrice;
      const evalAmount = realtimePrice * item.quantity;
      const profitLoss = evalAmount - item.buyAmount;
      const profitRate = item.buyAmount > 0 ? (profitLoss / item.buyAmount) * 100 : 0;
      return { ...item, avgPrice, currentPrice: realtimePrice, evalAmount, profitLoss, profitRate };
    });

  return positions;
}

// 계좌 단위 합계. profitRate는 매수 원가(투입 자금) 대비 - 모의투자 페이지와 동일 기준.
export function totalsFromPositions(positions, cash = 0) {
  const evalAmount = positions.reduce((s, p) => s + p.evalAmount, 0);
  const buyAmount = positions.reduce((s, p) => s + p.buyAmount, 0);
  const profitLoss = evalAmount - buyAmount;
  const profitRate = buyAmount > 0 ? (profitLoss / buyAmount) * 100 : 0;
  const totalAsset = toNumber(cash) + evalAmount;
  return { evalAmount, buyAmount, profitLoss, profitRate, totalAsset, holdingsCount: positions.length };
}

// 보유(순매수 > 0)인 종목코드만.
export function holdingCodesFromOrders(orders) {
  const net = {};
  (orders || []).forEach((order) => {
    const code = String(order?.code || "").trim();
    const qty = toNumber(order?.quantity);
    if (!code || !qty) return;
    net[code] = (net[code] || 0) + (normalizeSide(order?.side) === "SELL" ? -qty : qty);
  });
  return Object.entries(net).filter(([, q]) => q > 0).map(([code]) => code);
}
