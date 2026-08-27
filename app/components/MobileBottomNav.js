"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./icons/Icon";
import { MOBILE_BOTTOM, isNavItemActive } from "../config/nav-items";

// 하단 고정 네비는 5개만(홈/Top10/검색/관심종목/성적표). 나머지 2개
// (모의투자·사용자정보)는 상단 햄버거 시트(MainNav)로 들어간다.
const TABS = MOBILE_BOTTOM;

export default function MobileBottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="mobileBottomNav" aria-label="모바일 하단 메뉴">
      {TABS.map((tab) => {
        const isActive = isNavItemActive(tab, pathname);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`mobileNavItem ${isActive ? "active" : ""}`}
            style={{ "--nav-accent": `var(${tab.accent})` }}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon name={tab.icon} size={22} className="mobileNavIcon" />
            <span className="mobileNavLabel">{tab.shortLabel || tab.label}</span>
          </Link>
        );
      })}

      <style jsx>{`
        .mobileBottomNav {
          display: none;
        }
        @media (max-width: 768px) {
          .mobileBottomNav {
            display: flex;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 50;
            background: var(--color-card-bg);
            border-top: 1px solid #e5e7eb;
            padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
          }
        }
        .mobileNavItem {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 6px 2px;
          min-width: 0;
          color: #94a3b8;
          text-decoration: none;
        }
        .mobileNavItem.active {
          color: var(--nav-accent, var(--ruby-700));
        }
        .mobileNavIcon {
          display: block;
        }
        .mobileNavLabel {
          font-size: 0.68rem;
          font-weight: 700;
          white-space: nowrap;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </nav>
  );
}
