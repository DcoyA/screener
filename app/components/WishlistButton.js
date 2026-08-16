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
    setActive((prev) => !prev);
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
