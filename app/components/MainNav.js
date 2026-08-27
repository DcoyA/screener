"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "../config/nav-items";
import Icon from "./icons/Icon";
import AuthButton from "./AuthButton";

// 스타일은 app/globals.css의 .mainNav* 규칙. 항상 .rubySurface(SiteHeader) 안에서
// 렌더된다고 가정하고 흰색 아웃라인 pill로 그린다.
// 데스크톱: 가로 pill 행. 모바일(≤768px): 햄버거 → 세로 시트로 7항목 전부.
export default function MainNav() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  // 라우트가 바뀌면 모바일 시트를 닫는다.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 시트가 열려 있을 때 ESC로 닫기.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const renderItem = (item, { inSheet } = {}) => {
    const active = isNavItemActive(item, pathname);
    const accentStyle = { "--nav-accent": `var(${item.accent})` };

    if (item.variant === "avatar" && !inSheet) {
      return (
        <Link
          key={item.id}
          href={item.href}
          className={`mainNavAvatar${active ? " active" : ""}`}
          style={accentStyle}
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          title={item.label}
        >
          <Icon name={item.icon} size={18} />
        </Link>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        className={`mainNavPill${active ? " active" : ""}${inSheet ? " sheetItem" : ""}`}
        style={accentStyle}
        aria-current={active ? "page" : undefined}
      >
        {inSheet ? <Icon name={item.icon} size={18} /> : null}
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="mainNav" aria-label="메인 메뉴">
      {/* 데스크톱 가로 네비 */}
      <div className="mainNavRow">
        {NAV_ITEMS.map((item) => [
          renderItem(item),
          item.groupEnd ? <span className="mainNavDivider" aria-hidden="true" key={`${item.id}-div`} /> : null,
        ])}
        <Link href="/reports" className="mainNavCta rubyCta">
          주 4회 리포트 받기
        </Link>
        <span className="mainNavAuth">
          <AuthButton />
        </span>
      </div>

      {/* 모바일 햄버거 */}
      <button
        type="button"
        className="mainNavToggle"
        aria-expanded={open}
        aria-controls="mainNavSheet"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "close" : "menu"} size={22} />
      </button>

      {open ? (
        <>
          <button type="button" className="mainNavScrim" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />
          <div id="mainNavSheet" className="mainNavSheet" role="menu">
            {NAV_ITEMS.map((item) => renderItem(item, { inSheet: true }))}
            <Link href="/reports" className="mainNavCta rubyCta sheetItem" role="menuitem">
              주 4회 리포트 받기
            </Link>
            <span className="mainNavSheetAuth">
              <AuthButton />
            </span>
          </div>
        </>
      ) : null}
    </nav>
  );
}
