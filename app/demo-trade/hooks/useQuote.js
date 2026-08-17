"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toNumber } from "../lib/format";

export function useQuote() {
  const searchParams = useSearchParams();

  const [searchCode, setSearchCode] = useState("005930");
  const [code, setCode] = useState("005930");
  const [name, setName] = useState("삼성전자");
  const [selectedPopularCode, setSelectedPopularCode] = useState("005930");

  const [price, setPrice] = useState("");
  const [change, setChange] = useState("");
  const [rate, setRate] = useState("");
  const [candles, setCandles] = useState([]);
  const [quoteError, setQuoteError] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);

  async function fetchQuote(targetCode = code, targetName = "", source = "manual") {
    const cleanCode = String(targetCode || "").trim();
    if (!cleanCode) {
      alert("종목코드를 입력하세요.");
      return;
    }

    setLoadingQuote(true);
    setQuoteError("");

    try {
      const res = await fetch(`/api/kis/quote?code=${encodeURIComponent(cleanCode)}`);
      const data = await res.json();

      if (!data.ok) {
        setQuoteError("현재 시세를 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
        console.warn("통합 시세 조회 실패:", data);
        return;
      }

      const resolvedName = data.name || targetName || cleanCode;
      setCode(cleanCode);
      setSearchCode(cleanCode);
      setName(resolvedName);
      setPrice(data.price || "");
      setChange(data.change || "");
      setRate(data.rate || "");
      setCandles(Array.isArray(data.candles) ? data.candles : []);
      setSelectedPopularCode(source === "popular" ? cleanCode : "");

      if (data.minuteError) {
        console.warn("분봉 조회 실패:", data.minuteError);
      }
    } catch (error) {
      console.error(error);
      setQuoteError("현재 시세를 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setLoadingQuote(false);
    }
  }

  function selectStock(stock) {
    setSearchCode(stock.code);
    fetchQuote(stock.code, stock.name, "popular");
  }

  useEffect(() => {
    const deepLinkCode = searchParams.get("code");
    const deepLinkName = searchParams.get("name") || "";
    if (deepLinkCode) {
      setSearchCode(deepLinkCode);
      fetchQuote(deepLinkCode, deepLinkName, "manual");
    } else {
      fetchQuote("005930", "삼성전자", "popular");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartScale = useMemo(() => {
    if (!candles.length) {
      return { chartData: [], maxPrice: 0, minPrice: 0, range: 1 };
    }

    const highs = candles.map((item) => toNumber(item.high));
    const lows = candles.map((item) => toNumber(item.low));
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const range = Math.max(maxPrice - minPrice, 1);

    const chartData = candles.map((item) => {
      const open = toNumber(item.open);
      const high = toNumber(item.high);
      const low = toNumber(item.low);
      const close = toNumber(item.close);
      const isUp = close >= open;
      const highTop = ((maxPrice - high) / range) * 100;
      const lowTop = ((maxPrice - low) / range) * 100;
      const bodyTop = ((maxPrice - Math.max(open, close)) / range) * 100;
      const bodyBottom = ((maxPrice - Math.min(open, close)) / range) * 100;
      const bodyHeight = Math.max(bodyBottom - bodyTop, 2);

      return { ...item, isUp, highTop, lowTop, bodyTop, bodyHeight };
    });

    return { chartData, maxPrice, minPrice, range };
  }, [candles]);

  return {
    searchCode,
    setSearchCode,
    code,
    name,
    selectedPopularCode,
    price,
    setPrice,
    change,
    rate,
    candles,
    quoteError,
    loadingQuote,
    fetchQuote,
    selectStock,
    chartScale,
    chartData: chartScale.chartData,
  };
}
