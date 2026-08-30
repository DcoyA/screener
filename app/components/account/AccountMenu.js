"use client";

import { useEffect, useState } from "react";
import Icon from "../icons/Icon";
import AccountModal from "./AccountModal";

// 헤더(MainNav)의 사용자 아이콘. 클릭하면 /me 로 이동하지 않고 마이페이지
// 모달을 연다. 스타일 클래스는 MainNav 의 아이콘/시트 항목과 동일하게 맞춘다.
export default function AccountMenu({ inSheet = false }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const accent = { "--nav-accent": "var(--accent-me)" };

  return (
    <>
      {inSheet ? (
        <button
          type="button"
          className="mainNavPill sheetItem"
          style={accent}
          onClick={() => setOpen(true)}
        >
          <Icon name="user" size={18} className="mainNavPillIcon" />
          <span>내 정보</span>
        </button>
      ) : (
        <button
          type="button"
          className="mainNavIconBtn"
          style={accent}
          aria-label="내 정보"
          title="내 정보"
          onClick={() => setOpen(true)}
        >
          <Icon name="user" size={18} />
        </button>
      )}

      <AccountModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
