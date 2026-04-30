import Link from "next/link";
import stocks from "./data/stocks.json";

export default function HomePage() {
  const topStocks = stocks.slice(0, 3);


  return (
    <>
      <section className="hero">
        <div className="badge">MVP</div>
        <h1>공시 기반 저평가 스크리너</h1>
        <p>
          공식 공시·재무·시장 데이터를 바탕으로 종목을 탐색하는 MVP입니다.
          지금은 샘플 데이터로 첫 공개 버전을 띄우고, 이후 구글시트 운영판과 연결할 예정입니다.
        </p>

        <div className="buttonRow">
          <Link href="/ranking" className="button">상위 랭킹 보기</Link>
          <Link href="/about" className="button secondary">서비스 설명 보기</Link>
        </div>
      </section>

      <h2 className="section-title">이번 주 상위 후보</h2>
      <div className="grid">
        {topStocks.map((stock) => (
          <div className="card" key={stock.code}>
            <div className="badge">{stock.market}</div>
            <h3>{stock.name}</h3>
            <p className="muted">종목코드 {stock.code}</p>
            <p>총점 {stock.totalScore}점</p>
            <p>{stock.summary}</p>
              <div className="buttonRow">
                <Link href={`/stock/${stock.code}`} className="button secondary">종목 상세 보기</Link>
              </div>
          </div>
        ))}
      </div>

      <div className="notice">
        이 서비스는 투자 판단을 돕기 위한 정보 탐색용 MVP입니다.
        개별 투자상담, 매수·매도 지시, 수익 보장을 제공하지 않습니다.
      </div>
    </>
  );
}
