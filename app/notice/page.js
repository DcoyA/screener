"use client";

import Link from "next/link";
import { useState } from "react";
import notices from "../data/notices.json";
import MainNav from "../components/MainNav";

const faqItems = [
  {
    id: 1,
    question: "이 서비스는 누구를 위한 건가요?",
    answer:
      "우량주 스카우터는 공개 재무데이터와 시장 데이터를 바탕으로 직접 종목을 선별하고 싶은 개인 투자자, 후보 종목을 빠르게 좁혀보고 싶은 사용자, 그리고 리포트 형태로 핵심 포인트를 정리해 보고 싶은 사용자를 위한 서비스입니다. 복잡한 원천 데이터를 직접 뒤지기보다 랭킹·리스크·리포트 형태로 정리된 정보를 한 번에 확인할 수 있도록 구성했습니다.",
  },
  {
    id: 2,
    question: "프리미엄 리포트는 어떤 기준으로 언제 발송되나요?",
    answer:
      "프리미엄 리포트는 OpenDART 공시와 KRX 시장 데이터를 기반으로 재무 안정성, 저평가 여부, 시장성, 변화 흐름 등을 종합 반영해 선정한 종목을 중심으로 발송됩니다. 화요일 오전에는 상위 후보 종목 상세 분석 리포트가, 목요일 오후에는 한 주 흐름을 정리하는 복기 리포트가 발송됩니다.",
  },
  {
    id: 3,
    question: "무료 서비스인가요?",
    answer:
      "네. 현재는 무료로 운영 중입니다. 서비스 구조와 리포트 품질을 안정화하는 단계이며, 일부 기능과 리포트는 무료 체험 형태로 제공되고 있습니다. 추후 운영 정책이 변경될 경우에는 공지사항을 통해 먼저 안내드릴 예정입니다.",
  },
  {
    id: 4,
    question: "건의나 상세 문의사항은 어디로 하면 되나요?",
    answer:
      "서비스 관련 건의, 개선 요청, 상세 문의는 화면 우측 하단의 오픈카톡 문의 버튼을 통해 접수하실 수 있습니다. 자주 들어오는 질문이나 중요한 내용은 FAQ 또는 공지사항에 반영될 수 있습니다.",
  },
  {
    id: 5,
    question: "종목 추천 서비스인가요?",
    answer:
      "우량주 스카우터는 공개 데이터를 바탕으로 후보 종목을 정리해 보여주는 정보 서비스이며, 특정 종목의 매수·매도를 직접 권유하는 투자 자문 서비스는 아닙니다. 최종 투자 판단은 사용자 본인의 책임하에 이루어져야 합니다.",
  },
  {
    id: 6,
    question: "데이터는 언제 업데이트 되나요?",
    answer:
      "홈페이지는 매 평일마다 오후 2시경 업데이트 됩니다.",
  },
];

export default function NoticePage() {
  const [openFaqId, setOpenFaqId] = useState(1);

  const sortedNotices = [...notices].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const updatedAt = sortedNotices[0]?.date || "-";

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">홈으로 가기</Link>
          <MainNav />
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

        <section className="faqSection">
          <div className="faqCard">
            <div className="faqHeader">
              <div>
                <p className="faqEyebrow">FAQ</p>
                <h2 className="faqTitle">자주 묻는 질문</h2>
              </div>
              <p className="faqDesc">
                서비스 이용 전 많이 묻는 질문을 먼저 정리해두었습니다.
              </p>
            </div>

            <div className="faqList">
              {faqItems.map((item) => {
                const isOpen = openFaqId === item.id;

                return (
                  <div className="faqItem" key={item.id}>
                    <button
                      type="button"
                      className="faqQuestion"
                      onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                    >
                      <span>{item.question}</span>
                      <span className={`faqIcon ${isOpen ? "open" : ""}`}>⌄</span>
                    </button>

                    {isOpen ? <div className="faqAnswer">{item.answer}</div> : null}
                  </div>
                );
              })}
            </div>
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

        .badge,
        .faqEyebrow {
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

        .faqSection {
          margin-bottom: 28px;
        }

        .faqCard {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }

        .faqHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }

        .faqTitle {
          margin: 0;
          font-size: 1.5rem;
          letter-spacing: -0.03em;
        }

        .faqDesc {
          margin: 0;
          max-width: 420px;
          color: #64748b;
          line-height: 1.7;
          font-size: 0.95rem;
        }

        .faqList {
          display: grid;
          gap: 12px;
        }

        .faqItem {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          background: #ffffff;
          overflow: hidden;
        }

        .faqQuestion {
          width: 100%;
          border: none;
          background: transparent;
          padding: 18px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          text-align: left;
          font-size: 1rem;
          font-weight: 800;
          color: #0f172a;
          cursor: pointer;
        }

        .faqIcon {
          flex-shrink: 0;
          font-size: 1.1rem;
          transition: transform 0.2s ease;
        }

        .faqIcon.open {
          transform: rotate(180deg);
        }

        .faqAnswer {
          padding: 0 20px 20px;
          color: #475569;
          line-height: 1.8;
          font-size: 0.98rem;
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
          white-space: pre-line;
        }

        @media (max-width: 720px) {
          .container {
            padding: 24px 18px 64px;
          }

          .pageHero,
          .noticeTop,
          .faqHeader {
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

          .faqCard {
            padding: 22px;
          }

          .faqQuestion {
            padding: 16px 18px;
          }

          .faqAnswer {
            padding: 0 18px 18px;
          }
        }
      `}</style>
    </>
  );
}
