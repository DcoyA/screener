"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import stocks from "./data/stocks.json";
import Image from "next/image";

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const topStocks = useMemo(
    () => [...stocks].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3),
    []
  );
  const updatedAt = topStocks[0]?.updatedAt || stocks[0]?.updatedAt || "-";

  const openModal = () => {
    setIsModalOpen(true);
    setIsSubmitted(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEmail("");
    setIsSubmitted(false);
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await fetch("https://script.google.com/macros/s/AKfycbxTLAQ_ejctFLsfAy08wENtSIot0668R347i4neTXB7K6lEmgFwYsvjgg_X8xld37-q7A/exec", {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch (err) {
      // no-cors 모드에서는 응답을 못 읽지만 전송은 됨
   }

  setIsSubmitted(true);
};


  return (
    <>
      <main className="container">
        <header className="topBar">
          <Link href="/" className="brandArea">
            <Image
              src="/logo.png"
              alt="우량주 스카우터 로고"
              width={32}
              height={32}
              className="brandLogo"
            />
            <span className="brandTitle">우량주 스카우터</span>
          </Link>

          <nav className="mainNav" aria-label="주요 메뉴">
            <Link href="/ranking">랭킹</Link>
            <Link href="/risk">리스크</Link>
            <Link href="/reports">리포트</Link>
          </nav>
        </header>

        <section className="hero">
          <div className="heroTop">
            <div className="heroMain">
              <p className="badge">OFFICIAL DATA LIVE</p>
              <h1>우량주 스카우터</h1>
              <p className="desc">
                우량주 스카우터는 OpenDART 전자공시와 KRX 시장 데이터를 매주 월요일
                오전 9시에 자동 수집하고, AI가 재무 건전성·저평가 여부·시장
                유동성을 함께 분석해 상위 후보 종목을 정리해주는 공식 데이터 기반
                주식 리서치 서비스입니다. PER, PBR, ROE, 부채비율, 시가총액,
                최근 5영업일 평균 거래대금 등을 종합 반영해 랭킹·리스크·리포트
                형태로 제공합니다.
              </p>

              <div className="heroActions">
                <Link className="primaryBtn" href="/ranking">
                  상위 랭킹 보기
                </Link>
                <Link className="secondaryBtn" href="/reports">
                  이번 주 리포트 보기
                </Link>
              </div>
            </div>

            <aside className="updateBox" aria-label="업데이트 날짜">
              <span className="updateLabel">업데이트</span>
              <strong>{updatedAt}</strong>
              <p className="updateDesc">최근 자동 수집 및 분석 반영일</p>
            </aside>
          </div>
        </section>

        <section className="quickLinksSection">
          <div className="quickLinksCard">
            <h2>서비스 바로가기</h2>
            <div className="quickLinksGrid">
              <Link href="/ranking" className="quickLinkItem">
                <strong>랭킹</strong>
                <span>AI 점수 기준 상위 종목 보기</span>
              </Link>
              <Link href="/risk" className="quickLinkItem">
                <strong>리스크</strong>
                <span>주의 종목과 체크포인트 확인</span>
              </Link>
              <Link href="/reports" className="quickLinkItem">
                <strong>리포트</strong>
                <span>주간 요약과 핵심 후보 정리</span>
              </Link>
            </div>
          </div>
        </section>

        <section>
          <h2 className="sectionTitle">이번 주 상위 후보</h2>

          <div className="cardWrap">
            {topStocks.map((stock) => (
              <div className="card" key={stock.code}>
                <p className="marketBadge">{stock.market}</p>
                <h3>{stock.name}</h3>
                <p className="stockCode">종목코드 {stock.code}</p>
                <p className="scoreLine">총점 {stock.totalScore}점</p>
                <p className="summaryText">{stock.summary}</p>

                <Link className="linkBtn" href={`/stock/${stock.code}`}>
                  종목 상세 보기
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="subscribeSection">
          <div className="subscribeCard">
            <p className="subscribeEyebrow">FREE TRIAL OPEN</p>
            <h2>메일로 받아보는 상위 3개 종목 상세 리포트</h2>
            <p className="subscribeDesc">
              주별 상위 3개 종목의 심층분석 핵심 포인트를 이메일로
              받아보세요. 현재는 무료 체험 기간으로 운영 중이며, 신청자에게
              우선 제공됩니다. <br> 
              매주 월요일 8시 10분 새로운 전략과 매주 목요일 20시 30분 한주에 대한 복기를 제공해 드립니다.
            </p>
            <button type="button" className="primaryBtn" onClick={openModal}>
              무료로 신청하기
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footerInner">
          <p>HELLO MEDIA · All rights reserved.</p>
          <a href="mailto:iamborghini5757@gmail.com">iamborghini5757@gmail.com</a>
        </div>
      </footer>

      {isModalOpen && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="closeBtn"
              onClick={closeModal}
              aria-label="팝업 닫기"
            >
              ×
            </button>

            {!isSubmitted ? (
              <>
                <p className="modalBadge">무료 체험</p>
                <h3>상위 3개 종목 리포트 무료 신청</h3>
                <p className="modalDesc">
                  현재 무료 체험 기간입니다. 이메일 주소를 남겨주시면 매일 상위
                  3개 종목 상세 리포트 제공 대상에 우선 등록됩니다.
                </p>

                <form className="subscribeForm" onSubmit={handleSubscribe}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소를 입력해주세요"
                    required
                  />
                  <div className="modalActions">
                    <button type="button" className="ghostBtn" onClick={closeModal}>
                      닫기
                    </button>
                    <button type="submit" className="primaryBtn">
                      구독하기
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="successBox">
                <p className="modalBadge">신청 완료</p>
                <h3>접수가 완료되었습니다</h3>
                <p className="modalDesc">
                  신청이 접수되었습니다. 무료 체험 오픈 안내 및 리포트 제공 소식을
                  이메일로 보내드릴게요.
                </p>
                <div className="modalActions singleAction">
                  <button type="button" className="primaryBtn" onClick={closeModal}>
                    확인
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          color: #0f172a;
        }

        .topBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }

        .brandArea {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        
        .brandLogo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }


        .brandTitle {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .mainNav {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
        }

        .mainNav a {
          color: #334155;
          text-decoration: none;
          font-weight: 700;
        }

        .mainNav a:hover {
          color: #0f172a;
        }

        .hero {
          padding: 20px 0 8px;
        }

        .heroTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          flex-wrap: wrap;
        }

        .heroMain {
          flex: 1 1 720px;
          min-width: 0;
        }

        .badge,
        .subscribeEyebrow,
        .modalBadge {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          margin: 0 0 18px;
        }

        h1 {
          font-size: clamp(2.2rem, 5vw, 3.5rem);
          line-height: 1.1;
          letter-spacing: -0.04em;
          margin: 0 0 16px;
        }

        .desc {
          max-width: 920px;
          font-size: 1.08rem;
          line-height: 1.9;
          color: #475569;
          margin: 0;
        }

        .updateBox {
          min-width: 200px;
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

        .updateBox strong {
          display: block;
          font-size: 1.15rem;
          color: #0f172a;
        }

        .updateDesc {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.5;
        }

        .heroActions,
        .modalActions {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 28px;
        }

        .primaryBtn,
        .secondaryBtn,
        .linkBtn,
        .ghostBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 14px 18px;
          font-weight: 800;
          text-decoration: none;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.98rem;
        }

        .primaryBtn {
          background: #0f172a;
          color: #ffffff;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        }

        .primaryBtn:hover {
          background: #111827;
        }

        .secondaryBtn,
        .ghostBtn,
        .linkBtn {
          background: #ffffff;
          color: #0f172a;
          border-color: #dbe3f0;
        }

        .secondaryBtn:hover,
        .ghostBtn:hover,
        .linkBtn:hover {
          background: #f8fafc;
        }

        .quickLinksSection {
          margin-top: 34px;
        }

        .quickLinksCard,
        .subscribeCard {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }

        .quickLinksCard h2,
        .subscribeCard h2 {
          margin: 0 0 16px;
          font-size: 1.6rem;
          letter-spacing: -0.03em;
        }

        .quickLinksGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .quickLinkItem {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-decoration: none;
          padding: 20px;
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          color: #0f172a;
        }

        .quickLinkItem strong {
          font-size: 1.05rem;
        }

        .quickLinkItem span {
          color: #64748b;
          line-height: 1.6;
        }

        .sectionTitle {
          margin: 56px 0 22px;
          font-size: 2rem;
          letter-spacing: -0.03em;
        }

        .cardWrap {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .card {
          border-radius: 24px;
          padding: 22px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }

        .marketBadge {
          display: inline-flex;
          padding: 7px 12px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 800;
          margin: 0 0 18px;
        }

        .card h3 {
          margin: 0 0 12px;
          font-size: 1.4rem;
          letter-spacing: -0.03em;
          word-break: keep-all;
        }

        .stockCode,
        .scoreLine {
          margin: 0 0 8px;
          color: #64748b;
          font-weight: 600;
        }

        .summaryText {
          min-height: 92px;
          margin: 10px 0 18px;
          color: #475569;
          line-height: 1.75;
          word-break: keep-all;
        }

        .subscribeSection {
          margin-top: 56px;
        }

        .subscribeDesc,
        .modalDesc {
          margin: 0;
          color: #475569;
          line-height: 1.8;
          font-size: 1rem;
        }

        .footer {
          border-top: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .footerInner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 28px 24px 44px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          color: #64748b;
        }

        .footerInner p {
          margin: 0;
        }

        .footerInner a {
          color: #0f172a;
          text-decoration: none;
          font-weight: 700;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modalCard {
          position: relative;
          width: min(100%, 560px);
          background: #ffffff;
          border-radius: 28px;
          padding: 30px;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.25);
        }

        .modalCard h3 {
          margin: 0 0 12px;
          font-size: 1.7rem;
          letter-spacing: -0.03em;
        }

        .closeBtn {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: none;
          background: #f1f5f9;
          font-size: 1.5rem;
          cursor: pointer;
        }

        .subscribeForm {
          margin-top: 22px;
        }

        .subscribeForm input {
          width: 100%;
          height: 54px;
          border-radius: 14px;
          border: 1px solid #cbd5e1;
          padding: 0 16px;
          font-size: 1rem;
          outline: none;
          box-sizing: border-box;
        }

        .subscribeForm input:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
        }

        .singleAction {
          justify-content: flex-start;
        }

        @media (max-width: 900px) {
          .quickLinksGrid,
          .cardWrap {
            grid-template-columns: 1fr;
          }

          .heroTop {
            flex-direction: column;
          }

          .updateBox {
            width: 100%;
            text-align: left;
          }
        }

        @media (max-width: 640px) {
          .container {
            padding: 24px 18px 64px;
          }

          .topBar {
            align-items: flex-start;
            margin-bottom: 28px;
          }

          .heroActions,
          .modalActions {
            flex-direction: column;
          }

          .primaryBtn,
          .secondaryBtn,
          .ghostBtn,
          .linkBtn {
            width: 100%;
          }

          .quickLinksCard,
          .subscribeCard,
          .card,
          .modalCard {
            padding: 22px;
          }

          .summaryText {
            min-height: auto;
          }
        }
      `}</style>
    </>
  );
}
