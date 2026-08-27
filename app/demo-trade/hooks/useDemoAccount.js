"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export function useDemoAccount() {
  const [account, setAccount] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [accountVersion, setAccountVersion] = useState(0);

  const ensureAccountForUser = useCallback(async () => {
    setLoadingAccount(true);
    try {
      const res = await fetch("/api/demo/account/ensure");
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "가상계좌 조회/생성 실패");
        return;
      }
      setAccount({ accountId: data.account.accountNo, cash: data.account.cash });
      setAccountVersion((v) => v + 1);
    } finally {
      setLoadingAccount(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function init() {
      const { data } = await supabase.auth.getUser();
      const user = data.user || null;
      setAuthUser(user);
      if (user) await ensureAccountForUser();
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user || null;
      setAuthUser(user);
      if (user) {
        await ensureAccountForUser();
      } else {
        setAccount(null);
      }
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleKakaoLogin() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${window.location.pathname}` },
    });
  }

  async function resetAccount() {
    // 확인 절차는 AccountPanel의 2단계 인라인 확인이 담당한다.
    setResetting(true);
    try {
      const res = await fetch("/api/demo/account/reset", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "계좌 초기화 실패");
        return;
      }
      setAccount({ accountId: data.account.accountNo, cash: data.account.cash });
      setAccountVersion((v) => v + 1);
    } catch (error) {
      console.error(error);
      alert("계좌 초기화 중 문제가 발생했습니다.");
    } finally {
      setResetting(false);
    }
  }

  function updateCash(newCash) {
    setAccount((prev) => (prev ? { ...prev, cash: newCash } : prev));
  }

  return {
    account,
    authUser,
    loadingAccount,
    resetting,
    accountVersion,
    handleKakaoLogin,
    resetAccount,
    updateCash,
  };
}
