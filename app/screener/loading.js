import SkeletonPage, { SkeletonBox } from "../components/Skeleton";

export default function ScreenerLoading() {
  return (
    <SkeletonPage>
      {/* 탭 + 필터 바 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBox key={i} width={96} height={36} radius={999} />
        ))}
      </div>
      <SkeletonBox width="100%" height={48} radius={12} style={{ marginBottom: 20 }} />

      {/* 랭킹 표 */}
      <div style={{ border: "1px solid var(--ink-300)", borderRadius: 16, overflow: "hidden" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 90px 90px 80px",
              gap: 12,
              alignItems: "center",
              padding: "14px 16px",
              borderTop: i === 0 ? "none" : "1px solid var(--ink-300)",
            }}
          >
            <SkeletonBox width={24} height={24} radius={6} />
            <SkeletonBox width="55%" height={14} />
            <SkeletonBox width={70} height={14} />
            <SkeletonBox width={70} height={14} />
            <SkeletonBox width={60} height={14} />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
