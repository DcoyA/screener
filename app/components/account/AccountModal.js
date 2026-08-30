"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MyInfoPanel,
  CompactWishlistPanel,
  SubscriptionPanel,
  ReportHistoryPanel,
  NotificationsPanel,
  AccountDangerPanel,
} from "./panels";

const SECTIONS = [
  { key: "profile", label: "내 정보" },
  { key: "wishlist", label: "관심종목" },
  { key: "subscription", label: "프리미엄 구독" },
  { key: "history", label: "리포트 히스토리" },
  { key: "notifications", label: "알림설정" },
  { key: "account", label: "계정 관리" },
];

// 마이페이지 본체. inline=true 면 오버레이 없이 /me 페이지 안에 그대로 렌더,
// 아니면 헤더 계정 아이콘에서 여는 모달. 두 경우 모두 같은 패널을 쓴다.
// 스타일은 <style jsx global> - 패널(별도 컴포넌트)엔 scoped 가 안 먹고, 여기
// 클래스명(acct*)은 충분히 고유하다.
export default function AccountModal({ open = false, onClose, inline = false, initialSection = "profile" }) {
  const [section, setSection] = useState(initialSection);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const active = inline || open;

  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    setLoading(true);
    fetch("/api/me/overview")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setOverview(d?.ok ? d : { ok: true, loggedIn: false, user: null, subscription: null, reports: [] });
      })
      .catch(() => {
        if (alive) setOverview({ ok: true, loggedIn: false, user: null, subscription: null, reports: [] });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [active]);

  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (inline || !open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [inline, open, close]);

  if (!inline && !open) return null;

  const panel = loading ? (
    <p className="acctLoading">불러오는 중…</p>
  ) : section === "profile" ? (
    <MyInfoPanel overview={overview} />
  ) : section === "wishlist" ? (
    <CompactWishlistPanel />
  ) : section === "subscription" ? (
    <SubscriptionPanel overview={overview} />
  ) : section === "history" ? (
    <ReportHistoryPanel overview={overview} onNavigate={inline ? undefined : close} />
  ) : section === "notifications" ? (
    <NotificationsPanel />
  ) : (
    <AccountDangerPanel />
  );

  const body = (
    <>
      <div className="acctTabs" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={section === s.key}
            className={`acctTab ${section === s.key ? "active" : ""}`}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="acctBody">{panel}</div>
    </>
  );

  return (
    <>
      {inline ? (
        <div className="acctInline">{body}</div>
      ) : (
        <div className="acctBackdrop" role="dialog" aria-modal="true" aria-label="마이페이지" onClick={close}>
          <div className="acctCard" onClick={(e) => e.stopPropagation()}>
            <div className="acctHeader">
              <h2>마이페이지</h2>
              <button type="button" className="acctClose" onClick={close} aria-label="닫기">
                ×
              </button>
            </div>
            {body}
          </div>
        </div>
      )}

      <style jsx global>{`
        .acctBackdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 48px 20px;
          background: rgba(43, 3, 8, 0.45);
          backdrop-filter: blur(3px);
          overflow-y: auto;
        }
        .acctCard {
          width: 100%;
          max-width: 640px;
          max-height: calc(100vh - 96px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #fff;
          border: 1px solid rgba(201, 163, 74, 0.55);
          border-radius: 16px;
          box-shadow: 0 30px 80px rgba(43, 3, 8, 0.4);
        }
        .acctHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px 14px;
          border-bottom: 1px solid var(--ink-200);
        }
        .acctHeader h2 {
          margin: 0;
          font-size: var(--font-title);
          letter-spacing: -0.02em;
          color: var(--ink-900);
        }
        .acctClose {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid var(--gold-500);
          background: #fff;
          color: var(--ruby-700);
          font-size: 1.25rem;
          line-height: 1;
          font-weight: 800;
          cursor: pointer;
        }
        .acctClose:hover {
          background: var(--ruby-50);
        }
        .acctInline {
          max-width: 720px;
          margin: 0 auto;
        }
        .acctTabs {
          display: flex;
          gap: 8px;
          padding: 14px 22px 0;
          flex-wrap: wrap;
        }
        .acctInline .acctTabs {
          padding: 0 0 4px;
        }
        .acctTab {
          height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid var(--gold-500);
          background: #fff;
          color: var(--ink-900);
          font-weight: 800;
          font-size: var(--font-caption);
          cursor: pointer;
        }
        .acctTab.active {
          background: var(--ruby-600);
          color: #fff;
          border-color: var(--ruby-600);
        }
        .acctBody {
          flex: 1;
          overflow-y: auto;
          padding: 18px 22px 24px;
        }
        .acctInline .acctBody {
          padding: 18px 0 0;
        }
        .acctLoading {
          margin: 0;
          color: var(--ink-600);
          font-size: var(--font-caption);
          font-weight: 700;
        }
        @media (max-width: 640px) {
          .acctBackdrop {
            padding: 0;
          }
          .acctCard {
            max-width: none;
            min-height: 100vh;
            max-height: 100vh;
            border-radius: 0;
            border: none;
          }
        }
      `}</style>
    </>
  );
}
