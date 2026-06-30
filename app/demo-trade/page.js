"use client";

import { useEffect, useMemo, useState } from "react";

export default function DemoTradePage() {
  const [code, setCode] = useState("005930");
  const [stockName, setStockName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [holdingDays, setHoldingDays] = useState("7");
  const [loading, setLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState("");
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("demoTradeRecords");
    if (saved) {
      setRecords(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("demoTradeRecords", JSON.stringify(records));
  }, [records]);

  const totalAmount = useMemo(() => {
    const p = Number(price || 0);
    const q = Number(quantity || 0);
    return p * q;
  }, [price, quantity]);

  const fomoScore = useMemo(() => {
    let score = 0;

    const text = reason.toLowerCase();

    if (text.includes("급등") || text.includes("놓칠") || text.includes("막차")) score += 25;
    if (text.includes("뉴스") || text.includes("호재")) score += 15;
    if (!stopLossPrice) score += 20;
    if (!targetPrice) score += 10;
    if (Number(holdingDays) <= 3) score += 15;
    if (Number(quantity) > 0 && totalAmount >= 1000000) score += 15;

    return Math.min(score, 100);
  }, [reason, stopLossPrice, targetPrice, holdingDays, quantity, totalAmount]);

  function getFomoLabel(score) {
    if (score >= 70) return "위험";
    if (score >= 40) return "주의";
    return "낮음";
  }

  async function fetchPrice() {
    if (!code) {
      alert("종목코드를 입력하세요.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/kis/price?code=${code}`);
      const data = await res.json();

      if (!data.ok) {
        alert("현재가 조회 실패: " + (data.error || "알 수 없는 오류"));
        return;
      }

      setPrice(data.price || "");
      setStockName(data.name || "");
    } catch (error) {
      alert("현재가 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVirtualBuy() {
    if (!code || !price || !quantity || !reason) {
      alert("종목코드, 현재가, 수량, 매수 이유는 필수입니다.");
      return;
    }

    setOrderStatus("주문 접수 중...");

    setTimeout(() => {
      setOrderStatus("가상 체결 중...");
    }, 700);

    setTimeout(() => {
      const newRecord = {
        id: Date.now(),
        code,
        stockName,
        price: Number(price),
        quantity: Number(quantity),
        totalAmount,
        reason,
        targetPrice,
        stopLossPrice,
        holdingDays,
        fomoScore,
        fomoLabel: getFomoLabel(fomoScore),
        createdAt: new Date().toISOString(),
      };

      setRecords([newRecord, ...records]);
      setOrderStatus("가상 매수 완료");

      setTimeout(() => {
        setOrderStatus("");
      }, 1200);
    }, 1500);
  }

  function deleteRecord(id) {
    const next = records.filter((item) => item.id !== id);
    setRecords(next);
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.badge}>우량주 스카우터 실험 기능</p>
        <h1 style={styles.title}>매수 전 시뮬레이션</h1>
        <p style={styles.desc}>
          이 기능은 수익을 내기 위한 모의투자가 아닙니다. 실제 돈을 넣기 전에
          충동 매수와 FOMO를 줄이기 위한 가상매수 테스트입니다.
        </p>
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>1. 종목 선택</h2>

          <label style={styles.label}>종목코드</label>
          <div style={styles.row}>
            <input
              style={styles.input}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: 005930"
            />
            <button style={styles.button} onClick={fetchPrice} disabled={loading}>
              {loading ? "조회 중" : "현재가 조회"}
            </button>
          </div>

          {price && (
            <div style={styles.priceBox}>
              <p style={styles.stockName}>{stockName || code}</p>
              <p style={styles.price}>{Number(price).toLocaleString()}원</p>
            </div>
          )}

          <label style={styles.label}>수량</label>
          <input
            style={styles.input}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <div style={styles.totalBox}>
            예상 가상 매수금액:{" "}
            <strong>{totalAmount.toLocaleString()}원</strong>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>2. 매수 이유 기록</h2>

          <label style={styles.label}>왜 지금 이 종목을 사고 싶은가?</label>
          <textarea
            style={styles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 최근 급등해서 더 늦으면 못 살 것 같음 / 랭킹 상위라서 관심 생김 / 뉴스 보고 매수하고 싶어짐"
          />

          <label style={styles.label}>목표가</label>
          <input
            style={styles.input}
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="예: 380000"
          />

          <label style={styles.label}>손절가</label>
          <input
            style={styles.input}
            value={stopLossPrice}
            onChange={(e) => setStopLossPrice(e.target.value)}
            placeholder="예: 310000"
          />

          <label style={styles.label}>예상 보유 기간</label>
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
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>3. FOMO 위험도</h2>

          <div style={styles.scoreCircle}>
            <span>{fomoScore}</span>
            <small>/ 100</small>
          </div>

          <p style={styles.fomoLabel}>
            현재 판단: <strong>{getFomoLabel(fomoScore)}</strong>
          </p>

          <ul style={styles.list}>
            <li>손절가가 없으면 위험도가 올라갑니다.</li>
            <li>뉴스, 급등, 막차 심리가 강하면 FOMO 가능성이 높습니다.</li>
            <li>보유 기간이 너무 짧으면 충동 매수일 가능성이 있습니다.</li>
          </ul>

          <button style={styles.buyButton} onClick={handleVirtualBuy}>
            가상 매수하기
          </button>

          {orderStatus && <p style={styles.status}>{orderStatus}</p>}
        </div>
      </section>

      <section style={styles.history}>
        <h2 style={styles.sectionTitle}>가상매수 기록</h2>

        {records.length === 0 ? (
          <div style={styles.empty}>
            아직 가상매수 기록이 없습니다. 실제 매수 전에 먼저 테스트해보세요.
          </div>
        ) : (
          <div style={styles.recordList}>
            {records.map((item) => (
              <div key={item.id} style={styles.recordCard}>
                <div>
                  <strong>{item.stockName || item.code}</strong>
                  <p style={styles.recordMeta}>
                    {new Date(item.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>

                <div style={styles.recordBody}>
                  <p>
                    매수가: {item.price.toLocaleString()}원 / 수량:{" "}
                    {item.quantity}주
                  </p>
                  <p>금액: {item.totalAmount.toLocaleString()}원</p>
                  <p>FOMO 위험도: {item.fomoScore}점 ({item.fomoLabel})</p>
                  <p>매수 이유: {item.reason}</p>
                </div>

                <button style={styles.deleteButton} onClick={() => deleteRecord(item.id)}>
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "40px 20px 80px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif",
    color: "#111827",
  },
  hero: {
    background: "linear-gradient(135deg, #102a43, #1f7a8c)",
    color: "white",
    borderRadius: "24px",
    padding: "36px",
    marginBottom: "28px",
  },
  badge: {
    display: "inline-block",
    background: "rgba(255,255,255,0.16)",
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "14px",
    marginBottom: "12px",
  },
  title: {
    fontSize: "34px",
    margin: "0 0 12px",
    fontWeight: "800",
  },
  desc: {
    fontSize: "17px",
    lineHeight: "1.7",
    maxWidth: "760px",
    margin: 0,
    opacity: 0.94,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },
  cardTitle: {
    fontSize: "20px",
    margin: "0 0 18px",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: "700",
    margin: "14px 0 8px",
  },
  row: {
    display: "flex",
    gap: "8px",
  },
  input: {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "15px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    height: "120px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "15px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  button: {
    whiteSpace: "nowrap",
    border: "0",
    borderRadius: "12px",
    padding: "0 16px",
    background: "#0f766e",
    color: "white",
    fontWeight: "700",
    cursor: "pointer",
  },
  priceBox: {
    marginTop: "16px",
    padding: "16px",
    background: "#f0fdfa",
    borderRadius: "14px",
  },
  stockName: {
    margin: 0,
    fontSize: "14px",
    color: "#0f766e",
    fontWeight: "700",
  },
  price: {
    margin: "4px 0 0",
    fontSize: "28px",
    fontWeight: "800",
  },
  totalBox: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "12px",
    background: "#f9fafb",
  },
  scoreCircle: {
    width: "140px",
    height: "140px",
    borderRadius: "999px",
    background: "#fef3c7",
    color: "#92400e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "10px auto 14px",
    fontWeight: "900",
  },
  fomoLabel: {
    textAlign: "center",
    fontSize: "18px",
  },
  list: {
    fontSize: "14px",
    lineHeight: "1.7",
    paddingLeft: "20px",
    color: "#4b5563",
  },
  buyButton: {
    width: "100%",
    marginTop: "16px",
    border: "0",
    borderRadius: "14px",
    padding: "15px",
    background: "#111827",
    color: "white",
    fontSize: "16px",
    fontWeight: "800",
    cursor: "pointer",
  },
  status: {
    marginTop: "14px",
    textAlign: "center",
    color: "#0f766e",
    fontWeight: "800",
  },
  history: {
    marginTop: "34px",
  },
  sectionTitle: {
    fontSize: "24px",
    marginBottom: "16px",
  },
  empty: {
    background: "#f9fafb",
    border: "1px dashed #d1d5db",
    borderRadius: "18px",
    padding: "28px",
    textAlign: "center",
    color: "#6b7280",
  },
  recordList: {
    display: "grid",
    gap: "14px",
  },
  recordCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
  },
  recordMeta: {
    margin: "4px 0 12px",
    color: "#6b7280",
    fontSize: "13px",
  },
  recordBody: {
    fontSize: "14px",
    lineHeight: "1.6",
  },
  deleteButton: {
    marginTop: "10px",
    border: "1px solid #ef4444",
    background: "white",
    color: "#ef4444",
    borderRadius: "10px",
    padding: "8px 12px",
    cursor: "pointer",
  },
};
