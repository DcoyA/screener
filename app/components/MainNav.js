"use client";

import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "../config/nav-items";

export default function MainNav({ className = "" }) {
  const pathname = usePathname();
  const router = useRouter();
  const safeItems = Array.isArray(NAV_ITEMS) ? NAV_ITEMS.filter(Boolean) : [];

  const handleMove = (href) => {
    if (!href || href === "#") return;
    try {
      router.push(href);
    } catch (err) {
      window.location.href = href;
    }
  };

  return (
    <nav className={className} aria-label="메인 메뉴">
      <div className="navRow">
        {safeItems.map((item) => {
          const href = item?.href || "#";
          const label = item?.label || "메뉴";
          const isActive = pathname === href;

          return (
            <button
              key={href}
              type="button"
              onClick={() => handleMove(href)}
              className={isActive ? "navLink active" : "navLink"}
              aria-current={isActive ? "page" : undefined}
            >
              {label}
            </button>
          );
        })}
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
        .navLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid #dbe3f0;
          background: #ffffff;
          color: #334155;
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
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .navLink.active {
          background: #0f172a;
          border-color: #0f172a;
          color: #ffffff;
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
        }
      `}</style>
    </nav>
  );
}
