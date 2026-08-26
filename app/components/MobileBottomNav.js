"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./icons/Icon";

// 상단 데스크톱 네비(app/config/nav-items.js)와 동일한 5개 목적지로 맞춘다
// (TASK 3, 디자인·IA 개편) - /me가 새로 생기면서 예전엔 없던 "마이페이지"
// 전용 라우트 불일치가 해소됨.
const TABS = [
  { href: "/", label: "오늘", icon: "home" },
  { href: "/screener", label: "종목찾기", icon: "search" },
  { href: "/performance", label: "성적표", icon: "trendingUp" },
  { href: "/reports", label: "리포트", icon: "newspaper" },
  { href: "/me", label: "내 종목", icon: "user" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobileBottomNav" aria-label="모바일 하단 메뉴">
      {TABS.map((tab) => {
        const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={`mobileNavItem ${isActive ? "active" : ""}`}>
            <Icon name={tab.icon} size={22} className="mobileNavIcon" />
            <span className="mobileNavLabel">{tab.label}</span>
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
          padding: 6px 4px;
          color: #94a3b8;
          text-decoration: none;
        }
        .mobileNavItem.active {
          color: var(--color-primary);
        }
        .mobileNavIcon {
          display: block;
        }
        .mobileNavLabel {
          font-size: 0.7rem;
          font-weight: 700;
        }
      `}</style>
    </nav>
  );
}
