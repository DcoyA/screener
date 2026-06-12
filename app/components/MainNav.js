"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "../config/nav-items";

export default function MainNav({ className = "mainNav" }) {
  const pathname = usePathname();

  return (
    <>
      <nav className={className} aria-label="주요 메뉴">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;

          if (isActive) {
            return (
              <a
                key={item.href}
                href={item.href}
                className="navLink active"
                aria-current="page"
              >
                {item.label}
              </a>
            );
          }

          return (
            <Link key={item.href} href={item.href} className="navLink">
              {item.label}
            </Link>
          );
        })}
      </nav>

      <style jsx>{`
        .mainNav {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
        }
        .navLink {
          color: #334155;
          text-decoration: none;
          font-weight: 700;
          transition: color 0.2s ease;
        }
        .navLink:hover {
          color: #0f172a;
        }
        .navLink.active {
          color: #4f46e5;
          font-weight: 800;
        }
      `}</style>
    </>
  );
}
