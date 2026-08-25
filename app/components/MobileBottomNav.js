"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "마이페이지"/"구독관리"에 해당하는 전용 라우트가 코드베이스에 없어(로그인 마이페이지,
// 구독 관리 화면 모두 부재), 실제 존재하는 라우트 중 개인화된 데이터를 다루는
// /wishlist(관심종목)를 가장 가까운 대체 라우트로 사용한다.
const TABS = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/search", label: "스크리너", icon: "📊" },
  { href: "/premium/reports", label: "리포트", icon: "📰" },
  { href: "/wishlist", label: "마이페이지", icon: "⭐" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobileBottomNav" aria-label="모바일 하단 메뉴">
      {TABS.map((tab) => {
        const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={`mobileNavItem ${isActive ? "active" : ""}`}>
            <span className="mobileNavIcon" aria-hidden="true">{tab.icon}</span>
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
          font-size: 1.2rem;
        }
        .mobileNavLabel {
          font-size: 0.7rem;
          font-weight: 700;
        }
      `}</style>
    </nav>
  );
}
