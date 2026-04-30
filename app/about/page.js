export default function AboutPage() {
  return (
    <>
      <section className="hero">
        <div className="badge">소개 / 면책</div>
        <h1>서비스 소개</h1>
        <p>
          이 MVP는 공식 공시·재무·시장 데이터를 바탕으로 종목을 탐색하고 비교하는 정보 서비스 방향으로 제작 중입니다.
        </p>
      </section>

      <div className="grid">
        <div className="card">
          <h3>제공하는 것</h3>
          <p>점수화된 탐색 결과, 공시 기반 리스크 요약, 주간 변화 리포트</p>
        </div>

        <div className="card">
          <h3>제공하지 않는 것</h3>
          <p>1:1 투자상담, 매수·매도 타이밍 조언, 수익 보장, 자금 운용</p>
        </div>

        <div className="card">
          <h3>현재 상태</h3>
          <p>샘플 데이터 기반 MVP 공개 버전이며, 이후 구글시트 운영판과 연결 예정입니다.</p>
        </div>
      </div>

      <div className="notice">
        본 서비스는 정보 탐색을 위한 참고 자료이며, 투자 결과에 대한 책임은 투자자 본인에게 있습니다.
      </div>
    </>
  );
}
