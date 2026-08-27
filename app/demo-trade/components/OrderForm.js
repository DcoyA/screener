"use client";

import { styles } from "../styles";
import { formatWon } from "../lib/format";

export default function OrderForm({
  account,
  authUser,
  onKakaoLogin,
  side,
  onSideChange,
  price,
  onPriceChange,
  quantity,
  onQuantityChange,
  selectedHoldingQuantity,
  totalOrderAmount,
  estimatedCash,
  reason,
  onReasonChange,
  targetPrice,
  onTargetPriceChange,
  stopLossPrice,
  onStopLossPriceChange,
  holdingDays,
  onHoldingDaysChange,
  onSubmit,
  orderStatus,
  canOrder,
  orderDisabledReason,
}) {
  return (
    <aside style={styles.orderPanel}>
      <h2 style={styles.panelTitle}>주문창</h2>
      {!account && (
        <div style={styles.orderLockOverlay}>
          {authUser ? (
            <p>계좌를 불러오는 중입니다...</p>
          ) : (
            <>
              <p>로그인하면 가상계좌가 자동으로 만들어져요.</p>
              <button style={styles.primaryButton} onClick={onKakaoLogin}>
                카카오로 로그인하기
              </button>
            </>
          )}
        </div>
      )}
      <div style={!account ? styles.orderPanelDisabled : undefined}>
        <div style={styles.tabRow}>
          <button style={side === "BUY" ? styles.buyTabActive : styles.tabButton} onClick={() => onSideChange("BUY")}>매수</button>
          <button style={side === "SELL" ? styles.sellTabActive : styles.tabButton} onClick={() => onSideChange("SELL")}>매도</button>
        </div>

        <label style={styles.label}>주문가격</label>
        <input style={styles.input} value={price} onChange={(event) => onPriceChange(event.target.value)} placeholder="현재가" />

        <label style={styles.label}>수량</label>
        <input style={styles.input} type="number" min="1" value={quantity} onChange={(event) => onQuantityChange(event.target.value)} />

        {side === "SELL" && (
          <div style={styles.holdingInfo}>현재 보유수량: <strong>{selectedHoldingQuantity.toLocaleString()}주</strong></div>
        )}

        <div style={styles.orderInfo}>
          <div><span>주문금액</span><strong>{formatWon(totalOrderAmount)}</strong></div>
          <div><span>주문 후 현금</span><strong style={estimatedCash < 0 ? styles.downText : undefined}>{formatWon(estimatedCash)}</strong></div>
        </div>

        <label style={styles.label}>왜 지금 사거나 팔고 싶은가?</label>
        <textarea
          style={styles.textarea}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="예: 급등해서 놓칠까봐 / 랭킹 상위라서 / 손절 기준에 도달해서"
        />

        <div style={styles.twoCol}>
          <div>
            <label style={styles.label}>목표가</label>
            <input style={styles.input} value={targetPrice} onChange={(event) => onTargetPriceChange(event.target.value)} placeholder="선택" />
          </div>
          <div>
            <label style={styles.label}>손절가</label>
            <input style={styles.input} value={stopLossPrice} onChange={(event) => onStopLossPriceChange(event.target.value)} placeholder="선택" />
          </div>
        </div>

        <label style={styles.label}>예상 보유기간</label>
        <select style={styles.input} value={holdingDays} onChange={(event) => onHoldingDaysChange(event.target.value)}>
          <option value="1">1일</option>
          <option value="3">3일</option>
          <option value="7">7일</option>
          <option value="14">14일</option>
          <option value="30">30일 이상</option>
        </select>

        <button
          style={{
            ...(side === "BUY" ? styles.buyButton : styles.sellButton),
            ...(canOrder ? undefined : { opacity: 0.5, cursor: "not-allowed" }),
          }}
          onClick={onSubmit}
          disabled={!canOrder}
        >
          {side === "BUY" ? "가상 매수" : "가상 매도"}
        </button>
        {!canOrder && orderDisabledReason ? (
          <div style={{ ...styles.orderStatus, color: "#b45309" }}>{orderDisabledReason}</div>
        ) : null}
        {orderStatus && <div style={styles.orderStatus}>{orderStatus}</div>}
      </div>
    </aside>
  );
}
