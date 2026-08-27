"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_ICONS, NAV_SHEET_ITEMS, isNavItemActive } from "../config/nav-items";
import Icon from "./icons/Icon";
import AuthButton from "./AuthButton";

// 스타일은 app/globals.css의 .mainNav* 규칙. 항상 .rubySurface(SiteHeader) 안.
//   ≥1280px       텍스트 pill 6 + 구분선 + 아이콘 2 + 구독 CTA
//   1024~1279px   pill을 아이콘+툴팁으로 축소(라벨 축약 금지)
//   ≤1023px       햄버거 → 세로 시트로 전체
//   ≤768px        + 하단 고정 네비 5개(MobileBottomNav)
export default function MainNav() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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

    // 아이콘 전용 항목(검색·사용자)은 데스크톱에서 정사각 아이콘 버튼.
    if (item.variant === "icon" && !inSheet) {
      return (
        <Link
          key={item.id}
          href={item.href}
          className={`mainNavIconBtn${active ? " active" : ""}`}
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
        title={item.label}
      >
        <Icon name={item.icon} size={18} className="mainNavPillIcon" />
        <span>{item.label}</span>
      </Link>
    );
  };

  // 홈에는 멤버십 히어로 섹션이 그 자체로 구독 CTA다("이 화면의 유일한 강조색"
  // 규칙). 헤더 CTA와 중복되므로 홈에서는 헤더 CTA를 숨긴다.
  const showCta = pathname !== "/";

  return (
    <nav className="mainNav" aria-label="메인 메뉴">
      {/* 데스크톱 가로 네비 */}
      <div className="mainNavRow">
        {NAV_ITEMS.map((item) => renderItem(item))}
        <span className="mainNavDivider" aria-hidden="true" />
        {NAV_ICONS.map((item) => renderItem(item))}
        {showCta ? (
          <Link href="/reports" className="mainNavCta rubyCta">
            프리미엄 리포트 구독
          </Link>
        ) : null}
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
            {NAV_SHEET_ITEMS.map((item) => renderItem(item, { inSheet: true }))}
            {showCta ? (
              <Link href="/reports" className="mainNavCta rubyCta sheetItem" role="menuitem">
                프리미엄 리포트 구독
              </Link>
            ) : null}
            <span className="mainNavSheetAuth">
              <AuthButton />
            </span>
          </div>
        </>
      ) : null}
    </nav>
  );
}
