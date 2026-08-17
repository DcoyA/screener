"use client";

import { styles } from "../styles";
import { formatWon } from "../lib/format";

export default function AccountPanel({ account, authUser, resetting, onKakaoLogin, onReset }) {
  return (
    <div style={styles.accountBox} className="dt-account-box">
      {account ? (
        <>
          <div style={styles.accountLine}>가상계좌</div>
          <div style={styles.accountId}>{account.accountId}</div>
          <div style={styles.accountPin}>현금 {formatWon(account.cash)}</div>
          <button style={styles.linkButton} disabled={resetting} onClick={onReset}>
            {resetting ? "초기화 중..." : "가상계좌 초기화"}
          </button>
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
