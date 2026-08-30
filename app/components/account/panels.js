"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getWishlist, removeFromWishlist } from "../../lib/wishlist";
import { cleanStockName } from "../../lib/stockName";

// 마이페이지(계정 모달 + /me 풀페이지)가 공유하는 패널들. 스타일은 인라인
// (--ruby-* / --ink-* 토큰). 숫자는 tabular-nums.

const card = {
  border: "1px solid var(--ink-200)",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
};
const label = { display: "block", marginBottom: 4, color: "var(--ink-600)", fontSize: "var(--font-caption)", fontWeight: 700 };
const value = { color: "var(--ink-900)", fontSize: "var(--font-body)", fontWeight: 700, fontVariantNumeric: "tabular-nums" };
const outlineBtn = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  borderRadius: "var(--radius-pill)",
  border: "1px solid var(--ruby-700)",
  background: "#fff",
  color: "var(--ruby-700)",
  fontWeight: 800,
  fontSize: "var(--font-body)",
  textDecoration: "none",
  cursor: "pointer",
};
const muted = { margin: 0, color: "var(--ink-600)", fontSize: "var(--font-caption)", lineHeight: 1.7 };

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

function providerLabel(p) {
  if (!p) return "-";
  if (p === "kakao") return "카카오";
  return p;
}

// ── 내 정보 ─────────────────────────────────────────────
export function MyInfoPanel({ overview }) {
  if (overview && !overview.loggedIn) return <LoggedOutNotice />;
  const u = overview?.user;
  return (
    <div style={{ ...card, display: "grid", gap: 14 }}>
      <div>
        <span style={label}>아이디 (이메일)</span>
        <strong style={value}>{u?.email || "-"}</strong>
      </div>
      <div>
        <span style={label}>가입일</span>
        <strong style={value}>{formatDate(u?.createdAt)}</strong>
      </div>
      <div>
        <span style={label}>로그인 수단</span>
        <strong style={value}>{providerLabel(u?.provider)}</strong>
      </div>
      <p style={muted}>이메일·로그인 수단은 카카오 계정에서 관리됩니다. 이 화면에서는 변경할 수 없습니다.</p>
    </div>
  );
}

// ── 관심종목 (컴팩트) ──────────────────────────────────
export function CompactWishlistPanel() {
  const [state, setState] = useState("loading"); // loading | list
  const [items, setItems] = useState([]);

  const refresh = () => getWishlist().then((list) => { setItems(list || []); setState("list"); });
  useEffect(() => { refresh(); }, []);

  const onRemove = async (code) => {
    const res = await removeFromWishlist(code);
    if (res?.ok) setItems((prev) => prev.filter((it) => String(it.code) !== String(code)));
  };

  if (state === "loading") return <p style={muted}>불러오는 중…</p>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 28 }}>
          <p style={{ margin: "0 0 4px", color: "var(--ink-900)", fontWeight: 800, fontSize: "var(--font-body)" }}>관심종목을 등록하세요</p>
          <p style={{ ...muted, marginBottom: 16 }}>데일리 Top10이나 종목 상세에서 ☆ 를 누르면 여기에 모여요.</p>
          <Link href="/screener?tab=ranking" style={outlineBtn}>데일리 Top10 보기</Link>
        </div>
      ) : (
        items.map((it) => (
          <div key={it.code} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "14px 16px" }}>
            <div>
              <strong style={{ color: "var(--ink-900)", fontSize: "var(--font-body)", fontWeight: 800 }}>{cleanStockName(it.name || it.code)}</strong>
              <p style={{ margin: "2px 0 0", ...muted, fontVariantNumeric: "tabular-nums" }}>{it.code}</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link href={`/stock/${it.code}`} style={{ ...outlineBtn, padding: "8px 12px", fontSize: "var(--font-caption)" }}>상세보기</Link>
              <button type="button" onClick={() => onRemove(it.code)} style={{ ...outlineBtn, padding: "8px 12px", fontSize: "var(--font-caption)", borderColor: "var(--ink-300)", color: "var(--ink-600)" }}>제거</button>
            </div>
          </div>
        ))
      )}
      <p style={muted}>이 목록은 로그인 계정에 저장되어, 다른 기기에서도 같은 목록을 볼 수 있습니다.</p>
    </div>
  );
}

