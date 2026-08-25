"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageTopBar from "../components/PageTopBar";

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("idle"); // idle | loading | done
  const [message, setMessage] = useState("");

  const handleUnsubscribe = async () => {
    if (!token) {
      setMessage("유효하지 않은 링크입니다");
      setStatus("done");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);
      setMessage(data?.message || (res.ok ? "구독이 취소되었습니다" : "처리 중 오류가 발생했습니다"));
    } catch (err) {
      setMessage("처리 중 오류가 발생했습니다");
    } finally {
      setStatus("done");
    }
  };

  return (
    <main className="container">
      <PageTopBar />

      <div className="card">
        {status !== "done" ? (
          <>
            <h1>구독을 취소하시겠습니까?</h1>
            <p className="desc">더 이상 프리미엄 리포트 이메일을 받지 않습니다.</p>
            <button type="button" className="primaryBtn" onClick={handleUnsubscribe} disabled={status === "loading"}>
              {status === "loading" ? "처리 중..." : "구독취소"}
            </button>
          </>
        ) : (
          <p className="resultMessage">{message}</p>
        )}
      </div>

      <style jsx>{`
        .container {
          max-width: 560px;
          margin: 0 auto;
          padding: 18px 24px 80px;
          color: #0f172a;
        }
        .card {
          padding: 28px;
          border-radius: var(--radius-card);
          background: #ffffff;
          border: 1px solid #e5e7eb;
          text-align: center;
        }
        .desc {
          color: #64748b;
          margin: 12px 0 20px;
        }
        .primaryBtn {
          border: none;
          border-radius: var(--radius-pill);
          padding: 12px 20px;
          font-weight: 800;
          background: var(--color-primary);
          color: #fff;
          cursor: pointer;
        }
        .primaryBtn:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .resultMessage {
          font-weight: 700;
        }
      `}</style>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}
