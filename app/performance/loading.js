import SkeletonPage, { SkeletonBox, SkeletonLines } from "../components/Skeleton";

export default function PerformanceLoading() {
  return (
    <SkeletonPage>
      {/* 상단 요약 KPI 3종 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid var(--ink-300)", borderRadius: 16, padding: 20 }}>
            <SkeletonBox width="50%" height={12} style={{ marginBottom: 12 }} />
            <SkeletonBox width="70%" height={26} />
          </div>
        ))}
      </div>

      {/* 차트 자리 */}
      <SkeletonBox width="100%" height={300} radius={16} style={{ marginBottom: 24 }} />

      {/* 57주 테이블 자리 */}
      <SkeletonBox width={180} height={18} style={{ marginBottom: 12 }} />
      <div style={{ border: "1px solid var(--ink-300)", borderRadius: 16, overflow: "hidden" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 90px 90px 90px 80px",
              gap: 12,
              alignItems: "center",
              padding: "14px 16px",
              borderTop: i === 0 ? "none" : "1px solid var(--ink-300)",
            }}
          >
            <SkeletonBox width="70%" height={13} />
            <SkeletonBox width="60%" height={13} />
            <SkeletonBox width={70} height={13} />
            <SkeletonBox width={70} height={13} />
            <SkeletonBox width={70} height={13} />
            <SkeletonBox width={50} height={13} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <SkeletonLines count={3} />
      </div>
    </SkeletonPage>
  );
}
