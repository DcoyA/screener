"use client";

import { useState } from "react";
import PageTopBar from "../components/PageTopBar";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 모의투자는 "준비 중" 스텁이다. 체결/포트폴리오 로직은 만들지 않는다.
// 사전알림 이메일만 기존 /api/subscribe(source 태그)로 받는다.
export default function PaperTradingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setStatus("error");
      setErrorMsg("올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "paper_waitlist" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setStatus("error");
        setErrorMsg(data?.error || "신청 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setStatus("done");
      setEmail("");
    } catch {
      setStatus("error");
      setErrorMsg("신청 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <main className="container" style={{ background: "var(--page-bg)", minHeight: "60vh" }}>
      <PageTopBar />

      <section
        style={{
          maxWidth: 560,
          margin: "40px auto",
          border: "1px solid var(--ink-300)",
          borderRadius: "var(--radius-card)",
          background: "#fff",
          padding: "36px 26px",
        }}
      >
        <p
          style={{
            display: "inline-flex",
            padding: "6px 12px",
            borderRadius: 999,
            background: "var(--ruby-100)",
            color: "var(--ruby-700)",
            fontSize: "0.78rem",
            fontWeight: 800,
            margin: "0 0 14px",
          }}
        >
          PREPARING
        </p>
        <h1 style={{ margin: "0 0 12px", fontSize: "1.7rem", color: "var(--ink-900)", letterSpacing: "-0.02em" }}>
          모의투자 기능은 준비 중입니다
        </h1>
        <p style={{ margin: "0 0 22px", color: "var(--ink-600)", lineHeight: 1.75 }}>
          실제 체결 없이 전략을 검증해 볼 수 있는 모의투자 화면을 만들고 있어요.
          <br />
          오픈하면 가장 먼저 알려드릴게요.
        </p>

        {status === "done" ? (
          <p
            style={{
              margin: 0,
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--ruby-50)",
              color: "var(--ruby-700)",
              fontWeight: 700,
            }}
          >
            신청 완료! 오픈 소식을 이메일로 보내드릴게요.
          </p>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label htmlFor="paper-email" style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink-900)" }}>
              사전알림 신청
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                id="paper-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                style={{
                  flex: "1 1 220px",
                  minWidth: 0,
                  height: 46,
                  padding: "0 14px",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--ink-300)",
                  fontSize: "0.95rem",
                }}
              />
              <button
                type="submit"
                className="rubyCta"
                disabled={status === "submitting"}
                style={{ padding: "0 20px", height: 46, cursor: "pointer" }}
              >
                {status === "submitting" ? "신청 중..." : "알림 신청"}
              </button>
            </div>
            {status === "error" ? (
              <span style={{ color: "var(--signal-up)", fontSize: "0.85rem", fontWeight: 700 }}>{errorMsg}</span>
            ) : null}
            <span style={{ color: "var(--ink-600)", fontSize: "0.78rem" }}>
              이메일은 모의투자 오픈 알림에만 사용합니다.
            </span>
          </form>
        )}
      </section>
    </main>
  );
}
