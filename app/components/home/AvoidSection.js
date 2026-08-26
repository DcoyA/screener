import Link from "next/link";

export default function AvoidSection({ avoidSummary }) {
  return (
    <section className="avoidSection">
      <div className="avoidCard">
        <div className="sectionHeaderRow compactHeader">
          <div>
            <h2 className="sectionTitle">오늘은 이런 거 조심</h2>
            <p className="sectionDesc">
              좋은 것만 보여주면 반쪽짜리니까, 조심할 것도 같이 알려드려요.
            </p>
          </div>
        </div>
        <div className="avoidGrid">
          {avoidSummary.map((item) => (
            <Link href={item.href} className="avoidItem clickable" key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.count}개 포착</span>
              <p>{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