// ── 프리미엄 구독 ───────────────────────────────────────
export function SubscriptionPanel({ overview }) {
  if (overview && !overview.loggedIn) return <LoggedOutNotice />;
  const s = overview?.subscription;

  return (
    <div style={{ ...card, display: "grid", gap: 12 }}>
      {s?.isSubscriber ? (
        <>
          <div>
            <span style={label}>구독 상태</span>
            <strong style={{ ...value, color: "var(--ruby-700)" }}>구독 중</strong>
          </div>
          <div>
            <span style={label}>최근 수신</span>
            <strong style={value}>{formatDate(s.lastSentAt)}</strong>
          </div>
          {s.unsubscribeUrl ? (
            <Link href={s.unsubscribeUrl} style={{ ...outlineBtn, borderColor: "var(--ink-300)", color: "var(--ink-600)", width: "fit-content" }}>구독 해지</Link>
          ) : null}
        </>
      ) : (
        <>
          <div>
            <span style={label}>구독 상태</span>
            <strong style={value}>{s?.status === "unsubscribed" ? "해지됨" : "구독 안 함"}</strong>
          </div>
          <Link href="/reports" style={{ ...outlineBtn, width: "fit-content" }}>구독 신청하기</Link>
        </>
      )}
      <p style={muted}>프리미엄 리포트는 현재 결제 없이 이메일 기준으로 운영됩니다. 플랜·결제일 구분은 없습니다.</p>
    </div>
  );
}

// ── 리포트 히스토리 ─────────────────────────────────────
export function ReportHistoryPanel({ overview, onNavigate }) {
  if (overview && !overview.loggedIn) return <LoggedOutNotice />;
  const isSubscriber = overview?.subscription?.isSubscriber;
  const reports = overview?.reports || [];

  if (!isSubscriber) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 28 }}>
        <p style={{ margin: "0 0 4px", color: "var(--ink-900)", fontWeight: 800, fontSize: "var(--font-body)" }}>구독하면 지난 리포트를 다시 볼 수 있어요</p>
        <p style={{ ...muted, marginBottom: 16 }}>가입 시점과 무관하게, 구독 중이면 이전 주차 리포트도 전부 열람됩니다.</p>
        <Link href="/reports" style={outlineBtn}>구독 신청하기</Link>
      </div>
    );
  }

  if (reports.length === 0) {
    return <p style={muted}>아직 발송된 리포트가 없습니다.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {reports.map((r) => (
        <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "14px 16px" }}>
          <div>
            <strong style={{ color: "var(--ink-900)", fontSize: "var(--font-body)", fontWeight: 800 }}>{r.title || "제목 없음"}</strong>
            <p style={{ margin: "2px 0 0", ...muted, fontVariantNumeric: "tabular-nums" }}>{formatDate(r.issueDate)}</p>
          </div>
          <Link
            href={`/reports/${r.id}`}
            onClick={() => onNavigate?.()}
            style={{ ...outlineBtn, padding: "8px 12px", fontSize: "var(--font-caption)" }}
          >
            열어보기
          </Link>
        </div>
      ))}
      <p style={muted}>본문은 열 때 다시 구독 상태를 확인합니다. 발송 전 제외된 섹션은 표시되지 않습니다.</p>
    </div>
  );
}

// ── 알림설정 (준비 중) ─────────────────────────────────
export function NotificationsPanel() {
  return (
    <div style={{ ...card, textAlign: "center", padding: 28 }}>
      <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: "var(--font-body)", color: "var(--ink-900)" }}>알림 설정은 준비 중입니다</p>
      <p style={muted}>관심종목 등급 변동 알림 등은 추후 지원될 예정입니다.</p>
    </div>
  );
}

// ── 계정 관리 (스프린트 5에서 회원 탈퇴 채움) ──────────
export function AccountDangerPanel() {
  return (
    <div style={{ ...card, textAlign: "center", padding: 28 }}>
      <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: "var(--font-body)", color: "var(--ink-900)" }}>계정 관리 준비 중</p>
      <p style={muted}>회원 탈퇴 기능은 곧 제공됩니다.</p>
    </div>
  );
}

function LoggedOutNotice() {
  return (
    <div style={{ ...card, textAlign: "center", padding: 28 }}>
      <p style={{ margin: "0 0 12px", ...muted }}>로그인하면 내 정보와 구독 현황을 볼 수 있어요.</p>
    </div>
  );
}
