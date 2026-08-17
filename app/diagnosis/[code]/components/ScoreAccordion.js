"use client";

import { useState } from "react";
import { getSignalLevel, formatScoreRatio } from "../../../lib/signalLevel";

export default function ScoreAccordion({ groups, scoreBreakdown }) {
  const [openKey, setOpenKey] = useState(null);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {groups.map((group) => {
        const signal = getSignalLevel(group.score, group.max);
        const isOpen = openKey === group.key;

        return (
          <div key={group.key} style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : group.key)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontWeight: 800, color: "#0f172a" }}>{group.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontSize: "0.82rem",
                    fontWeight: 900,
                    color: signal.color,
                    background: signal.bg,
                  }}
                >
                  {signal.label}
                </span>
                <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{isOpen ? "접기 ▲" : "자세히 ▼"}</span>
              </span>
            </button>

            {isOpen && (
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f1f5f9" }}>
                <p style={{ margin: "12px 0 10px", color: "#64748b", fontSize: "0.88rem" }}>{group.desc}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {group.children.map((child) => (
                    <span
                      key={child.key}
                      style={{ fontSize: "0.82rem", color: "#475569", background: "#f1f5f9", borderRadius: 999, padding: "4px 10px" }}
                    >
                      {child.label} {formatScoreRatio(scoreBreakdown?.[child.key], child.max)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
