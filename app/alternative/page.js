"use client";

import Link from "next/link";
import MainNav from "../components/MainNav";

export default function AlternativePage() {
  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">홈으로 가기</Link>
          <MainNav />
        </div>

        <section className="heroCard">
          <p className="badge">ALTERNATIVE INVESTMENT</p>
          <h1>대안 투자</h1>
          <p className="desc">
            이 페이지는 현재 점검 중입니다.
            <br />
            개별주 외의 ETF / 배당 / 분산 접근을 다시 정리해서 곧 반영할 예정입니다.
          </p>
        </section>

        <section className="sectionCard">
          <h2>현재 안내</h2>
          <ul className="noteList">
            <li>시장 상태 기반 ETF/대안 접근 로직을 점검 중입니다.</li>
            <li>기존 랭킹과 실전투자 페이지를 먼저 우선 정리하는 방향으로 반영하고 있습니다.</li>
            <li>임시로 이 페이지는 빌드 안정성을 위해 최소 구성으로 유지합니다.</li>
          </ul>
        </section>

        <section className="sectionCard">
          <h2>바로가기</h2>
          <div className="linkGrid">
            <Link href="/final-picks" className="linkBtn">실전투자 보기</Link>
            <Link href="/ranking" className="linkBtn">랭킹 보기</Link>
            <Link href="/risk" className="linkBtn">리스크 보기</Link>
            <Link href="/reports" className="linkBtn">리포트 보기</Link>
          </div>
        </section>
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
        .homeBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 12px 16px;
          text-decoration: none;
          font-weight: 800;
          border: 1px solid #0f172a;
          background: #0f172a;
          color: #fff;
        }
        .heroCard,
        .sectionCard {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 24px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .sectionCard {
          margin-top: 22px;
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
        h2 {
          margin: 0 0 14px;
          font-size: 1.45rem;
          letter-spacing: -0.03em;
        }
        .desc,
        .noteList {
          color: #475569;
          line-height: 1.8;
        }
        .noteList {
          margin: 0;
          padding-left: 20px;
        }
        .linkGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .linkBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 48px;
          border-radius: 14px;
          border: 1px solid #dbe3f0;
          background: #fff;
          color: #0f172a;
          font-weight: 800;
          text-decoration: none;
        }
        @media (max-width: 640px) {
          .container {
            padding: 24px 18px 64px;
          }
          .heroCard,
          .sectionCard {
            padding: 20px;
          }
          .linkGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
