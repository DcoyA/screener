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

export default function DemoTradePage() {
  const [account, setAccount] = useState(null);
  const [loginAccountId, setLoginAccountId] = useState("");
  const [loginPin, setLoginPin] = useState("");

  const [code, setCode] = useState("005930");
  const [name, setName] = useState("삼성전자");
  const [price, setPrice] = useState("");
  const [change, setChange] = useState("");
  const [rate, setRate] = useState("");

  const [side, setSide] = useState("BUY");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [holdingDays, setHoldingDays] = useState("7");

  const [orders, setOrders] = useState([]);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("demoTradeAccount");

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.accountId && parsed?.pin) {
          setLoginAccountId(parsed.accountId);
          setLoginPin(parsed.pin);
          loadAccount(parsed.accountId, parsed.pin);
        }
      } catch (error) {
        console.error(error);
      }
    }

    fetchPrice("005930");
  }, []);

  const totalOrderAmount = useMemo(() => {
    return Number(price || 0) * Number(quantity || 0);
  }, [price, quantity]);

  const fomoScore = useMemo(() => {
    let score = 0;
    const text = String(reason || "").toLowerCase();

    if (text.includes("급등") || text.includes("막차") || text.includes("놓칠")) score += 28;
    if (text.includes("뉴스") || text.includes("호재")) score += 15;
    if (!stopLossPrice) score += 20;
    if (!targetPrice) score += 10;
    if (Number(holdingDays) <= 3) score += 15;
    if (totalOrderAmount >= 1000000) score += 12;

    return Math.min(score, 100);
  }, [reason, stopLossPrice, targetPrice, holdingDays, totalOrderAmount]);

  const cash = Number(account?.cash || 0);

  const estimatedCash = useMemo(() => {
    if (!account) return 0;
    if (side === "BUY") return cash - totalOrderAmount;
    return cash + totalOrderAmount;
  }, [account, cash, side, totalOrderAmount]);

  const portfolioSummary = useMemo(() => {
    const map = {};

    orders.forEach((order) => {
      const orderCode = order.code;
      const orderName = order.name || order.code;
      const orderSide = order.side;
      const qty = Number(order.quantity || 0);
      const orderPrice = Number(order.price || 0);
      const amount = Number(order.amount || orderPrice * qty);

      if (!map[orderCode]) {
        map[orderCode] = {
          code: orderCode,
          name: orderName,
          quantity: 0,
          buyAmount: 0,
        };
      }

      if (orderSide === "BUY") {
        map[orderCode].quantity += qty;
        map[orderCode].buyAmount += amount;
      }

      if (orderSide === "SELL") {
        map[orderCode].quantity -= qty;
        map[orderCode].buyAmount -= amount;
      }
    });

    return Object.values(map)
      .filter((item) => item.quantity > 0)
      .map((item) => {
        const avgPrice = item.quantity > 0 ? item.buyAmount / item.quantity : 0;
        const currentPrice = item.code === code ? Number(price || avgPrice) : avgPrice;
        const evalAmount = currentPrice * item.quantity;
        const profitLoss = evalAmount - item.buyAmount;
        const profitRate = item.buyAmount > 0 ? (profitLoss / item.buyAmount) * 100 : 0;

        return {
          ...item,
          avgPrice,
          currentPrice,
          evalAmount,
          profitLoss,
          profitRate,
        };
      });
  }, [orders, code, price]);

  const totalEvalAmount = portfolioSummary.reduce((sum, item) => sum + item.evalAmount, 0);
  const totalBuyAmount = portfolioSummary.reduce((sum, item) => sum + item.buyAmount, 0);
  const totalProfitLoss = totalEvalAmount - totalBuyAmount;
  const totalProfitRate = totalBuyAmount > 0 ? (totalProfitLoss / totalBuyAmount) * 100 : 0;
  const totalAsset = cash + totalEvalAmount;

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
    } catch (error) {
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
      const res = await fetch(
        `/api/demo/account/load?accountId=${encodeURIComponent(targetAccountId)}&pin=${encodeURIComponent(targetPin)}`
      );
      const data = await res.json();

      if (!data.ok) {
        alert(data.error || "가상계좌 불러오기 실패");
        return;
      }

      setAccount(data.account);
      localStorage.setItem("demoTradeAccount", JSON.stringify({
        accountId: targetAccountId,
        pin: targetPin,
      }));

      await loadOrders(targetAccountId, targetPin);
    } catch (error) {
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
      const res = await fetch(
        `/api/demo/order/list?accountId=${encodeURIComponent(targetAccountId)}&pin=${encodeURIComponent(targetPin)}`
      );
      const data = await res.json();

      if (data.ok) {
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function fetchPrice(targetCode = code, targetName = name) {
    if (!targetCode) {
      alert("종목코드를 입력하세요.");
      return;
    }

    setLoadingPrice(true);

    try {
      const res = await fetch(`/api/kis/price?code=${encodeURIComponent(targetCode)}`);
      const data = await res.json();

      if (!data.ok) {
        alert(data.error || "현재가 조회 실패");
        return;
      }

      setCode(targetCode);
      setName(data.name || targetName || targetCode);
      setPrice(data.price || "");
      setChange(data.change || "");
      setRate(data.rate || "");
    } catch (error) {
      alert("현재가 조회 중 오류가 발생했습니다.");
    } finally {
      setLoadingPrice(false);
    }
  }

  function selectStock(stock) {
    setCode(stock.code);
    setName(stock.name);
    fetchPrice(stock.code, stock.name);
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

    if (side === "BUY" && totalOrderAmount > cash) {
      alert("가상 현금이 부족합니다.");
      return;
    }

    setOrderStatus("주문 접수 중...");

    setTimeout(() => {
      setOrderStatus("가상 체결 중...");
    }, 600);

    setTimeout(async () => {
      try {
        const res = await fetch("/api/demo/order/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountId: account.accountId,
            pin: account.pin,
            side,
            code,
            name,
            price: Number(price),
            quantity: Number(quantity),
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

        await loadOrders(account.accountId, account.pin);

        setTimeout(() => {
          setOrderStatus("");
        }, 1200);
      } catch (error) {
        alert("주문 처리 중 오류가 발생했습니다.");
        setOrderStatus("");
      }
    }, 1200);
  }

  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
        <div>
          <div style={styles.logo}>우량주 스카우터</div>
          <h1 style={styles.title}>가상투자 터미널</h1>
          <p style={styles.subTitle}>
            진짜 돈을 넣기 전, 가상계좌로 매수 판단을 먼저 검증하세요.
          </p>
        </div>

        <div style={styles.accountBox}>
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

      <section style={styles.loginPanel}>
        <div style={styles.loginGroup}>
          <input
            style={styles.loginInput}
            value={loginAccountId}
            onChange={(e) => setLoginAccountId(e.target.value)}
            placeholder="가상계좌번호 DEMO-XXXX-XXXX"
          />
          <input
            style={styles.loginInput}
            value={loginPin}
            onChange={(e) => setLoginPin(e.target.value)}
            placeholder="PIN 4자리"
          />
          <button style={styles.darkButton} onClick={() => loadAccount()} disabled={loadingAccount}>
            {loadingAccount ? "조회 중" : "계좌 불러오기"}
          </button>
          <button style={styles.outlineButton} onClick={createAccount}>
            새 계좌 발급
          </button>
        </div>
      </section>

      <section style={styles.assetGrid}>
        <AssetCard label="총자산" value={`${totalAsset.toLocaleString()}원`} />
        <AssetCard label="가상현금" value={`${cash.toLocaleString()}원`} />
        <AssetCard label="평가금액" value={`${totalEvalAmount.toLocaleString()}원`} />
        <AssetCard
          label="전체수익률"
          value={`${totalProfitRate >= 0 ? "+" : ""}${totalProfitRate.toFixed(2)}%`}
          tone={totalProfitRate >= 0 ? "red" : "blue"}
        />
      </section>

      <section style={styles.tradeGrid}>
        <aside style={styles.leftPanel}>
          <h2 style={styles.panelTitle}>종목 검색</h2>

          <div style={styles.searchBox}>
