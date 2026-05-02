import Link from "next/link";
import risks from "../data/risks.json";

function getRiskClass(level) {
  if (level === "주의") return "riskBadge riskHigh";
  if (level === "보통") return "riskBadge riskMid";
  return "riskBadge riskLow";
}

export default function RiskPage() {
  const updatedAt = risks[0]?.date || "-";

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">
            홈으로 가기
          </Link>
          <div className="subNav">
            <Link href="/ranking">랭킹</Link>
            <Link href="/reports">리포트</Link>
          </div>
        </div>

        <section className="pageHero">
          <div>
            <p className="badge">RISK CENTER</p>
            <h1>리스크 페이지</h1>
            <p className="desc">
              종목별로 최근 확인해야 할 위험 신호와 체크 포인트를 정리한
              페이지입니다. 리스크 수준과 함께 다음 확인 항목을 빠르게 볼 수
              있도록 구성했습니다.
            </p>
          </div>
          <div className="updateBox">
            <span className="updateLabel">업데이트</span>
            <strong>{updatedAt}</strong>
          </div>
        </section>

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

              <div className="actionsRow">
                <Link className="linkBtn" href={`/stock/${item.code}`}>
                  종목 상세 보기
                </Link>
                <Link className="ghostBtn" href="/">
                  메인으로 가기
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <style jsx>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          color: #0f172a;
        }
        .topLinks {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 26px;
          flex-wrap: wrap;
        }
        .subNav {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .subNav a {
          color: #475569;
          text-decoration: none;
          font-weight: 700;
        }
        .pageHero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .badge {
          display: inline-flex;
          padding: 8px 14px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.82rem;
          font-weight: 800;
          margin: 0 0 18px;
        }
        h1 {
          margin: 0 0 12px;
          font-size: clamp(2rem, 4vw, 3rem);
          letter-spacing: -0.04em;
        }
        .desc {
          margin: 0;
          max-width: 760px;
          color: #475569;
          line-height: 1.8;
          font-size: 1.02rem;
        }
        .updateBox {
          min-width: 180px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
          text-align: right;
        }
        .updateLabel, .stockCode {
          color: #64748b;
        }
        .updateLabel {
          display: block;
          margin-bottom: 6px;
          font-size: 0.88rem;
          font-weight: 700;
        }
        .riskList {
          display: grid;
          gap: 18px;
        }
        .riskCard {
          border-radius: 24px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }
        .riskTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        h2 {
          margin: 8px 0 10px;
          font-size: 1.8rem;
          letter-spacing: -0.03em;
        }
        .riskTitle {
          margin: 18px 0 10px;
          font-size: 1.2rem;
        }
        .summaryText,
        .checkBox p {
          color: #475569;
          line-height: 1.8;
          margin: 0;
        }
        .checkBox {
          margin-top: 16px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .checkBox strong {
          display: block;
          margin-bottom: 8px;
        }
        .riskBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 72px;
          padding: 10px 14px;
          border-radius: 999px;
          font-weight: 800;
        }
        .riskHigh {
          background: #fee2e2;
          color: #b91c1c;
        }
        .riskMid {
          background: #fef3c7;
          color: #b45309;
        }
        .riskLow {
          background: #dcfce7;
          color: #15803d;
        }
        .actionsRow {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .homeBtn,
        .linkBtn,
        .ghostBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 12px 16px;
          text-decoration: none;
          font-weight: 800;
          border: 1px solid #dbe3f0;
          background: #fff;
          color: #0f172a;
        }
        .homeBtn {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }
        @media (max-width: 720px) {
          .container {
            padding: 24px 18px 64px;
          }
          .pageHero,
          .riskTop {
            flex-direction: column;
          }
          .updateBox {
            width: 100%;
            text-align: left;
          }
        }
      `}</style>
    </>
  );
}
