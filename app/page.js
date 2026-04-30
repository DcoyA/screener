export default function HomePage() {
  return (
    <main className="container">
      <section className="hero">
        <p className="badge">MVP TEST</p>
        <h1>우량주 스카우터</h1>
        <p className="desc">
          OpenDART와 KRX 데이터를 바탕으로 저평가 후보 종목과 리스크를 정리하는 MVP입니다.
        </p>

        <div className="cardWrap">
          <div className="card">
            <h2>이번 단계 목표</h2>
            <p>Next.js 기본 구조를 올리고 첫 배포를 성공시키는 것</p>
          </div>

          <div className="card">
            <h2>다음 단계 예정</h2>
            <p>랭킹 페이지, 종목 상세 페이지, JSON 데이터 연결</p>
          </div>

          <div className="card">
            <h2>데이터 소스</h2>
            <p>OpenDART / KRX Open API</p>
          </div>
        </div>
      </section>
    </main>
  );
}
