import SkeletonPage, { SkeletonBox, SkeletonLines } from "../components/Skeleton";

export default function MeLoading() {
  return (
    <SkeletonPage>
      {/* MY 태그 + 제목 + 설명 */}
      <div style={{ marginBottom: 26 }}>
        <SkeletonBox width={56} height={26} radius={999} style={{ marginBottom: 16 }} />
        <SkeletonBox width="40%" height={40} style={{ marginBottom: 12 }} />
        <SkeletonLines count={2} lastWidth="65%" />
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBox key={i} width={92} height={40} radius={999} />
        ))}
      </div>

      {/* 인사이트 3칸 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 26 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBox key={i} width="100%" height={90} radius={16} />
        ))}
      </div>

      {/* 관심종목 카드 */}
      <div style={{ display: "grid", gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBox key={i} width="100%" height={96} radius={20} />
        ))}
      </div>
    </SkeletonPage>
  );
}
