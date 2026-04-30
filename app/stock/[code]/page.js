import Link from "next/link";
import { notFound } from "next/navigation";
import stocks from "../../data/stocks.json";

export default function StockDetailPage({ params }) {
  const stock = stocks.find((item) => item.code === params.code);

  if (!stock) {
    notFound();
  }

  return (
    <>
      <section className="hero">
        <div className="badge">{stock.market}</div>
        <h1>{stock.name}</h1>
        <p>
          종목코드 {stock.code} · 총점 {stock.totalScore}점
        </p>

        <div className="buttonRow">
          <Link href="/ranking" className="button">랭킹으로 돌아가기</Link>
          <Link href="/" className="button secondary">홈으로 이동</Link>
        </div>
      </section>

      <h2 className="section-title">한줄 해석</h2>
      <div className="card">
        <p>{stock.summary}</p>
        <p className="muted">{stock.description}</p>
      </div>

      <h2 className="section-title">점수 구성</h2>
      <div className="grid">
        <div className="card">
          <h3>총점</h3>
          <p>{stock.totalScore}점</p>
        </div>
        <div className="card">
          <h3>가치</h3>
          <p>{stock.valueScore}점</p>
        </div>
        <div className="card">
          <h3>품질</h3>
          <p>{stock.qualityScore}점</p>
        </div>
        <div className="card">
          <h3>안정성</h3>
          <p>{stock.safetyScore}점</p>
        </div>
        <div className="card">
          <h3>변화</h3>
          <p>{stock.changeScore}점</p>
        </div>
        <div className="card">
          <h3>리스크</h3>
          <p>{stock.risk}</p>
        </div>
      </div>

      <div className="notice">
        이 페이지는 MVP용 종목 상세 화면입니다. 현재는 JSON 데이터 기반이며,
        다음 단계에서 구글시트의 사이트출력 데이터와 연결할 예정입니다.
      </div>
    </>
  );
}
