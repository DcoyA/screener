"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "../config/nav-items";
import AuthButton from "./AuthButton";

export default function MainNav({ className = "" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openGroupId, setOpenGroupId] = useState(null);
  const rootRef = useRef(null);

  const safeItems = Array.isArray(NAV_ITEMS) ? NAV_ITEMS.filter(Boolean) : [];

  useEffect(() => {
    function handleOutsideClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpenGroupId(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    setOpenGroupId(null);
  }, [pathname]);

  const handleMove = (href) => {
    if (!href || href === "#") return;
    setOpenGroupId(null);
    try {
      router.push(href);
    } catch (err) {
      window.location.href = href;
    }
  };

  const isGroupActive = (group) => {
    return Array.isArray(group.items) && group.items.some((item) => item.href === pathname);
  };

  return (
    <nav className={className} aria-label="메인 메뉴" ref={rootRef}>
      <div className="navRow">
        {safeItems.map((entry) => {
          if (entry.type === "group") {
            const active = isGroupActive(entry);
            const open = openGroupId === entry.id;

            return (
              <div key={entry.id} className="navGroup">
                <button
                  type="button"
                  className={active ? "navLink navGroupTrigger active" : "navLink navGroupTrigger"}
                  aria-expanded={open}
                  onClick={() => setOpenGroupId(open ? null : entry.id)}
                >
                  {entry.label}
                  <span className={open ? "navCaret navCaretOpen" : "navCaret"}>▾</span>
                </button>

                {open && (
                  <div className="navDropdown" role="menu">
                    {entry.items.map((item, index) => {
                      const itemActive = pathname === item.href;
                      return (
                        <button
                          key={item.href}
                          type="button"
                          role="menuitem"
                          className={itemActive ? "navDropdownItem active" : "navDropdownItem"}
                          onClick={() => handleMove(item.href)}
                        >
                          <span className="navDropdownLabel">{item.label}</span>
                          {item.desc ? <span className="navDropdownDesc">{item.desc}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const href = entry.href || "#";
          const label = entry.label || "메뉴";
          const isActive = pathname === href;
          const isMuted = entry.type === "muted";

          return (
            <button
              key={href}
              type="button"
              onClick={() => handleMove(href)}
              className={
                isMuted
                  ? isActive
                    ? "navLink navLinkMuted active"
                    : "navLink navLinkMuted"
                  : isActive
                  ? "navLink active"
                  : "navLink"
              }
              aria-current={isActive ? "page" : undefined}
            >
              {label}
            </button>
          );
        })}
        <button type="button" onClick={() => handleMove("/reports")} className="navSubscribeCta">
          주 4회 리포트 받기
        </button>

        <span className="navAuthSlot">
          <AuthButton />
        </span>
      </div>

      <style jsx>{`
        .navRow {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          position: relative;
          z-index: 10;
        }
        .navGroup {
          position: relative;
        }
        /* 기본값은 흰 배경 위에서 안전하게 보이는 색이다. 인디고 헤더 안에
           쓰일 때는 부모가 --nav-pill-* 커스텀 프로퍼티를 덮어써서 흰색
           변형으로 바뀐다(HomeClient 헤더, PageTopBar 참고). */
        .navLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--nav-pill-border, #dbe3f0);
          background: var(--nav-pill-bg, #ffffff);
          color: var(--nav-pill-color, #334155);
          font-weight: 800;
          font-size: 0.92rem;
          transition: all 0.18s ease;
          cursor: pointer;
          pointer-events: auto;
          appearance: none;
          -webkit-appearance: none;
          text-decoration: none;
        }
        .navLink:hover {
          background: var(--nav-pill-hover-bg, #f8fafc);
          border-color: var(--nav-pill-hover-border, #cbd5e1);
        }
        .navLink.active {
          background: var(--nav-pill-active-bg, var(--color-primary));
          border-color: var(--nav-pill-active-bg, var(--color-primary));
          color: var(--nav-pill-active-color, #ffffff);
        }
        .navLinkMuted {
          background: transparent;
          border-color: transparent;
          color: var(--nav-pill-muted-color, #94a3b8);
          font-weight: 600;
          font-size: 0.85rem;
        }
        .navLinkMuted:hover {
          background: var(--nav-pill-hover-bg, #f1f5f9);
          color: var(--nav-pill-color, #64748b);
        }
        .navGroupTrigger {
          gap: 6px;
        }
        /* TASK 3-3(디자인·IA 개편): 전 페이지 공통 상시 CTA. "화면당 오렌지
           1개" 원칙 - 이 CTA가 있는 화면에서는 다른 오렌지 버튼을 쓰지 않는다. */
        .navSubscribeCta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 16px;
          border-radius: var(--radius-pill);
          border: none;
          background: var(--color-accent);
          color: #ffffff;
          font-weight: 800;
          font-size: 0.88rem;
          cursor: pointer;
          white-space: nowrap;
          margin-left: auto;
        }
        .navSubscribeCta:hover {
          filter: brightness(1.05);
        }
        .navCaret {
          font-size: 0.7rem;
          transition: transform 0.15s ease;
        }
        .navCaretOpen {
          transform: rotate(180deg);
        }
        .navDropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 220px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 30;
        }
        .navDropdownItem {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          border-radius: 10px;
          border: none;
          background: transparent;
          cursor: pointer;
        }
        .navDropdownItem:hover {
          background: #f8fafc;
        }
        .navDropdownItem.active {
          background: #eef2ff;
        }
        .navDropdownLabel {
          font-weight: 800;
          font-size: 0.9rem;
          color: #1e293b;
        }
        .navDropdownDesc {
          font-size: 0.76rem;
          color: #94a3b8;
        }
        @media (max-width: 640px) {
          .navRow {
            gap: 8px;
          }
          .navLink {
            min-height: 38px;
            padding: 0 12px;
            font-size: 0.88rem;
          }
          .navDropdown {
            left: auto;
            right: 0;
          }
        }
      `}</style>
    </nav>
  );
}
