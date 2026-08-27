"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toNumber } from "../lib/format";

const QUOTE_TIMEOUT_MS = 10_000;

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
  const [candleInterval, setCandleInterval] = useState("minute");
  const [marketOpen, setMarketOpen] = useState(null); // null=미상, true/false
  const [priceBasis, setPriceBasis] = useState(""); // "realtime" | "close"

  // 3-상태: 무한 로딩 금지. loading(10초 타임아웃) / ready / error(재시도).
  const [quoteState, setQuoteState] = useState("loading");
  const [quoteError, setQuoteError] = useState("");

  const lastRequestRef = useRef({ code: "005930", name: "삼성전자", source: "popular" });

  const fetchQuote = useCallback(async (targetCode, targetName = "", source = "manual") => {
    const cleanCode = String(targetCode ?? "").trim();
    if (!cleanCode) {
      alert("종목코드를 입력하세요.");
      return;
    }

    lastRequestRef.current = { code: cleanCode, name: targetName, source };
    setQuoteState("loading");
    setQuoteError("");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUOTE_TIMEOUT_MS);

    try {
      const res = await fetch(`/api/kis/quote?code=${encodeURIComponent(cleanCode)}`, {
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || !data.ok) {
        setQuoteState("error");
        setQuoteError("시세를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        console.warn("통합 시세 조회 실패:", data);
        return;
      }

      const resolvedPrice = toNumber(data.price);
      if (!(resolvedPrice > 0)) {
        // 시세 소스는 응답했지만 가격이 비어 있음 → 주문 불가라 error로 취급.
        setQuoteState("error");
        setQuoteError("현재가를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.");
        console.warn("가격 결측 응답:", data);
        return;
      }

      setCode(cleanCode);
      setSearchCode(cleanCode);
      setName(data.name || targetName || cleanCode);
      setPrice(data.price || "");
      setChange(data.change ?? "");
      setRate(data.rate ?? "");
      setCandles(Array.isArray(data.candles) ? data.candles : []);
      setCandleInterval(data.candleInterval || "minute");
      setMarketOpen(typeof data.marketOpen === "boolean" ? data.marketOpen : null);
      setPriceBasis(data.priceBasis || "");
      setSelectedPopularCode(source === "popular" ? cleanCode : "");
      setQuoteState("ready");

      if (data.minuteError) console.warn("분봉 안내:", data.minuteError);
    } catch (error) {
      const aborted = error?.name === "AbortError";
      setQuoteState("error");
      setQuoteError(
        aborted
          ? "시세 응답이 10초 안에 오지 않았습니다. 다시 시도해 주세요."
          : "시세를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
      );
      if (!aborted) console.error(error);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const retry = useCallback(() => {
    const { code: c, name: n, source } = lastRequestRef.current;
    fetchQuote(c, n, source);
  }, [fetchQuote]);

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
    candleInterval,
    marketOpen,
    priceBasis,
    quoteState,
    quoteError,
    loadingQuote: quoteState === "loading",
    fetchQuote,
    retry,
    selectStock,
    chartScale,
    chartData: chartScale.chartData,
  };
}
