"use client";

import notices from "../data/notices.json";

export default function NoticePage() {
  const sortedNotices = [...notices].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  return (
    <main style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "20px" }}>공지사항</h1>

      {sortedNotices.map((item) => (
        <div
          key={item.id}
          style={{
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "20px",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ marginBottom: "8px" }}>{item.title}</h2>
          <p style={{ color: "#64748b", fontSize: "14px" }}>
            {item.date}
          </p>
          <p style={{ marginTop: "10px", lineHeight: "1.7" }}>
            {item.content}
          </p>
        </div>
      ))}
    </main>
  );
}

