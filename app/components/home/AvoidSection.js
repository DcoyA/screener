import Link from "next/link";

export default function AvoidSection({ avoidSummary }) {
  return (
    <section className="avoidSection">
      <div className="avoidCard">
        <div className="sectionHeaderRow compactHeader">
          <div>
            <h2 className="sectionTitle">오늘은 피해야 할 타입</h2>
            <p className="sectionDesc">
              추천만 보여주면 오해가 생기니까, 지금 시장에서 같이 조심해야 할 타입도 따로 분리했습니다.
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
