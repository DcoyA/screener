import SkeletonPage, { SkeletonBox, SkeletonLines } from "../components/Skeleton";

export default function ReportsLoading() {
  return (
    <SkeletonPage>
      {/* 페이지 히어로 */}
      <div style={{ marginBottom: 28 }}>
        <SkeletonBox width={120} height={20} radius={999} style={{ marginBottom: 14 }} />
        <SkeletonBox width="45%" height={30} style={{ marginBottom: 12 }} />
        <SkeletonLines count={2} lastWidth="70%" />
      </div>

      {/* 최신 리포트 큰 카드 */}
      <SkeletonBox width="100%" height={160} radius={16} style={{ marginBottom: 20 }} />

      {/* 리포트 목록 */}
      <div style={{ display: "grid", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid var(--ink-300)", borderRadius: 14, padding: 18 }}>
            <SkeletonBox width="30%" height={12} style={{ marginBottom: 10 }} />
            <SkeletonBox width="65%" height={16} />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
