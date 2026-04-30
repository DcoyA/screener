import Link from "next/link";
import stocks from "./data/stocks.json";

export default function HomePage() {
  const topStocks = [...stocks]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3);

  return (
    <main className="container">
      <section className="hero">
        <p className="badge">LIVE MVP</p>
        <h1>우량주 스카우터</h1>
        <p className="desc">
          공식 공시·재무·시장 데이터를 바탕으로 후보 종목을 빠르게 탐색하는 MVP입니다.
          지금은 샘플 데이터 3개를 연결한 상태이며, 다음 단계에서 자동 수집 구조로 확장합니다.
        </p>

        <div className="heroActions">
          <Link className="primaryBtn" href="/ranking">
            상위 랭킹 보기
          </Link>
          <Link className="secondaryBtn" href="/stock/005930">
            종목 상세 예시 보기
          </Link>
        </div>
      </section>

      <section>
        <h2 className="sectionTitle">이번 주 상위 후보</h2>

        <div className="cardWrap">
          {topStocks.map((stock) => (
            <div className="card" key={stock.code}>
              <p className="marketBadge">{stock.market}</p>
              <h3>{stock.name}</h3>
              <p className="stockCode">종목코드 {stock.code}</p>
              <p className="scoreLine">총점 {stock.totalScore}점</p>
              <p className="summaryText">{stock.summary}</p>

              <Link className="linkBtn" href={`/stock/${stock.code}`}>
                종목 상세 보기
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
