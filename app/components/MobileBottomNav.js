"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./icons/Icon";

// "마이페이지"/"구독관리"에 해당하는 전용 라우트가 코드베이스에 없어(로그인 마이페이지,
// 구독 관리 화면 모두 부재), 실제 존재하는 라우트 중 개인화된 데이터를 다루는
// /wishlist(관심종목)를 가장 가까운 대체 라우트로 사용한다.
// 상단 데스크톱 네비(app/config/nav-items.js)와 동일한 4개 목적지로 맞춘다.
// "리포트"는 /premium/reports(구독자 전용 아카이브)가 아니라 /reports(무료
// 리포트 + 성과 통합 허브)로 연결해야 데스크톱 네비와 행선지가 일치한다.
const TABS = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/search", label: "스크리너", icon: "chart" },
  { href: "/reports", label: "리포트", icon: "newspaper" },
  { href: "/wishlist", label: "마이페이지", icon: "user" },
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
