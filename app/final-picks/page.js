"use client";

export default function FinalPicksPage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px", color: "#0f172a" }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 24,
          padding: 24,
          background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
          boxShadow: "0 20px 50px rgba(15,23,42,0.06)",
        }}
      >
        <p
          style={{
            display: "inline-flex",
            padding: "8px 14px",
            borderRadius: 999,
            background: "#eef2ff",
            color: "#4f46e5",
            fontSize: "0.82rem",
            fontWeight: 800,
            margin: "0 0 18px",
          }}
        >
          FINAL PICKS SAFE MODE
        </p>
        <h1 style={{ margin: "0 0 12px", fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.04em" }}>
          실전투자
        </h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.8 }}>
          이 페이지는 점검 중입니다.
          <br />
          빌드 안정성 확인을 위해 가장 단순한 화면만 우선 노출합니다.
        </p>
        <div style={{ marginTop: 20, display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 14, border: "1px solid #dbe3f0", textDecoration: "none", color: "#0f172a", fontWeight: 800 }}>홈으로 가기</a>
          <a href="/ranking" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 14, border: "1px solid #dbe3f0", textDecoration: "none", color: "#0f172a", fontWeight: 800 }}>랭킹 보기</a>
          <a href="/risk" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 14, border: "1px solid #dbe3f0", textDecoration: "none", color: "#0f172a", fontWeight: 800 }}>리스크 보기</a>
          <a href="/reports" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 14, border: "1px solid #dbe3f0", textDecoration: "none", color: "#0f172a", fontWeight: 800 }}>리포트 보기</a>
        </div>
      </div>
    </main>
  );
}
