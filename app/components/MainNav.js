"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_ICONS, NAV_SHEET_ITEMS, isNavItemActive } from "../config/nav-items";
import Icon from "./icons/Icon";
import AuthButton from "./AuthButton";
import AccountMenu from "./account/AccountMenu";

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
    // 사용자 아이콘은 /me 로 이동하지 않고 마이페이지 모달을 연다.
    if (item.id === "account") {
      return <AccountMenu key={item.id} inSheet={!!inSheet} />;
    }

    const active = isNavItemActive(item, pathname);
    const accentStyle = { "--nav-accent": `var(${item.accent})` };

    // 아이콘 전용 항목(검색·사용자)은 데스크톱에서 정사각 아이콘 버튼.
    if (item.variant === "icon" && !inSheet) {
      return (
        <Link
          key={item.id}
          href={item.href}
          prefetch
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
        prefetch
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

  // 구독 CTA는 홈 포함 모든 페이지 헤더 우측 상단에 노출한다(기획안). 예전엔
  // 홈에서만 숨기고 본문 멤버십 히어로 섹션이 그 역할을 대신했으나, 히어로를
  // 걷어내고 헤더 CTA 하나로 일원화했다.
  const showCta = true;

  return (
    <nav className="mainNav" aria-label="메인 메뉴">
      {/* 데스크톱 가로 네비 */}
      <div className="mainNavRow">
        {NAV_ITEMS.map((item) => renderItem(item))}
        <span className="mainNavDivider" aria-hidden="true" />
        {NAV_ICONS.map((item) => renderItem(item))}
        {showCta ? (
          <Link href="/reports" prefetch className="mainNavCta rubyCta">
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
              <Link href="/reports" prefetch className="mainNavCta rubyCta sheetItem" role="menuitem">
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
