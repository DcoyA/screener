import Link from "next/link";
import stocks from "../data/stocks.json";

export default function RankingPage() {
  const rankedStocks = [...stocks].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <main className="container">
      <p className="badge">RANKING</p>
      <h1>종목 랭킹</h1>
      <p className="desc">
        현재는 샘플 종목 3개 기준이며, 이후 자동 수집 데이터로 매주 갱신할 예정입니다.
      </p>

      <div className="listWrap">
        {rankedStocks.map((stock, index) => (
          <div className="listCard" key={stock.code}>
            <div className="listTop">
              <div>
                <p className="muted">#{index + 1}</p>
                <h2>{stock.name}</h2>
                <p className="stockCode">
                  {stock.market} · {stock.code}
                </p>
              </div>

              <div className="scoreBadge">{stock.totalScore}점</div>
            </div>

            <p className="summaryText">{stock.summary}</p>

            <Link className="linkBtn" href={`/stock/${stock.code}`}>
              종목 상세 보기
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
