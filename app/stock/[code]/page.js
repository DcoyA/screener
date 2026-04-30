import Link from "next/link";
import { notFound } from "next/navigation";
import stocks from "../../data/stocks.json";

export default async function StockDetailPage({ params }) {
  const { code } = await params;
  const stock = stocks.find((item) => item.code === code);

  if (!stock) {
    notFound();
  }

  return (
    <main className="container">
      <Link className="backLink" href="/ranking">
        ← 랭킹으로 돌아가기
      </Link>

      <section className="detailHeader">
        <p className="marketBadge">{stock.market}</p>
        <h1>{stock.name}</h1>
        <p className="stockCode">종목코드 {stock.code}</p>
        <p className="desc">{stock.summary}</p>
      </section>

      <section className="twoCol">
        <div className="detailBox">
          <h2>상세 설명</h2>
          <p className="detailText">{stock.description}</p>
        </div>

        <div className="detailBox">
          <h2>리스크 체크</h2>
          <p className="detailText">{stock.risk}</p>
        </div>
      </section>

      <section className="detailBox">
        <h2>점수 구성</h2>

        <div className="scoreGrid">
          <div className="scoreBox">
            <span>총점</span>
            <strong>{stock.totalScore}점</strong>
          </div>

          <div className="scoreBox">
            <span>가치점수</span>
            <strong>{stock.valueScore}점</strong>
          </div>

          <div className="scoreBox">
            <span>품질점수</span>
            <strong>{stock.qualityScore}점</strong>
          </div>

          <div className="scoreBox">
            <span>안정성점수</span>
            <strong>{stock.safetyScore}점</strong>
          </div>

          <div className="scoreBox">
            <span>변화점수</span>
            <strong>{stock.changeScore}점</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
