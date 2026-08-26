import Link from "next/link";

// TASK 4-1 블록③. 문서 스펙: "1개만. 카드 1장." 예전엔 고부채/저유동성/
// 이익 불안정 3개를 그리드로 다 보여줬는데, 그중 오늘 가장 많이 잡힌
// 타입 하나만 남긴다(전부 없애지 않고 셋 중 제일 신호가 큰 걸 고르는
// 방식 - 자의적으로 하나를 고정하지 않는다).
export default function AvoidSection({ avoidSummary }) {
  const top = [...avoidSummary].sort((a, b) => b.count - a.count)[0];
  if (!top || top.count === 0) return null;

  return (
    <section className="avoidSection">
      <div className="sectionHeaderRow compactHeader">
        <div>
          <h2 className="sectionTitle">오늘은 이런 거 조심</h2>
          <p className="sectionDesc">
            좋은 것만 보여주면 반쪽짜리니까, 조심할 것도 같이 알려드려요.
          </p>
        </div>
      </div>
      <Link href={top.href} className="avoidItem clickable">
        <strong>{top.label}</strong>
        <span>{top.count}개 포착</span>
        <p>{top.desc}</p>
      </Link>
    </section>
  );
}
