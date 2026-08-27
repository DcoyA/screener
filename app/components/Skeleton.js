// 라우트 loading.js 전용 스켈레톤 프리미티브 (STEP 8).
// 스타일은 app/globals.css의 .skeleton (--ruby-100 → #fff shimmer,
// prefers-reduced-motion 가드 포함). 서버 컴포넌트에서 그대로 쓴다.

export function SkeletonBox({ width = "100%", height = 16, radius = 8, style }) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{
        display: "block",
        width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: typeof radius === "number" ? `${radius}px` : radius,
        ...style,
      }}
    />
  );
}

export function SkeletonLines({ count = 3, gap = 10, lastWidth = "60%" }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: `${gap}px` }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBox key={i} height={13} width={i === count - 1 ? lastWidth : "100%"} />
      ))}
    </span>
  );
}

// 라우트 로딩 컨테이너: 헤더 자리 + 본문 자리. children으로 라우트별 골격을 받는다.
export default function SkeletonPage({ children }) {
  return (
    <div
      role="status"
      aria-label="불러오는 중"
      style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 24px 80px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <SkeletonBox width={140} height={28} radius={999} />
        <SkeletonBox width={220} height={38} radius={12} />
      </div>
      {children}
    </div>
  );
}
