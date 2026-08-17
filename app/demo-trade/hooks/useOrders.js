"use client";

import { useEffect, useMemo, useState } from "react";
import { toNumber, normalizeSide } from "../lib/format";
import { calculateFomoScore, fomoLabelFromScore } from "../lib/fomo";

export function useOrders({ account, code, name, price, onAccountCashUpdate }) {
  const [orders, setOrders] = useState([]);
  const [positionPrices, setPositionPrices] = useState({});
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");

  const [side, setSide] = useState("BUY");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [holdingDays, setHoldingDays] = useState("7");

  const [showFomoTip, setShowFomoTip] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("demoTradeSeenFomoTip")) setShowFomoTip(true);
  }, []);

  function dismissFomoTip() {
    setShowFomoTip(false);
    localStorage.setItem("demoTradeSeenFomoTip", "1");
  }

  function resetLocalOrders() {
    setOrders([]);
    setPositionPrices({});
  }

  function updatePositionPrice(targetCode, targetPriceValue) {
    if (!targetCode || !targetPriceValue) return;
    setPositionPrices((prev) => ({ ...prev, [targetCode]: targetPriceValue }));
  }

  const cash = toNumber(account?.cash);
  const totalOrderAmount = useMemo(() => toNumber(price) * toNumber(quantity), [price, quantity]);

  const fomoScore = useMemo(
    () => calculateFomoScore({ reason, stopLossPrice, targetPrice, holdingDays, totalOrderAmount }),
    [reason, stopLossPrice, targetPrice, holdingDays, totalOrderAmount]
  );
  const fomoLabel = useMemo(() => fomoLabelFromScore(fomoScore), [fomoScore]);

  const portfolioSummary = useMemo(() => {
    const map = {};

    orders.forEach((order) => {
      const orderCode = String(order.code || "").trim();
      const orderName = order.name || orderCode;
      const orderSide = normalizeSide(order.side);
      const qty = toNumber(order.quantity);
      const orderPrice = toNumber(order.price);
      const amount = toNumber(order.amount) || orderPrice * qty;

      if (!orderCode || !qty || !orderPrice) return;

      if (!map[orderCode]) {
        map[orderCode] = { code: orderCode, name: orderName, quantity: 0, buyAmount: 0, realizedProfit: 0 };
      }

      if (orderSide === "BUY") {
        map[orderCode].quantity += qty;
        map[orderCode].buyAmount += amount;
      }

      if (orderSide === "SELL") {
        const currentQuantity = map[orderCode].quantity;
        const currentBuyAmount = map[orderCode].buyAmount;
        const avgPrice = currentQuantity > 0 ? currentBuyAmount / currentQuantity : 0;
        const sellCostBasis = avgPrice * qty;
        const sellAmount = orderPrice * qty;

        map[orderCode].quantity -= qty;
        map[orderCode].buyAmount -= sellCostBasis;
        map[orderCode].realizedProfit += sellAmount - sellCostBasis;

        if (map[orderCode].quantity <= 0) {
          map[orderCode].quantity = 0;
          map[orderCode].buyAmount = 0;
        }
      }
    });

    return Object.values(map)
      .filter((item) => item.quantity > 0)
      .map((item) => {
        const avgPrice = item.quantity > 0 ? item.buyAmount / item.quantity : 0;
        const realtimePrice = toNumber(positionPrices[item.code]) || (item.code === code ? toNumber(price) : 0) || avgPrice;
        const evalAmount = realtimePrice * item.quantity;
        const profitLoss = evalAmount - item.buyAmount;
        const profitRate = item.buyAmount > 0 ? (profitLoss / item.buyAmount) * 100 : 0;

        return { ...item, avgPrice, currentPrice: realtimePrice, evalAmount, profitLoss, profitRate };
      });
  }, [orders, positionPrices, code, price]);

  const totalEvalAmount = portfolioSummary.reduce((sum, item) => sum + item.evalAmount, 0);
  const totalBuyAmount = portfolioSummary.reduce((sum, item) => sum + item.buyAmount, 0);
  const totalProfitLoss = totalEvalAmount - totalBuyAmount;
  const totalProfitRate = totalBuyAmount > 0 ? (totalProfitLoss / totalBuyAmount) * 100 : 0;
  const totalAsset = cash + totalEvalAmount;

  function getHoldingQuantity(targetCode) {
    const position = portfolioSummary.find((item) => item.code === targetCode);
    return toNumber(position?.quantity);
  }

  const selectedHoldingQuantity = getHoldingQuantity(code);

  const estimatedCash = useMemo(() => {
    if (!account) return 0;
    if (side === "BUY") return cash - totalOrderAmount;
    return cash + totalOrderAmount;
  }, [account, cash, side, totalOrderAmount]);

  async function loadOrders() {
    if (!account?.accountId) return;
    try {
      const res = await fetch("/api/demo/order/list");
      const data = await res.json();
      if (data.ok) {
        const nextOrders = data.orders || [];
        setOrders(nextOrders);
        await refreshPositionPrices(nextOrders);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function refreshPositionPrices(targetOrders = orders) {
    const netMap = {};
    targetOrders.forEach((order) => {
      const orderCode = String(order.code || "").trim();
      const qty = toNumber(order.quantity);
      const orderSide = normalizeSide(order.side);
      if (!orderCode || !qty) return;
      if (!netMap[orderCode]) netMap[orderCode] = 0;
      netMap[orderCode] += orderSide === "SELL" ? -qty : qty;
    });

    const holdingCodes = Object.entries(netMap)
      .filter(([, qty]) => qty > 0)
      .map(([holdingCode]) => holdingCode);

    if (holdingCodes.length === 0) {
      setPositionPrices({});
      return;
    }

    setLoadingPositions(true);
    const nextPrices = {};

    for (const holdingCode of holdingCodes) {
      try {
        const res = await fetch(`/api/kis/quote?code=${encodeURIComponent(holdingCode)}`);
        const data = await res.json();
        if (data.ok && data.price) nextPrices[holdingCode] = toNumber(data.price);
      } catch (error) {
        console.error("보유종목 현재가 조회 실패:", holdingCode, error);
      }
    }

    setPositionPrices(nextPrices);
    setLoadingPositions(false);
  }

  async function submitOrder() {
    if (!account?.accountId) {
      alert("먼저 가상계좌를 생성하거나 불러오세요.");
      return;
    }
    if (!code || !price || !quantity) {
      alert("종목, 현재가, 수량을 확인해주세요.");
      return;
    }
    if (toNumber(quantity) <= 0) {
      alert("수량은 1주 이상 입력해주세요.");
      return;
    }
    if (side === "BUY" && totalOrderAmount > cash) {
      alert("가용 현금보다 큰 주문입니다.");
      return;
    }
    if (side === "SELL") {
      const holdingQuantity = getHoldingQuantity(code);
      if (holdingQuantity <= 0) {
        alert("보유하지 않은 종목은 매도할 수 없습니다.");
        return;
      }
      if (toNumber(quantity) > holdingQuantity) {
        alert(`보유 수량(${holdingQuantity.toLocaleString()}주)보다 많이 매도할 수 없습니다.`);
        return;
      }
    }

    setOrderStatus("주문 접수 중...");
    setTimeout(() => setOrderStatus("가격 체결 중..."), 600);

    setTimeout(async () => {
      try {
        const res = await fetch("/api/demo/order/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            side,
            code,
            name,
            price: toNumber(price),
            quantity: toNumber(quantity),
            reason,
          }),
        });

        const data = await res.json();
        if (!data.ok) {
          alert(data.error || "주문 처리 실패");
          setOrderStatus("");
          return;
        }

        setOrderStatus("주문 체결 완료");
        if (data.account && typeof data.account.cash !== "undefined") {
          onAccountCashUpdate?.(data.account.cash);
        }
        await loadOrders();
        setReason("");
        setTimeout(() => setOrderStatus(""), 1200);
      } catch (error) {
        console.error(error);
        alert("주문 처리 중 문제가 발생했습니다.");
        setOrderStatus("");
      }
    }, 1200);
  }

  return {
    orders,
    positionPrices,
    loadingPositions,
    orderStatus,
    side,
    setSide,
    quantity,
    setQuantity,
    reason,
    setReason,
    targetPrice,
    setTargetPrice,
    stopLossPrice,
    setStopLossPrice,
    holdingDays,
    setHoldingDays,
    showFomoTip,
    dismissFomoTip,
    fomoScore,
    fomoLabel,
    portfolioSummary,
    totalEvalAmount,
    totalBuyAmount,
    totalProfitLoss,
    totalProfitRate,
    totalAsset,
    selectedHoldingQuantity,
    estimatedCash,
    totalOrderAmount,
    getHoldingQuantity,
    loadOrders,
    refreshPositionPrices,
    submitOrder,
    resetLocalOrders,
    updatePositionPrice,
  };
}
