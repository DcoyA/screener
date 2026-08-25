"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import MainNav from "../components/MainNav";

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
      <div className="topLinks">
        <Link href="/" className="homeBtn">홈으로 가기</Link>
        <MainNav />
      </div>

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
          padding: 32px 24px 80px;
          color: #0f172a;
        }
        .topLinks {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 26px;
          flex-wrap: wrap;
        }
        .homeBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 10px 14px;
          text-decoration: none;
          font-weight: 800;
          border: 1px solid #0f172a;
          background: #0f172a;
          color: #fff;
        }
        .card {
          padding: 28px;
          border-radius: 20px;
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
          border-radius: 14px;
          padding: 12px 20px;
          font-weight: 800;
          background: #0f172a;
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
