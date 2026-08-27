"use client";

import { useState } from "react";
import { styles } from "../styles";
import { formatWon } from "../lib/format";

export default function AccountPanel({ account, authUser, resetting, onKakaoLogin, onReset }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={styles.accountBox} className="dt-account-box">
      {account ? (
        <>
          <div style={styles.accountLine}>가상계좌</div>
          <div style={styles.accountId}>{account.accountId}</div>
          <div style={styles.accountPin}>현금 {formatWon(account.cash)}</div>

          {/* 초기화는 이력이 통째로 날아가므로 위계를 낮추고 2단계 확인을 붙인다. */}
          <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            {confirming ? (
              <div style={{ fontSize: "12px", color: "var(--ruby-300)" }}>
                <div style={{ marginBottom: "8px" }}>초기화하면 주문·보유 이력이 모두 삭제돼요. 되돌릴 수 없어요.</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    style={{ ...styles.miniButton, background: "var(--ruby-800)" }}
                    onClick={() => setConfirming(false)}
                    disabled={resetting}
                  >
                    취소
                  </button>
                  <button
                    style={{ ...styles.miniButton, background: "var(--signal-up)" }}
                    onClick={async () => {
                      await onReset();
                      setConfirming(false);
                    }}
                    disabled={resetting}
                  >
                    {resetting ? "초기화 중…" : "초기화 확정"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "12px",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                }}
                onClick={() => setConfirming(true)}
              >
                계좌 초기화
              </button>
            )}
          </div>
        </>
      ) : authUser ? (
        <div style={styles.accountLine}>계좌를 불러오는 중입니다...</div>
      ) : (
        <>
          <div style={styles.accountLine}>로그인이 필요합니다</div>
          <button style={styles.primaryButton} onClick={onKakaoLogin}>
            카카오로 로그인하고 시작하기
          </button>
        </>
      )}
    </div>
  );
}
