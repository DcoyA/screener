"use client";

import Link from "next/link";
import notices from "../data/notices.json";

export default function NoticePage() {
  const sortedNotices = [...notices].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const updatedAt = sortedNotices[0]?.date || "-";

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">
            홈으로 가기
          </Link>

          <div className="subNav">
            <Link href="/ranking">랭킹</Link>
            <Link href="/risk">리스크</Link>
            <Link href="/reports">리포트</Link>
          </div>
        </div>

        <section className="pageHero">
          <div>
            <p className="badge">NOTICE BOARD</p>
            <h1>공지사항</h1>
            <p className="desc">
              사이트 운영 공지, 기능 업데이트, 점검 안내를 확인할 수 있는 페이지입니다.
              중요한 변경 사항이나 서비스 관련 안내를 이곳에서 가장 먼저 확인하세요.
            </p>
          </div>

          <div className="updateBox">
            <span className="updateLabel">업데이트</span>
            <strong>{updatedAt}</strong>
          </div>
        </section>

        <div className="noticeList">
          {sortedNotices.map((item) => (
            <article className="noticeCard" key={item.id}>
              <div className="noticeTop">
                <div>
                  <p className="noticeMeta">공지 #{item.id}</p>
                  <h2>{item.title}</h2>
                </div>
                <div className="dateBadge">{item.date}</div>
              </div>

              <p className="noticeContent">{item.content}</p>
            </article>
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

        .subNav a:hover {
          color: #0f172a;
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

        .updateLabel,
        .noticeMeta {
          color: #64748b;
        }

        .updateLabel {
          display: block;
          margin-bottom: 6px;
          font-size: 0.88rem;
          font-weight: 700;
        }

        .noticeList {
          display: grid;
          gap: 18px;
        }

        .noticeCard {
          border-radius: 24px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }

        .noticeTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        h2 {
          margin: 8px 0 0;
          font-size: 1.8rem;
          letter-spacing: -0.03em;
        }

        .dateBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 120px;
          padding: 12px 16px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          font-weight: 800;
        }

        .noticeContent {
          margin: 0;
          color: #475569;
          line-height: 1.8;
          font-size: 1rem;
        }

        @media (max-width: 720px) {
          .container {
            padding: 24px 18px 64px;
          }

          .pageHero,
          .noticeTop {
            flex-direction: column;
          }

          .updateBox {
            width: 100%;
            text-align: left;
          }

          .dateBadge,
          .homeBtn {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
