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
            <input
              style={styles.input}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="종목코드 예: 005930"
            />
            <button style={styles.searchButton} onClick={() => fetchPrice(code, name)}>
              {loadingPrice ? "조회" : "조회"}
            </button>
          </div>

          <h3 style={styles.smallTitle}>인기 종목</h3>

          <div style={styles.stockList}>
            {POPULAR_STOCKS.map((stock) => (
              <button
                key={stock.code}
                style={{
                  ...styles.stockButton,
                  ...(stock.code === code ? styles.stockButtonActive : {}),
                }}
                onClick={() => selectStock(stock)}
              >
                <span>{stock.name}</span>
                <em>{stock.code}</em>
              </button>
            ))}
          </div>
        </aside>

        <section style={styles.centerPanel}>
          <div style={styles.quoteHeader}>
            <div>
              <div style={styles.stockName}>{name || code}</div>
              <div style={styles.stockCode}>{code}</div>
            </div>

            <div style={styles.priceArea}>
              <div style={styles.nowPrice}>
                {price ? `${Number(price).toLocaleString()}원` : "-"}
              </div>
              <div style={Number(rate) >= 0 ? styles.upText : styles.downText}>
                {change ? `${Number(change).toLocaleString()}원` : "-"} /{" "}
                {rate ? `${Number(rate).toFixed(2)}%` : "-"}
              </div>
            </div>
          </div>

          <div style={styles.fakeChart}>
            <div style={styles.chartGrid}>
              {Array.from({ length: 34 }).map((_, index) => {
                const height = 30 + ((index * 17) % 120);
                const isUp = index % 3 !== 0;

                return (
                  <div key={index} style={styles.candleWrap}>
                    <div
                      style={{
                        ...styles.candle,
                        height,
                        background: isUp ? "#ef4444" : "#2563eb",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={styles.chartNotice}>
              차트는 다음 단계에서 실제 분봉/봉차트로 교체 예정
            </div>
          </div>

          <div style={styles.fomoBox}>
            <div>
              <strong>FOMO 위험도</strong>
              <p>
                매수 이유, 손절가 여부, 보유기간, 주문금액을 기준으로 충동매수 가능성을 임시 계산합니다.
              </p>
            </div>
            <div style={styles.fomoScore}>{fomoScore}</div>
          </div>
        </section>

        <aside style={styles.orderPanel}>
          <h2 style={styles.panelTitle}>주문창</h2>

          <div style={styles.tabRow}>
            <button
              style={side === "BUY" ? styles.buyTabActive : styles.tabButton}
              onClick={() => setSide("BUY")}
            >
              매수
            </button>
            <button
              style={side === "SELL" ? styles.sellTabActive : styles.tabButton}
              onClick={() => setSide("SELL")}
            >
              매도
            </button>
          </div>

          <label style={styles.label}>주문가격</label>
          <input
            style={styles.input}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="현재가"
          />

          <label style={styles.label}>수량</label>
          <input
            style={styles.input}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <div style={styles.orderInfo}>
            <div>
              <span>주문금액</span>
              <strong>{totalOrderAmount.toLocaleString()}원</strong>
            </div>
            <div>
              <span>주문 후 현금</span>
              <strong>{estimatedCash.toLocaleString()}원</strong>
            </div>
          </div>

          <label style={styles.label}>왜 지금 사거나 팔고 싶은가?</label>
          <textarea
            style={styles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 급등해서 놓칠까봐 / 랭킹 상위라서 / 손절 기준에 도달해서"
          />

          <div style={styles.twoCol}>
            <div>
              <label style={styles.label}>목표가</label>
              <input
                style={styles.input}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="선택"
              />
            </div>
            <div>
              <label style={styles.label}>손절가</label>
              <input
                style={styles.input}
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value)}
                placeholder="선택"
              />
            </div>
          </div>

          <label style={styles.label}>예상 보유기간</label>
          <select
            style={styles.input}
            value={holdingDays}
            onChange={(e) => setHoldingDays(e.target.value)}
          >
            <option value="1">1일</option>
            <option value="3">3일</option>
            <option value="7">7일</option>
            <option value="14">14일</option>
            <option value="30">30일 이상</option>
          </select>

          <button
            style={side === "BUY" ? styles.buyButton : styles.sellButton}
            onClick={submitOrder}
          >
            {side === "BUY" ? "가상 매수" : "가상 매도"}
          </button>

          {orderStatus && <div style={styles.orderStatus}>{orderStatus}</div>}
        </aside>
      </section>

      <section style={styles.bottomGrid}>
        <div style={styles.tablePanel}>
          <h2 style={styles.panelTitle}>보유종목</h2>

          {portfolioSummary.length === 0 ? (
            <div style={styles.empty}>아직 보유종목이 없습니다.</div>
          ) : (
            <div style={styles.table}>
              <div style={styles.tableHead}>
                <span>종목</span>
                <span>수량</span>
                <span>평균단가</span>
                <span>평가손익</span>
              </div>

              {portfolioSummary.map((item) => (
                <div key={item.code} style={styles.tableRow}>
                  <span>{item.name}</span>
                  <span>{item.quantity}</span>
                  <span>{Math.round(item.avgPrice).toLocaleString()}원</span>
                  <span style={item.profitLoss >= 0 ? styles.upText : styles.downText}>
                    {item.profitLoss >= 0 ? "+" : ""}
                    {Math.round(item.profitLoss).toLocaleString()}원
                    <br />
                    {item.profitRate >= 0 ? "+" : ""}
                    {item.profitRate.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.tablePanel}>
          <h2 style={styles.panelTitle}>주문/체결 내역</h2>

          {orders.length === 0 ? (
            <div style={styles.empty}>주문 내역이 없습니다.</div>
          ) : (
            <div style={styles.orderList}>
              {[...orders].reverse().map((order) => (
                <div key={order.orderId} style={styles.orderItem}>
                  <div>
                    <strong>
                      {order.side === "BUY" ? "매수" : "매도"} {order.name || order.code}
                    </strong>
                    <p>{order.reason || "매매 사유 없음"}</p>
                  </div>
                  <div style={styles.orderItemRight}>
                    <strong>{Number(order.amount || 0).toLocaleString()}원</strong>
                    <p>
                      {Number(order.price || 0).toLocaleString()}원 × {order.quantity}주
                    </p>
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
      <div
        style={{
          ...styles.assetValue,
          ...(tone === "red" ? styles.upText : {}),
          ...(tone === "blue" ? styles.downText : {}),
        }}
      >
        {value}
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: "1440px",
    margin: "0 auto",
    padding: "24px",
    background: "#f3f4f6",
    color: "#111827",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif",
    minHeight: "100vh",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "stretch",
    marginBottom: "16px",
  },
  logo: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#0369a1",
    marginBottom: "6px",
  },
  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: "900",
  },
  subTitle: {
    margin: "8px 0 0",
    color: "#4b5563",
  },
  accountBox: {
    minWidth: "260px",
    background: "#111827",
    color: "white",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 10px 26px rgba(15,23,42,0.16)",
  },
  accountLine: {
    fontSize: "13px",
    color: "#9ca3af",
    marginBottom: "8px",
  },
  accountId: {
    fontSize: "20px",
    fontWeight: "900",
    letterSpacing: "-0.02em",
  },
  accountPin: {
    marginTop: "8px",
    color: "#fbbf24",
    fontWeight: "800",
  },
  loginPanel: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "14px",
    marginBottom: "16px",
  },
  loginGroup: {
    display: "grid",
    gridTemplateColumns: "1.5fr 0.8fr auto auto",
    gap: "10px",
  },
  loginInput: {
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
  },
  primaryButton: {
    border: 0,
    background: "#2563eb",
    color: "white",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: "800",
    cursor: "pointer",
  },
  darkButton: {
    border: 0,
    background: "#111827",
    color: "white",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: "800",
    cursor: "pointer",
  },
  outlineButton: {
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: "800",
    cursor: "pointer",
  },
  assetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "14px",
    marginBottom: "16px",
  },
  assetCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
  },
  assetLabel: {
    color: "#6b7280",
    fontSize: "13px",
    marginBottom: "8px",
  },
  assetValue: {
    fontSize: "24px",
    fontWeight: "900",
  },
  tradeGrid: {
    display: "grid",
    gridTemplateColumns: "260px 1fr 340px",
    gap: "16px",
    alignItems: "stretch",
  },
  leftPanel: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "18px",
  },
  centerPanel: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "18px",
  },
  orderPanel: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "18px",
  },
  panelTitle: {
    fontSize: "18px",
    fontWeight: "900",
    margin: "0 0 14px",
  },
  smallTitle: {
    fontSize: "13px",
    color: "#6b7280",
    margin: "18px 0 8px",
  },
  searchBox: {
    display: "flex",
    gap: "8px",
  },
  input: {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "11px 12px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  searchButton: {
    border: 0,
    background: "#0f766e",
    color: "white",
    borderRadius: "12px",
    padding: "0 14px",
    fontWeight: "800",
    cursor: "pointer",
  },
  stockList: {
    display: "grid",
    gap: "8px",
  },
  stockButton: {
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    borderRadius: "14px",
    padding: "12px",
    display: "flex",
    justifyContent: "space-between",
    cursor: "pointer",
    fontWeight: "800",
  },
  stockButtonActive: {
    borderColor: "#2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  quoteHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "16px",
    marginBottom: "16px",
  },
  stockName: {
    fontSize: "26px",
    fontWeight: "900",
  },
  stockCode: {
    color: "#6b7280",
    marginTop: "4px",
  },
  priceArea: {
    textAlign: "right",
  },
  nowPrice: {
    fontSize: "32px",
    fontWeight: "900",
  },
  upText: {
    color: "#dc2626",
  },
  downText: {
    color: "#2563eb",
  },
  fakeChart: {
    height: "360px",
    background: "#0b1220",
    borderRadius: "18px",
    padding: "20px",
    position: "relative",
    overflow: "hidden",
  },
  chartGrid: {
    height: "280px",
    display: "flex",
    alignItems: "flex-end",
    gap: "9px",
    borderBottom: "1px solid rgba(255,255,255,0.18)",
  },
  candleWrap: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
  },
  candle: {
    width: "62%",
    borderRadius: "4px 4px 0 0",
  },
  chartNotice: {
    position: "absolute",
    left: "20px",
    bottom: "18px",
    color: "#9ca3af",
    fontSize: "13px",
  },
  fomoBox: {
    marginTop: "16px",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "16px",
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fomoScore: {
    width: "64px",
    height: "64px",
    borderRadius: "999px",
    background: "#f59e0b",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "26px",
    fontWeight: "900",
  },
  tabRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginBottom: "14px",
  },
  tabButton: {
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: "900",
    cursor: "pointer",
  },
  buyTabActive: {
    border: "1px solid #ef4444",
    background: "#fee2e2",
    color: "#dc2626",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: "900",
    cursor: "pointer",
  },
  sellTabActive: {
    border: "1px solid #2563eb",
    background: "#dbeafe",
    color: "#2563eb",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: "900",
    cursor: "pointer",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "800",
    color: "#374151",
    margin: "12px 0 6px",
  },
  orderInfo: {
    marginTop: "12px",
    background: "#f9fafb",
    borderRadius: "14px",
    padding: "12px",
    display: "grid",
    gap: "8px",
  },
  textarea: {
    width: "100%",
    minHeight: "86px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "11px 12px",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  buyButton: {
    width: "100%",
    border: 0,
    background: "#dc2626",
    color: "white",
    borderRadius: "14px",
    padding: "15px",
    fontSize: "16px",
    fontWeight: "900",
    marginTop: "16px",
    cursor: "pointer",
  },
  sellButton: {
    width: "100%",
    border: 0,
    background: "#2563eb",
    color: "white",
    borderRadius: "14px",
    padding: "15px",
    fontSize: "16px",
    fontWeight: "900",
    marginTop: "16px",
    cursor: "pointer",
  },
  orderStatus: {
    marginTop: "12px",
    textAlign: "center",
    fontWeight: "900",
    color: "#0f766e",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginTop: "16px",
  },
  tablePanel: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "18px",
  },
  empty: {
    padding: "30px",
    background: "#f9fafb",
    borderRadius: "14px",
    color: "#6b7280",
    textAlign: "center",
  },
  table: {
    display: "grid",
    gap: "8px",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.6fr 1fr 1fr",
    padding: "10px",
    color: "#6b7280",
    fontSize: "13px",
    borderBottom: "1px solid #e5e7eb",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.6fr 1fr 1fr",
    padding: "12px 10px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "14px",
  },
  orderList: {
    display: "grid",
    gap: "10px",
  },
  orderItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    background: "#f9fafb",
    borderRadius: "14px",
    padding: "14px",
  },
  orderItemRight: {
    textAlign: "right",
    whiteSpace: "nowrap",
  },
};
