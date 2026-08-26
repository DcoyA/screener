import { getSignalLevel, formatScoreRatio } from "../../../lib/signalLevel";

// <details>/<summary>는 네이티브 HTML이라 접혀 있어도 본문이 DOM에 그대로
// 남는다(브라우저가 화면에만 안 보이게 함) - 예전 버전은 useState로 열린
// 항목만 렌더링해서 접힌 상태로 크롤링되면 본문이 아예 없었다(SEO 공백의
// 실제 원인). JS 상태가 필요 없어 서버 컴포넌트로도 그대로 동작한다.
export default function ScoreAccordion({ groups, scoreBreakdown }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {groups.map((group) => {
        const signal = getSignalLevel(group.score, group.max);
        return (
          <details key={group.key} style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", overflow: "hidden" }}>
            <summary
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                cursor: "pointer",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {group.label}
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
                  marginLeft: 10,
                }}
              >
                {signal.label}
              </span>
            </summary>
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
          </details>
        );
      })}
    </div>
  );
}
