import { sampleStocks } from "../lib/sampleData";

export default function RankingPage() {
  return (
    <>
      <section className="hero">
        <div className="badge">랭킹</div>
        <h1>점수 상위 종목</h1>
        <p>
          가치·품질·안정성·변화 점수를 합산한 샘플 랭킹 화면입니다.
          다음 단계에서 구글시트의 사이트출력 탭과 연결할 예정입니다.
        </p>
      </section>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>종목코드</th>
              <th>회사명</th>
              <th>총점</th>
              <th>가치</th>
              <th>품질</th>
              <th>안정성</th>
              <th>변화</th>
              <th>리스크</th>
            </tr>
          </thead>
          <tbody>
            {sampleStocks.map((stock) => (
              <tr key={stock.code}>
                <td>{stock.code}</td>
                <td>{stock.name}</td>
                <td>{stock.totalScore}</td>
                <td>{stock.valueScore}</td>
                <td>{stock.qualityScore}</td>
                <td>{stock.safetyScore}</td>
                <td>{stock.changeScore}</td>
                <td>{stock.risk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
