import SkeletonPage, { SkeletonBox, SkeletonLines } from "../../components/Skeleton";

export default function StockLoading() {
  return (
    <SkeletonPage>
      {/* 종목명 + 등급 배지 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <SkeletonBox width={200} height={30} />
        <SkeletonBox width={64} height={30} radius={999} />
      </div>

      {/* 한 줄 결론 */}
      <SkeletonBox width="80%" height={18} style={{ marginBottom: 24 }} />

      {/* 종합판단점수 블록 */}
      <SkeletonBox width="100%" height={120} radius={16} style={{ marginBottom: 24 }} />

      {/* 근거 3줄 */}
      <div style={{ display: "grid", gap: 14, marginBottom: 24 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <SkeletonBox width={28} height={28} radius={8} />
            <span style={{ flex: 1 }}>
              <SkeletonLines count={2} lastWidth="50%" />
            </span>
          </div>
        ))}
      </div>

      {/* 지표 표 */}
      <SkeletonBox width="100%" height={220} radius={16} />
    </SkeletonPage>
  );
}
