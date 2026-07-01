"use client";

import { useEffect, useMemo, useState } from "react";

const POPULAR_STOCKS = [
  { code: "005930", name: "삼성전자" },
  { code: "000660", name: "SK하이닉스" },
  { code: "035420", name: "NAVER" },
  { code: "035720", name: "카카오" },
  { code: "005380", name: "현대차" },
  { code: "068270", name: "셀트리온" },
];

function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatWon(value) {
  return `${Math.round(toNumber(value)).toLocaleString()}원`;
}

function formatRate(value) {
  const number = toNumber(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function normalizeSide(side) {
  return String(side || "BUY").toUpperCase();
}

function getKoreaHourMinuteFromIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}${minute}`;
}

function candleMinuteValue(candle) {
  const time = String(candle?.time || "");
  if (time.length < 4) return null;
  return time.slice(0, 4);
}

export default function DemoTradePage() {
  const [account, setAccount] = useState(null);
  const [loginAccountId, setLoginAccountId] = useState("");
  const [loginPin, setLoginPin] = useState("");

  const [searchCode, setSearchCode] = useState("005930");
  const [code, setCode] = useState("005930");
  const [name, setName] = useState("삼성전자");
  const [selectedPopularCode, setSelectedPopularCode] = useState("005930");

  const [price, setPrice] = useState("");
  const [change, setChange] = useState("");
  const [rate, setRate] = useState("");
  const [candles, setCandles] = useState([]);
  const [quoteError, setQuoteError] = useState("");

  const [side, setSide] = useState("BUY");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [holdingDays, setHoldingDays] = useState("7");

  const [orders, setOrders] = useState([]);
  const [positionPrices, setPositionPrices] = useState({});
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");

  useEffect(() => {
    async function initializePage() {
      await fetchQuote("005930", "삼성전자", "popular");

      const saved = localStorage.getItem("demoTradeAccount");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed?.accountId && parsed?.pin) {
            setLoginAccountId(parsed.accountId);
            setLoginPin(parsed.pin);
            await loadAccount(parsed.accountId, parsed.pin);
          }
        } catch (error) {
          console.error(error);
        }
      }
    }

    initializePage();
  }, []);

  const totalOrderAmount = useMemo(() => toNumber(price) * toNumber(quantity), [price, quantity]);

  const fomoScore = useMemo(() => {
    let score = 0;
    const text = String(reason || "").toLowerCase();

    if (text.includes("급등") || text.includes("막차") || text.includes("놓칠") || text.includes("fomo")) score += 28;
    if (text.includes("뉴스") || text.includes("호재") || text.includes("상한가")) score += 15;
    if (!stopLossPrice) score += 20;
    if (!targetPrice) score += 10;
    if (Number(holdingDays) <= 3) score += 15;
    if (totalOrderAmount >= 1000000) score += 12;

    return Math.min(score, 100);
  }, [reason, stopLossPrice, targetPrice, holdingDays, totalOrderAmount]);

  const fomoLabel = useMemo(() => {
    if (fomoScore >= 70) return "위험";
    if (fomoScore >= 40) return "주의";
    return "낮음";
  }, [fomoScore]);

  const cash = toNumber(account?.cash);

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
        map[orderCode] = {
          code: orderCode,
          name: orderName,
          quantity: 0,
          buyAmount: 0,
          realizedProfit: 0,
        };
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

        return {
          ...item,
          avgPrice,
          currentPrice: realtimePrice,
          evalAmount,
          profitLoss,
          profitRate,
        };
      });
  }, [orders, positionPrices, code, price]);

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

  const chartData = chartScale.chartData;

  const selectedTradeMarkers = useMemo(() => {
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

  const totalEvalAmount = portfolioSummary.reduce((sum, item) => sum + item.evalAmount, 0);
  const totalBuyAmount = portfolioSummary.reduce((sum, item) => sum + item.buyAmount, 0);
  const totalProfitLoss = totalEvalAmount - totalBuyAmount;
  const totalProfitRate = totalBuyAmount > 0 ? (totalProfitLoss / totalBuyAmount) * 100 : 0;
  const totalAsset = cash + totalEvalAmount;
  const selectedHoldingQuantity = getHoldingQuantity(code);

  const estimatedCash = useMemo(() => {
    if (!account) return 0;
    if (side === "BUY") return cash - totalOrderAmount;
    return cash + totalOrderAmount;
  }, [account, cash, side, totalOrderAmount]);

  function getHoldingQuantity(targetCode) {
    const position = portfolioSummary.find((item) => item.code === targetCode);
    return toNumber(position?.quantity);
  }

  async function createAccount() {
    setLoadingAccount(true);
    try {
      const res = await fetch("/api/demo/account/create");
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "가상계좌 생성 실패");
        return;
      }
      setAccount(data.account);
      setLoginAccountId(data.account.accountId);
      setLoginPin(data.account.pin);
      localStorage.setItem("demoTradeAccount", JSON.stringify(data.account));
      setOrders([]);
      setPositionPrices({});
    } catch (error) {
      console.error(error);
      alert("가상계좌 생성 중 오류가 발생했습니다.");
    } finally {
      setLoadingAccount(false);
    }
  }

  async function loadAccount(accountIdParam, pinParam) {
    const targetAccountId = accountIdParam || loginAccountId;
    const targetPin = pinParam || loginPin;
    if (!targetAccountId || !targetPin) {
      alert("가상계좌번호와 PIN을 입력하세요.");
      return;
    }

    setLoadingAccount(true);
    try {
      const res = await fetch(`/api/demo/account/load?accountId=${encodeURIComponent(targetAccountId)}&pin=${encodeURIComponent(targetPin)}`);
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "가상계좌 불러오기 실패");
        return;
      }
      setAccount(data.account);
      localStorage.setItem("demoTradeAccount", JSON.stringify({ accountId: targetAccountId, pin: targetPin }));
      await loadOrders(targetAccountId, targetPin);
    } catch (error) {
      console.error(error);
      alert("가상계좌 조회 중 오류가 발생했습니다.");
    } finally {
      setLoadingAccount(false);
    }
  }

  async function loadOrders(accountIdParam, pinParam) {
    const targetAccountId = accountIdParam || account?.accountId || loginAccountId;
    const targetPin = pinParam || account?.pin || loginPin;
    if (!targetAccountId || !targetPin) return;

    try {
      const res = await fetch(`/api/demo/order/list?accountId=${encodeURIComponent(targetAccountId)}&pin=${encodeURIComponent(targetPin)}`);
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
      setPositionPrices((prev) => ({ ...prev, [cleanCode]: toNumber(data.price) }));
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

  async function submitOrder() {
    if (!account?.accountId || !account?.pin) {
      alert("먼저 가상계좌를 생성하거나 불러오세요.");
      return;
    }
    if (!code || !price || !quantity) {
      alert("종목, 현재가, 수량을 확인하세요.");
      return;
    }
    if (toNumber(quantity) <= 0) {
      alert("수량은 1주 이상 입력하세요.");
      return;
    }
    if (side === "BUY" && totalOrderAmount > cash) {
      alert("가상 현금이 부족합니다.");
      return;
    }
    if (side === "SELL") {
      const holdingQuantity = getHoldingQuantity(code);
      if (holdingQuantity <= 0) {
        alert("보유하지 않은 종목은 매도할 수 없습니다.");
        return;
      }
      if (toNumber(quantity) > holdingQuantity) {
        alert(`보유수량(${holdingQuantity.toLocaleString()}주)보다 많이 매도할 수 없습니다.`);
        return;
      }
    }

    setOrderStatus("주문 접수 중...");
    setTimeout(() => setOrderStatus("가상 체결 중..."), 600);

    setTimeout(async () => {
      try {
        const res = await fetch("/api/demo/order/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: account.accountId,
            pin: account.pin,
            side,
            code,
            name,
            price: toNumber(price),
            quantity: toNumber(quantity),
            reason,
            targetPrice,
            stopLossPrice,
            holdingDays,
            fomoScore,
          }),
        });

        const data = await res.json();
        if (!data.ok) {
          alert(data.error || "주문 저장 실패");
          setOrderStatus("");
          return;
        }

        setOrderStatus("가상 체결 완료");
        if (data.account && typeof data.account.cash !== "undefined") {
          setAccount((prev) => ({ ...prev, cash: data.account.cash }));
        }
        await loadOrders(account.accountId, account.pin);
        setReason("");
        setTimeout(() => setOrderStatus(""), 1200);
      } catch (error) {
        console.error(error);
        alert("주문 처리 중 오류가 발생했습니다.");
        setOrderStatus("");
      }
    }, 1200);
  }

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <section style={styles.topBar} className="dt-topbar">
        <div>
          <div style={styles.logo}>우량주 스카우터</div>
          <h1 style={styles.title}>가상투자 터미널</h1>
          <p style={styles.subTitle}>진짜 돈을 넣기 전, 가상계좌로 매수 판단을 먼저 검증하세요.</p>
        </div>

        <div style={styles.accountBox} className="dt-account-box">
          {account ? (
            <>
              <div style={styles.accountLine}>가상계좌</div>
              <div style={styles.accountId}>{account.accountId}</div>
              <div style={styles.accountPin}>PIN {account.pin}</div>
            </>
          ) : (
            <>
              <div style={styles.accountLine}>가상계좌 없음</div>
              <button style={styles.primaryButton} onClick={createAccount} disabled={loadingAccount}>
                {loadingAccount ? "생성 중" : "가상계좌 생성"}
              </button>
            </>
          )}
        </div>
      </section>

      <section style={styles.loginPanel} className="dt-login-panel">
        <input style={styles.loginInput} value={loginAccountId} onChange={(event) => setLoginAccountId(event.target.value)} placeholder="가상계좌번호 DEMO-XXXX-XXXX" />
        <input style={styles.loginInput} value={loginPin} onChange={(event) => setLoginPin(event.target.value)} placeholder="PIN 4자리" />
        <button style={styles.darkButton} onClick={() => loadAccount()} disabled={loadingAccount}>계좌 불러오기</button>
        <button style={styles.outlineButton} onClick={createAccount} disabled={loadingAccount}>새 계좌 발급</button>
      </section>

      <section style={styles.assetGrid} className="dt-asset-grid">
        <AssetCard label="총자산" value={formatWon(totalAsset)} />
        <AssetCard label="가상현금" value={formatWon(cash)} />
        <AssetCard label="평가금액" value={formatWon(totalEvalAmount)} />
        <AssetCard label="전체수익률" value={formatRate(totalProfitRate)} tone={totalProfitRate >= 0 ? "red" : "blue"} />
      </section>

      <section style={styles.tradeGrid} className="dt-trade-grid">
        <aside style={styles.leftPanel}>
          <h2 style={styles.panelTitle}>종목 검색</h2>
          <div style={styles.searchBox}>
            <input
              style={styles.input}
              value={searchCode}
              onChange={(event) => {
                setSearchCode(event.target.value);
                setSelectedPopularCode("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") fetchQuote(searchCode, "", "manual");
              }}
              placeholder="종목코드 예: 005930"
            />
            <button style={styles.searchButton} onClick={() => fetchQuote(searchCode, "", "manual")} disabled={loadingQuote}>
              {loadingQuote ? "조회중" : "조회"}
            </button>
          </div>

          <h3 style={styles.smallTitle}>인기 종목</h3>
          <div style={styles.stockList}>
            {POPULAR_STOCKS.map((stock) => (
              <button
                key={stock.code}
                style={{ ...styles.stockButton, ...(selectedPopularCode === stock.code ? styles.stockButtonActive : {}) }}
                onClick={() => selectStock(stock)}
              >
                <span>{stock.name}</span>
                <em>{stock.code}</em>
              </button>
            ))}
          </div>
        </aside>

        <section style={styles.centerPanel}>
          <div style={styles.quoteHeader} className="dt-quote-header">
            <div>
              <div style={styles.stockName}>{name || code}</div>
              <div style={styles.stockCode}>{code}</div>
            </div>
            <div style={styles.priceArea}>
              <div style={styles.nowPrice}>{price ? formatWon(price) : "-"}</div>
              <div style={toNumber(rate) >= 0 ? styles.upText : styles.downText}>{change ? formatWon(change) : "-"} / {rate ? formatRate(rate) : "-"}</div>
            </div>
          </div>

          <div style={styles.chartPanel}>
            <div style={styles.chartToolbar} className="dt-chart-toolbar">
              <div>
                <strong>당일 1분봉</strong>
                <span style={styles.chartSubText}>최근 {candles.length || 0}개 캔들 · 체결마커 {selectedTradeMarkers.length}개</span>
              </div>
              <button style={styles.chartRefreshButton} onClick={() => fetchQuote(code, name)} disabled={loadingQuote}>{loadingQuote ? "조회 중" : "시세/차트 새로고침"}</button>
            </div>

            {quoteError && <div style={styles.chartWarning}>{quoteError}</div>}

            <div style={styles.realChart} className="dt-real-chart">
              {chartData.length === 0 ? (
                <div style={styles.chartEmpty}>{loadingQuote ? "분봉 데이터를 불러오는 중입니다." : "분봉 데이터가 없습니다."}</div>
              ) : (
                <div style={styles.candleChart}>
                  {chartData.map((item, index) => (
                    <div key={`${item.date}-${item.time}-${index}`} style={styles.realCandleWrap} title={`${item.label} / O ${item.open} H ${item.high} L ${item.low} C ${item.close}`}>
                      <div style={{ ...styles.wick, top: `${item.highTop}%`, height: `${Math.max(item.lowTop - item.highTop, 2)}%`, background: item.isUp ? "#ef4444" : "#2563eb" }} />
                      <div style={{ ...styles.realCandle, top: `${item.bodyTop}%`, height: `${item.bodyHeight}%`, background: item.isUp ? "#ef4444" : "#2563eb" }} />
                      {index % 5 === 0 && <span style={styles.timeLabel}>{item.label}</span>}
                    </div>
                  ))}

                  {selectedTradeMarkers.map((marker) => (
                    <div
                      key={marker.id}
                      style={{
                        ...styles.tradeMarker,
                        left: `${marker.left}%`,
                        top: `${marker.top}%`,
                        ...(marker.side === "BUY" ? styles.buyMarker : styles.sellMarker),
                      }}
                      title={`${marker.label} ${formatWon(marker.price)} / ${marker.quantity.toLocaleString()}주`}
                    >
                      {marker.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={styles.fomoBox} className="dt-fomo-box">
            <div>
              <strong>FOMO 위험도 · {fomoLabel}</strong>
              <p>매수 이유, 손절가 여부, 보유기간, 주문금액을 기준으로 충동매수 가능성을 임시 계산합니다.</p>
            </div>
            <div style={styles.fomoScore}>{fomoScore}</div>
          </div>
        </section>

        <aside style={styles.orderPanel}>
          <h2 style={styles.panelTitle}>주문창</h2>
          <div style={styles.tabRow}>
            <button style={side === "BUY" ? styles.buyTabActive : styles.tabButton} onClick={() => setSide("BUY")}>매수</button>
            <button style={side === "SELL" ? styles.sellTabActive : styles.tabButton} onClick={() => setSide("SELL")}>매도</button>
          </div>

          <label style={styles.label}>주문가격</label>
          <input style={styles.input} value={price} onChange={(event) => setPrice(event.target.value)} placeholder="현재가" />

          <label style={styles.label}>수량</label>
          <input style={styles.input} type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />

          {side === "SELL" && <div style={styles.holdingInfo}>현재 보유수량: <strong>{selectedHoldingQuantity.toLocaleString()}주</strong></div>}

          <div style={styles.orderInfo}>
            <div><span>주문금액</span><strong>{formatWon(totalOrderAmount)}</strong></div>
            <div><span>주문 후 현금</span><strong style={estimatedCash < 0 ? styles.downText : undefined}>{formatWon(estimatedCash)}</strong></div>
          </div>

          <label style={styles.label}>왜 지금 사거나 팔고 싶은가?</label>
          <textarea style={styles.textarea} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="예: 급등해서 놓칠까봐 / 랭킹 상위라서 / 손절 기준에 도달해서" />

          <div style={styles.twoCol}>
            <div><label style={styles.label}>목표가</label><input style={styles.input} value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="선택" /></div>
            <div><label style={styles.label}>손절가</label><input style={styles.input} value={stopLossPrice} onChange={(event) => setStopLossPrice(event.target.value)} placeholder="선택" /></div>
          </div>

          <label style={styles.label}>예상 보유기간</label>
          <select style={styles.input} value={holdingDays} onChange={(event) => setHoldingDays(event.target.value)}>
            <option value="1">1일</option>
            <option value="3">3일</option>
            <option value="7">7일</option>
            <option value="14">14일</option>
            <option value="30">30일 이상</option>
          </select>

          <button style={side === "BUY" ? styles.buyButton : styles.sellButton} onClick={submitOrder}>{side === "BUY" ? "가상 매수" : "가상 매도"}</button>
          {orderStatus && <div style={styles.orderStatus}>{orderStatus}</div>}
        </aside>
      </section>

      <section style={styles.bottomGrid} className="dt-bottom-grid">
        <div style={styles.tablePanel}>
          <div style={styles.panelTitleRow}>
            <h2 style={styles.panelTitle}>보유종목</h2>
            <button style={styles.miniButton} onClick={() => refreshPositionPrices()} disabled={loadingPositions}>{loadingPositions ? "조회 중" : "현재가 새로고침"}</button>
          </div>

          {portfolioSummary.length === 0 ? (
            <div style={styles.empty}>아직 보유종목이 없습니다.</div>
          ) : (
            <div style={styles.table} className="dt-position-table">
              <div style={styles.tableHead} className="dt-position-head"><span>종목</span><span>수량</span><span>평균단가</span><span>현재가</span><span>평가금액</span><span>평가손익</span></div>
              {portfolioSummary.map((item) => (
                <div key={item.code} style={styles.tableRow} className="dt-position-row">
                  <span><strong>{item.name}</strong><br /><em style={styles.codeText}>{item.code}</em></span>
                  <span>{item.quantity.toLocaleString()}</span>
                  <span>{formatWon(item.avgPrice)}</span>
                  <span>{formatWon(item.currentPrice)}</span>
                  <span>{formatWon(item.evalAmount)}</span>
                  <span style={item.profitLoss >= 0 ? styles.upText : styles.downText}>{item.profitLoss >= 0 ? "+" : ""}{formatWon(item.profitLoss)}<br />{formatRate(item.profitRate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.tablePanel}>
          <h2 style={styles.panelTitleWithMargin}>주문/체결 내역</h2>
          {orders.length === 0 ? (
            <div style={styles.empty}>주문 내역이 없습니다.</div>
          ) : (
            <div style={styles.orderList}>
              {[...orders].reverse().map((order) => (
                <div key={order.orderId} style={styles.orderItem} className="dt-order-item">
                  <div>
                    <strong style={normalizeSide(order.side) === "BUY" ? styles.upText : styles.downText}>{normalizeSide(order.side) === "BUY" ? "매수" : "매도"} {order.name || order.code}</strong>
                    <p>{order.reason || "매매 사유 없음"}</p>
                  </div>
                  <div style={styles.orderItemRight}>
                    <strong>{formatWon(order.amount)}</strong>
                    <p>{formatWon(order.price)} × {toNumber(order.quantity).toLocaleString()}주</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function AssetCard({ label, value, tone }) {
  return (
    <div style={styles.assetCard}>
      <div style={styles.assetLabel}>{label}</div>
      <div style={{ ...styles.assetValue, ...(tone === "red" ? styles.upText : {}), ...(tone === "blue" ? styles.downText : {}) }}>{value}</div>
    </div>
  );
}

const responsiveCss = `
  body { overflow-x: hidden; }
  @media (max-width: 1100px) {
    .dt-trade-grid { grid-template-columns: 240px 1fr !important; }
    .dt-trade-grid > aside:last-child { grid-column: 1 / -1; }
    .dt-bottom-grid { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 768px) {
    main { padding: 16px !important; }
    .dt-topbar { flex-direction: column !important; }
    .dt-account-box { width: 100% !important; min-width: 0 !important; box-sizing: border-box; }
    .dt-login-panel { grid-template-columns: 1fr 1fr !important; }
    .dt-asset-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .dt-trade-grid { grid-template-columns: 1fr !important; }
    .dt-quote-header { align-items: flex-start !important; gap: 12px; }
    .dt-real-chart { height: 280px !important; }
    .dt-chart-toolbar { flex-direction: column !important; align-items: flex-start !important; gap: 8px; }
    .dt-position-table { min-width: 0 !important; }
    .dt-position-head, .dt-position-row { grid-template-columns: 1.1fr 0.45fr 0.9fr 0.9fr !important; }
    .dt-position-head span:nth-child(5), .dt-position-row span:nth-child(5) { display: none; }
    .dt-position-head span:nth-child(3), .dt-position-row span:nth-child(3) { display: none; }
  }
  @media (max-width: 520px) {
    .dt-login-panel { grid-template-columns: 1fr !important; }
    .dt-asset-grid { grid-template-columns: 1fr !important; }
    .dt-real-chart { height: 240px !important; }
    .dt-position-head, .dt-position-row { grid-template-columns: 1fr 0.45fr 0.9fr 0.9fr !important; font-size: 12px !important; }
    .dt-order-item { flex-direction: column !important; }
  }
`;

const styles = {
  page: { maxWidth: "1440px", margin: "0 auto", padding: "24px", background: "#f3f4f6", color: "#111827", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif", minHeight: "100vh", overflowX: "hidden" },
  topBar: { display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "stretch", marginBottom: "16px" },
  logo: { fontSize: "14px", fontWeight: "800", color: "#0369a1", marginBottom: "6px" },
  title: { margin: 0, fontSize: "34px", fontWeight: "900" },
  subTitle: { margin: "8px 0 0", color: "#4b5563", lineHeight: 1.55 },
  accountBox: { minWidth: "260px", background: "#111827", color: "white", borderRadius: "18px", padding: "18px", boxShadow: "0 10px 26px rgba(15,23,42,0.16)" },
  accountLine: { fontSize: "13px", color: "#9ca3af", marginBottom: "8px" },
  accountId: { fontSize: "20px", fontWeight: "900", letterSpacing: "-0.02em" },
  accountPin: { marginTop: "8px", color: "#fbbf24", fontWeight: "800" },
  loginPanel: { background: "white", border: "1px solid #e5e7eb", borderRadius: "18px", padding: "14px", marginBottom: "16px", display: "grid", gridTemplateColumns: "1.5fr 0.8fr auto auto", gap: "10px" },
  loginInput: { border: "1px solid #d1d5db", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", minWidth: 0 },
  primaryButton: { border: 0, background: "#2563eb", color: "white", borderRadius: "12px", padding: "12px 16px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" },
  darkButton: { border: 0, background: "#111827", color: "white", borderRadius: "12px", padding: "12px 16px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" },
  outlineButton: { border: "1px solid #d1d5db", background: "white", color: "#111827", borderRadius: "12px", padding: "12px 16px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" },
  assetGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px", marginBottom: "16px" },
  assetCard: { background: "white", border: "1px solid #e5e7eb", borderRadius: "18px", padding: "18px", minWidth: 0 },
  assetLabel: { color: "#6b7280", fontSize: "13px", marginBottom: "8px" },
  assetValue: { fontSize: "24px", fontWeight: "900", wordBreak: "keep-all" },
  tradeGrid: { display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) 340px", gap: "16px", alignItems: "stretch" },
  leftPanel: { background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "18px", minWidth: 0 },
  centerPanel: { background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "18px", minWidth: 0 },
  orderPanel: { background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "18px", minWidth: 0 },
  panelTitle: { fontSize: "18px", fontWeight: "900", margin: 0 },
  panelTitleWithMargin: { fontSize: "18px", fontWeight: "900", margin: "0 0 14px" },
  smallTitle: { fontSize: "13px", color: "#6b7280", margin: "18px 0 8px" },
  searchBox: { display: "grid", gridTemplateColumns: "1fr 48px", gap: "8px" },
  input: { width: "100%", border: "1px solid #d1d5db", borderRadius: "12px", padding: "11px 12px", fontSize: "14px", boxSizing: "border-box", minWidth: 0 },
  searchButton: { border: 0, background: "#0f766e", color: "white", borderRadius: "12px", padding: "0 10px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap", wordBreak: "keep-all", minWidth: "48px" },
  stockList: { display: "grid", gap: "8px" },
  stockButton: { border: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: "14px", padding: "12px", display: "flex", justifyContent: "space-between", cursor: "pointer", fontWeight: "800" },
  stockButtonActive: { borderColor: "#2563eb", background: "#eff6ff", color: "#1d4ed8", boxShadow: "inset 0 0 0 1px #2563eb" },
  quoteHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "16px", marginBottom: "16px" },
  stockName: { fontSize: "26px", fontWeight: "900" },
  stockCode: { color: "#6b7280", marginTop: "4px" },
  priceArea: { textAlign: "right" },
  nowPrice: { fontSize: "32px", fontWeight: "900" },
  upText: { color: "#dc2626" },
  downText: { color: "#2563eb" },
  chartPanel: { background: "#0b1220", borderRadius: "18px", padding: "16px", overflow: "hidden" },
  chartToolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "white", marginBottom: "12px" },
  chartSubText: { marginLeft: "8px", color: "#9ca3af", fontSize: "12px" },
  chartWarning: { background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24", borderRadius: "10px", padding: "8px 10px", fontSize: "12px", marginBottom: "10px" },
  chartRefreshButton: { border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "white", borderRadius: "10px", padding: "8px 10px", fontSize: "12px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" },
  realChart: { height: "330px", position: "relative", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.18)" },
  chartEmpty: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "14px" },
  candleChart: { height: "100%", display: "flex", gap: "6px", alignItems: "stretch", padding: "10px 4px 28px", boxSizing: "border-box", position: "relative" },
  realCandleWrap: { flex: 1, minWidth: "6px", position: "relative" },
  wick: { position: "absolute", left: "50%", width: "2px", transform: "translateX(-50%)", borderRadius: "999px" },
  realCandle: { position: "absolute", left: "18%", right: "18%", borderRadius: "3px" },
  timeLabel: { position: "absolute", left: "50%", bottom: "-22px", transform: "translateX(-50%)", color: "#9ca3af", fontSize: "10px", whiteSpace: "nowrap" },
  tradeMarker: { position: "absolute", transform: "translate(-50%, -50%)", zIndex: 5, borderRadius: "999px", padding: "4px 7px", color: "white", fontSize: "10px", fontWeight: "900", boxShadow: "0 4px 10px rgba(0,0,0,0.35)", pointerEvents: "auto" },
  buyMarker: { background: "#dc2626" },
  sellMarker: { background: "#2563eb" },
  fomoBox: { marginTop: "16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "16px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" },
  fomoScore: { width: "64px", height: "64px", borderRadius: "999px", background: "#f59e0b", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", fontWeight: "900", flex: "0 0 auto" },
  tabRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" },
  tabButton: { border: "1px solid #d1d5db", background: "#f9fafb", borderRadius: "12px", padding: "12px", fontWeight: "900", cursor: "pointer" },
  buyTabActive: { border: "1px solid #ef4444", background: "#fee2e2", color: "#dc2626", borderRadius: "12px", padding: "12px", fontWeight: "900", cursor: "pointer" },
  sellTabActive: { border: "1px solid #2563eb", background: "#dbeafe", color: "#2563eb", borderRadius: "12px", padding: "12px", fontWeight: "900", cursor: "pointer" },
  label: { display: "block", fontSize: "13px", fontWeight: "800", color: "#374151", margin: "12px 0 6px" },
  holdingInfo: { marginTop: "8px", padding: "10px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "12px", color: "#1d4ed8", fontSize: "13px", fontWeight: "800" },
  orderInfo: { marginTop: "12px", background: "#f9fafb", borderRadius: "14px", padding: "12px", display: "grid", gap: "8px" },
  textarea: { width: "100%", minHeight: "86px", border: "1px solid #d1d5db", borderRadius: "12px", padding: "11px 12px", fontSize: "14px", resize: "vertical", boxSizing: "border-box" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  buyButton: { width: "100%", border: 0, background: "#dc2626", color: "white", borderRadius: "14px", padding: "15px", fontSize: "16px", fontWeight: "900", marginTop: "16px", cursor: "pointer" },
  sellButton: { width: "100%", border: 0, background: "#2563eb", color: "white", borderRadius: "14px", padding: "15px", fontSize: "16px", fontWeight: "900", marginTop: "16px", cursor: "pointer" },
  orderStatus: { marginTop: "12px", textAlign: "center", fontWeight: "900", color: "#0f766e" },
  bottomGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" },
  tablePanel: { background: "white", border: "1px solid #e5e7eb", borderRadius: "20px", padding: "18px", overflowX: "hidden", minWidth: 0 },
  empty: { padding: "30px", background: "#f9fafb", borderRadius: "14px", color: "#6b7280", textAlign: "center" },
  table: { display: "grid", gap: "8px", minWidth: 0 },
  tableHead: { display: "grid", gridTemplateColumns: "1.1fr 0.45fr 0.9fr 0.9fr 0.9fr 0.9fr", padding: "10px", color: "#6b7280", fontSize: "13px", borderBottom: "1px solid #e5e7eb", gap: "8px" },
  tableRow: { display: "grid", gridTemplateColumns: "1.1fr 0.45fr 0.9fr 0.9fr 0.9fr 0.9fr", padding: "12px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", gap: "8px", alignItems: "center" },
  codeText: { color: "#6b7280", fontSize: "12px", fontStyle: "normal" },
  orderList: { display: "grid", gap: "10px" },
  orderItem: { display: "flex", justifyContent: "space-between", gap: "14px", background: "#f9fafb", borderRadius: "14px", padding: "14px" },
  orderItemRight: { textAlign: "right", whiteSpace: "nowrap" },
  panelTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" },
  miniButton: { border: "1px solid #d1d5db", background: "white", color: "#111827", borderRadius: "10px", padding: "7px 10px", fontSize: "12px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" },
};
