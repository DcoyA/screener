import SkeletonPage, { SkeletonBox } from "../components/Skeleton";

export default function SearchLoading() {
  return (
    <SkeletonPage>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <SkeletonBox width={140} height={26} style={{ marginBottom: 8 }} />
        <SkeletonBox width="70%" height={14} style={{ marginBottom: 18 }} />

        {/* 검색창 + 버튼 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <SkeletonBox width="100%" height={52} radius={14} />
          <SkeletonBox width={84} height={52} radius={14} />
        </div>

        {/* 결과 리스트 자리 */}
        <div style={{ border: "1px solid var(--ink-300)", borderRadius: 14, overflow: "hidden" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderTop: i === 0 ? "none" : "1px solid var(--ink-300)",
              }}
            >
              <SkeletonBox width="40%" height={14} />
              <SkeletonBox width={110} height={12} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
