"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageTopBar from "../components/PageTopBar";
import AccountModal from "../components/account/AccountModal";

// /me 는 헤더 계정 아이콘이 여는 마이페이지 모달과 같은 패널을 풀페이지로
// 렌더한다(AccountModal inline). 딥링크·모바일·뒤로가기 대상.

const SECTION_KEYS = ["profile", "wishlist", "subscription", "history", "notifications", "account"];

function MeContent() {
  const sp = useSearchParams();
  // 신규: ?section=  / 레거시(/wishlist·/me/watchlist 리다이렉트): ?tab=wishlist
  const requested = (sp.get("section") || sp.get("tab") || "").trim();
  const initialSection = SECTION_KEYS.includes(requested) ? requested : "profile";

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 80px", color: "var(--ink-900)", background: "var(--bg-me)" }}>
      <PageTopBar />
      <section style={{ marginBottom: 20 }}>
        <p style={{ display: "inline-flex", padding: "8px 14px", borderRadius: 999, background: "var(--color-surface-tint)", color: "var(--color-primary)", fontSize: "0.82rem", fontWeight: 900, marginBottom: 12 }}>MY</p>
        <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)", letterSpacing: "-0.03em" }}>마이페이지</h1>
      </section>
      <AccountModal inline initialSection={initialSection} />
    </main>
  );
}

export default function MeClient() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 80px" }}><PageTopBar /></main>}>
      <MeContent />
    </Suspense>
  );
}
