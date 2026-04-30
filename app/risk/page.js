import Link from "next/link";
import risks from "../data/risks.json";

function getRiskClass(level) {
  if (level === "주의") return "riskBadge riskHigh";
  if (level === "보통") return "riskBadge riskMid";
  return "riskBadge riskLow";
}

export default function RiskPage() {
  return (
    <main className="container">
      <p className="badge">RISK CENTER</p>
      <h1>리스크 페이지</h1>
      <p className="desc">
        종목별로 최근 체크해야 할 위험 신호와 확인 포인트를 정리한 페이지입니다.
      </p>

      <div className="riskList">
        {risks.map((item) => (
          <div className="riskCard" key={item.code}>
            <div className="riskTop">
              <div>
                <p className="stockCode">{item.date}</p>
                <h2>{item.name}</h2>
                <p className="stockCode">종목코드 {item.code}</p>
              </div>

              <span className={getRiskClass(item.level)}>{item.level}</span>
            </div>

            <h3 className="riskTitle">{item.title}</h3>
            <p className="summaryText">{item.summary}</p>

            <div className="checkBox">
              <strong>체크 포인트</strong>
              <p>{item.checkPoint}</p>
            </div>

            <Link className="linkBtn" href={`/stock/${item.code}`}>
              종목 상세 보기
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
