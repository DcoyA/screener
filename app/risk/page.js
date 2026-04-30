import risks from "../data/risks.json";

export default function RiskPage() {
  return (
    <>
      <section className="hero">
        <div className="badge">위험 공시</div>
        <h1>최근 체크가 필요한 이벤트</h1>
        <p>
          유상증자, CB/BW, 감사의견, 지배구조 변화 같은 이벤트를
          별도로 모아 보여주는 화면이 들어갈 자리입니다.
        </p>
      </section>

      <div className="grid">
        {risks.map((risk) => (
          <div className="card" key={`${risk.code}-${risk.date}`}>
            <div className="badge">{risk.severity} 위험도</div>
            <h3>{risk.name}</h3>
            <p className="muted">{risk.date} · {risk.type}</p>
            <p>{risk.summary}</p>
          </div>
        ))}
      </div>
    </>
  );
}
