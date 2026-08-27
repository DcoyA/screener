"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 섹션 1: 멤버십 히어로. 이 화면의 유일한 강조색(.rubyCta) 요소.
// 결제 인프라 미구현 → CTA는 "프리미엄 리포트 구독 신청" + 기존 waitlist 폼.
// "7일 무료로 시작하기"는 트라이얼이 실제로 붙기 전엔 쓰지 않는다.
export default function MembershipHeroSection() {
  const [open, setOpen] = useState(false);
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
        body: JSON.stringify({ email: email.trim().toLowerCase(), source: "home_membership" }),
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
    <section className="membershipHero rubySurface">
      <div className="membershipCopy">
        <p className="membershipTitle">[우량주 스카우터] 프리미엄 리포트 멤버십</p>
        <p className="membershipSub">
          단순 수익률 예측이 아닌 실전 대응 전략과 핵심 리스크 분석.
          <br />
          흔들리지 않는 투자를 위한 기간별 시나리오를 매주 받아보세요.
        </p>
      </div>

      <div className="membershipCta">
        {status === "done" ? (
          <p className="membershipDone">신청 완료! 오픈 소식을 이메일로 보내드릴게요.</p>
        ) : open ? (
          <form onSubmit={submit} className="membershipForm">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              aria-label="구독 신청 이메일"
            />
            <button type="submit" className="rubyCta" disabled={status === "submitting"}>
              {status === "submitting" ? "신청 중..." : "신청하기"}
            </button>
            {status === "error" ? <span className="membershipError">{errorMsg}</span> : null}
          </form>
        ) : (
          <button type="button" className="rubyCta" onClick={() => setOpen(true)}>
            프리미엄 리포트 구독 신청
          </button>
        )}
      </div>

      <style jsx>{`
        .membershipHero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
          border-radius: var(--radius-card);
          padding: 28px 26px;
          margin-bottom: 28px;
        }
        .membershipCopy {
          min-width: 0;
          flex: 1 1 420px;
        }
        .membershipTitle {
          margin: 0 0 10px;
          font-size: 1.15rem;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        .membershipSub {
          margin: 0;
          color: rgba(255, 255, 255, 0.82);
          line-height: 1.7;
          font-size: 0.95rem;
        }
        .membershipCta {
          flex-shrink: 0;
        }
        .rubyCta {
          padding: 14px 22px;
          font-size: 0.98rem;
          cursor: pointer;
        }
        .rubyCta:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .membershipForm {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .membershipForm input {
          height: 46px;
          min-width: 220px;
          padding: 0 14px;
          border-radius: var(--radius-input);
          border: 1px solid rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.95);
          font-size: 0.95rem;
        }
        .membershipError {
          flex-basis: 100%;
          color: #ffe4e8;
          font-size: 0.84rem;
          font-weight: 700;
        }
        .membershipDone {
          margin: 0;
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.16);
          color: #fff;
          font-weight: 700;
        }
        @media (max-width: 640px) {
          .membershipHero {
            padding: 22px 18px;
          }
          .membershipCta,
          .membershipForm,
          .membershipForm input,
          .rubyCta {
            width: 100%;
          }
          .membershipForm input {
            min-width: 0;
          }
        }
      `}</style>
    </section>
  );
}
