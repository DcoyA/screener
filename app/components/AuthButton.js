"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

export default function AuthButton() {
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${window.location.pathname}` },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (!mounted) return null;

  const style = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "40px",
    padding: "0 14px",
    borderRadius: "999px",
    border: "1px solid #fee500",
    background: user ? "#f8fafc" : "#fee500",
    color: user ? "#334155" : "#181600",
    fontWeight: 800,
    fontSize: "0.88rem",
    cursor: "pointer",
  };

  if (user) {
    const nickname = user.user_metadata?.name || user.user_metadata?.nickname || "내 계정";
    return (
      <button type="button" style={style} onClick={handleLogout}>
        {nickname} · 로그아웃
      </button>
    );
  }

  return (
    <button type="button" style={style} onClick={handleLogin}>
      카카오로 로그인
    </button>
  );
}
