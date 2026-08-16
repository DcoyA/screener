"use client";

import { useEffect, useState } from "react";
import { isInWishlist, toggleWishlist, subscribeWishlist } from "../lib/wishlist";

export default function WishlistButton({ code, name, size = "md" }) {
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActive(isInWishlist(code));
    const unsubscribe = subscribeWishlist(() => setActive(isInWishlist(code)));
    return unsubscribe;
  }, [code]);

  if (!mounted) return null;

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleWishlist(code, name);
    // setActive는 여기서 직접 건드리지 않습니다.
    // toggleWishlist -> saveWishlist가 쏘는 이벤트를 useEffect의
    // subscribeWishlist 콜백이 받아서 localStorage 실제값 기준으로
    // active를 다시 계산해줍니다.
  };

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    borderRadius: "999px",
    border: active ? "1px solid #f59e0b" : "1px solid #dbe3f0",
    background: active ? "#fffbeb" : "#ffffff",
    color: active ? "#b45309" : "#334155",
    fontWeight: 800,
    cursor: "pointer",
    padding: size === "sm" ? "6px 10px" : "10px 14px",
    fontSize: size === "sm" ? "0.78rem" : "0.88rem",
  };

  return (
    <button type="button" onClick={handleClick} style={baseStyle} aria-pressed={active}>
      <span>{active ? "★" : "☆"}</span>
      <span>{active ? "관심종목" : "관심추가"}</span>
    </button>
  );
}
