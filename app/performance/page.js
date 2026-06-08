"use client";

import Link from "next/link";
import history from "../data/history.json";

function getPreviewNames(top10 = []) {
  return top10.slice(0, 3).map((item) => item.name).join(", ");
}

export default function PerformancePage() {
  const latestDate = history[0]?.snapshotDate || "-";

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
            <p className="badge">PERFORMANCE</p>
            <h1>성과/백테스트</h1>
            <p className="desc">
              추천 결과를 주차별로 기록하고, 시간이 지나면서 실제 성과를
              투명하게 공개하기 위한 페이지입니다.
              <br />
              현재는 추천 이력 축적 단계이며, 이후 실제 수익률 비교와 그래프가
              추가될 예정입니다.
            </p>
          </div>

          <div className="updateBox">
            <span className="updateLabel">최신 기록일</span>
            <strong>{latestDate}</strong>
          </div>
        </section>

        <section className="historySection">
          <div className="sectionCard">
            <h2>최근 기록 목록</h2>
            <div className="historyList">
              {history.map((entry) => (
                <div className="historyItem" key={entry.snapshotDate}>
                  <div className="historyMain">
                    <p className="historyWeek">{entry.weekLabel}</p>
                    <p className="historyDate">{entry.snapshotDate}</p>
                    <p className="historyPreview">
                      대표 종목: {getPreviewNames(entry.top10)}
                    </p>
                  </div>

                  <div className="historyMeta">
                    <span className="countBadge">
                      추천 {entry.top10?.length || 0}종목
                    </span>
                    <button type="button" className="detailBtn" disabled>
                      상세 성과 준비 중
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="noticeSection">
          <div className="noticeCard">
            <h2>모델 적용 시 주의사항</h2>
            <div className="noticeGrid">
              <div className="noticeItem">
                <strong>공기업 / 규제 산업</strong>
                <span>정책 변수의 영향이 커서 추가 해석이 필요합니다.</span>
              </div>
              <div className="noticeItem">
                <strong>금융주</strong>
                <span>일반 제조업과 재무 해석 기준이 다를 수 있습니다.</span>
              </div>
              <div className="noticeItem">
                <strong>지주사</strong>
                <span>사업 구조상 단순 비교가 어려울 수 있습니다.</span>
              </div>
              <div className="noticeItem">
                <strong>바이오 / 신약 개발</strong>
                <span>이벤트 리스크가 커서 별도 판단이 필요합니다.</span>
              </div>
            </div>
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
        .updateLabel {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 0.88rem;
          font-weight: 700;
        }
        .historySection,
        .noticeSection {
          margin-top: 24px;
        }
        .sectionCard,
        .noticeCard {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .sectionCard h2,
        .noticeCard h2 {
          margin: 0 0 18px;
          font-size: 1.5rem;
          letter-spacing: -0.03em;
        }
        .historyList {
          display: grid;
          gap: 14px;
        }
        .historyItem {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding: 18px 20px;
          border-radius: 20px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
        }
        .historyWeek {
          margin: 0 0 6px;
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
        }
        .historyDate {
          margin: 0 0 8px;
          color: #64748b;
          font-size: 0.9rem;
        }
        .historyPreview {
          margin: 0;
          color: #475569;
          line-height: 1.7;
        }
        .historyMeta {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: flex-end;
          min-width: 150px;
        }
        .countBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: #ecfeff;
          color: #0891b2;
          font-size: 0.84rem;
          font-weight: 800;
        }
        .detailBtn {
          height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid #dbe3f0;
          background: #f8fafc;
          color: #64748b;
          font-weight: 800;
          cursor: not-allowed;
        }
        .noticeGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .noticeItem {
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 18px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .noticeItem strong {
          font-size: 1rem;
          color: #0f172a;
        }
        .noticeItem span {
          color: #64748b;
          line-height: 1.7;
        }
        @media (max-width: 720px) {
          .container {
            padding: 24px 18px 64px;
          }
          .pageHero,
          .historyItem {
            flex-direction: column;
          }
          .updateBox,
          .historyMeta {
            width: 100%;
            text-align: left;
            align-items: flex-start;
          }
          .noticeGrid {
            grid-template-columns: 1fr;
          }
          .sectionCard,
          .noticeCard {
            padding: 22px;
          }
        }
      `}</style>
    </>
  );
}
