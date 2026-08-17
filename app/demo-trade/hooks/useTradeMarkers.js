"use client";

import { useMemo } from "react";
import { toNumber, normalizeSide, getKoreaHourMinuteFromIso, candleMinuteValue } from "../lib/format";

export function useTradeMarkers({ chartData, chartScale, orders, code }) {
  return useMemo(() => {
    if (!chartData.length || !orders.length) return [];

    const selectedOrders = orders.filter((order) => String(order.code || "").trim() === code);

    return selectedOrders
      .map((order) => {
        const orderMinute = getKoreaHourMinuteFromIso(order.createdAt);
        const orderPrice = toNumber(order.price);
        if (!orderMinute || !orderPrice) return null;

        let nearestIndex = -1;
        let nearestDiff = Number.POSITIVE_INFINITY;
        const orderMinuteNumber = Number(orderMinute.slice(0, 2)) * 60 + Number(orderMinute.slice(2, 4));

        chartData.forEach((candle, index) => {
          const candleMinute = candleMinuteValue(candle);
          if (!candleMinute) return;

          const candleMinuteNumber = Number(candleMinute.slice(0, 2)) * 60 + Number(candleMinute.slice(2, 4));
          const diff = Math.abs(candleMinuteNumber - orderMinuteNumber);

          if (diff < nearestDiff) {
            nearestDiff = diff;
            nearestIndex = index;
          }
        });

        if (nearestIndex < 0) return null;

        const left = chartData.length > 1 ? (nearestIndex / (chartData.length - 1)) * 100 : 50;
        const top = ((chartScale.maxPrice - orderPrice) / chartScale.range) * 100;
        const safeTop = Math.max(4, Math.min(92, top));
        const orderSide = normalizeSide(order.side);

        return {
          id: order.orderId || `${orderSide}-${order.createdAt}-${nearestIndex}`,
          side: orderSide,
          label: orderSide === "BUY" ? "BUY" : "SELL",
          left,
          top: safeTop,
          price: orderPrice,
          quantity: toNumber(order.quantity),
        };
      })
      .filter(Boolean);
  }, [orders, chartData, chartScale.maxPrice, chartScale.range, code]);
}
