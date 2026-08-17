"use client";

import { styles } from "../styles";
import { formatWon, normalizeSide, toNumber } from "../lib/format";

export default function OrderHistoryList({ orders }) {
  return (
    <div style={styles.tablePanel}>
      <h2 style={styles.panelTitleWithMargin}>주문/체결 내역</h2>
      {orders.length === 0 ? (
        <div style={styles.empty}>주문 내역이 없습니다.</div>
      ) : (
        <div style={styles.orderList}>
          {[...orders].reverse().map((order) => (
            <div key={order.orderId} style={styles.orderItem} className="dt-order-item">
              <div>
                <strong style={normalizeSide(order.side) === "BUY" ? styles.upText : styles.downText}>
                  {normalizeSide(order.side) === "BUY" ? "매수" : "매도"} {order.name || order.code}
                </strong>
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
  );
}
