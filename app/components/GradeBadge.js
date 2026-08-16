"use client";

export default function GradeBadge({ grade, size = "md", showDescription = false }) {
  if (!grade) return null;
  const padding = size === "sm" ? "6px 10px" : "8px 14px";
  const fontSize = size === "sm" ? "0.76rem" : "0.86rem";

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: showDescription ? 4 : 0 }}>
      <span
        title={grade.description}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding,
          borderRadius: 999,
          fontWeight: 900,
          fontSize,
          color: grade.color,
          background: grade.bg,
        }}
      >
        통합 등급 · {grade.label}
        {grade.downgraded ? " ⚠" : ""}
      </span>
      {showDescription ? (
        <span style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>{grade.description}</span>
      ) : null}
    </span>
  );
}
