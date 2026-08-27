"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, isInWishlist, toggleWishlist } from "../lib/wishlist";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

export default function WishlistButton({ code, name, size = "md" }) {
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let ignore = false;
    setMounted(true);

    isInWishlist(code).then((result) => {
      if (!ignore) setActive(result);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      isInWishlist(code).then((result) => {
        if (!ignore) setActive(result);
      });
    });

    return () => {
      ignore = true;
      listener.subscription.unsubscribe();
    };
  }, [code]);

  if (!mounted) return null;

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
  
    const user = await getCurrentUser();
    if (!user) {
      const confirmed = window.confirm("관심종목은 로그인 후 저장할 수 있어요. 카카오로 로그인할까요?");
      if (confirmed) {
        await supabase.auth.signInWithOAuth({
          provider: "kakao",
          options: { redirectTo: `${window.location.origin}/auth/callback?next=${window.location.pathname}` },
        });
      }
      return;
    }
  
    const previous = active;
    setActive(!previous);
    setBusy(true);
  
    const result = await toggleWishlist(code, name);
  
    if (!result.ok) {
      setActive(previous);
      alert("관심종목 저장에 실패했습니다. 다시 시도해주세요.");
    }
    setBusy(false);
  };

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    borderRadius: "999px",
    border: active ? "1px solid var(--warn-600)" : "1px solid #dbe3f0",
    background: active ? "var(--warn-bg)" : "#ffffff",
    color: active ? "var(--warn-600)" : "#334155",
    fontWeight: 800,
    cursor: busy ? "wait" : "pointer",
    padding: size === "sm" ? "6px 10px" : "10px 14px",
    fontSize: size === "sm" ? "0.78rem" : "0.88rem",
    opacity: busy ? 0.6 : 1,
  };

  return (
    <button type="button" onClick={handleClick} style={baseStyle} aria-pressed={active} disabled={busy}>
      <span>{active ? "★" : "☆"}</span>
      <span>{active ? "관심종목" : "관심추가"}</span>
    </button>
  );
}
