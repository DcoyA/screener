"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import stocks from "./data/stocks.json";
import notices from "./data/notices.json";
import Image from "next/image";

const SUBSCRIBE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxTLAQ_ejctFLsfAy08wENtSIot0668R347i4neTXB7K6lEmgFwYsvjgg_X8xld37-q7A/exec";

function formatKstDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function createUnsubscribeToken(emailValue) {
  const safeEmail = emailValue.toLowerCase().replace(/[^a-z0-9]/gi, "");
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `sub_${safeEmail.slice(0, 12)}_${Date.now()}_${randomPart}`;
}

function getRankBadgeClass(rank) {
  if (rank === 1) return "rankBadge rank1";
  if (rank === 2) return "rankBadge rank2";
  if (rank === 3) return "rankBadge rank3";
  return "rankBadge rankDefault";
}

function formatPrice(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function getUpsideClass(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "upsideLine";
  if (num > 0) return "upsideLine upsidePositive";
  if (num < 0) return "upsideLine upsideNegative";
  return "upsideLine upsideNeutral";
}

function sortForTopCandidates(items) {
  return [...items].sort((a, b) => {
    const aEligible = a?.rankMeta?.topRankEligible ? 1 : 0;
    const bEligible = b?.rankMeta?.topRankEligible ? 1 : 0;
    if (bEligible !== aEligible) return bEligible - aEligible;

    const aScore = Number(a?.totalScore ?? 0);
    const bScore = Number(b?.totalScore ?? 0);
    if (bScore !== aScore) return bScore - aScore;

    const aLiquidity = Number(a?.metrics?.avgTradeValue5d ?? 0);
    const bLiquidity = Number(b?.metrics?.avgTradeValue5d ?? 0);
    if (bLiquidity !== aLiquidity) return bLiquidity - aLiquidity;

    const aMarketCap = Number(a?.metrics?.marketCap ?? 0);
    const bMarketCap = Number(b?.metrics?.marketCap ?? 0);
    return bMarketCap - aMarketCap;
  });
}

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const latestNotice = [...notices].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const topStocks = useMemo(
    () =>
      sortForTopCandidates(stocks)
        .slice(0, 3)
        .map((stock, index) => ({
          ...stock,
          originalRank: index + 1,
        })),
    []
  );

  const updatedAt = topStocks[0]?.updatedAt || stocks[0]?.updatedAt || "-";
  const topEligibleCount = useMemo(
    () => stocks.filter((item) => item?.rankMeta?.topRankEligible).length,
    []
  );

  const openModal = () => {
    setIsModalOpen(true);
    setIsSubmitted(false);
    setSubmitError("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEmail("");
    setIsSubmitted(false);
    setIsSubmitting(false);
    setSubmitError("");
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setIsSubmitting(true);
    setSubmitError("");

    const payload = {
      email: normalizedEmail,
      subscribed_at: formatKstDateTime(),
      plan: "premium",
      status: "active",
      source: "site_popup",
      last_sent_at: "",
      last_report_id: "",
      unsubscribe_token: createUnsubscribeToken(normalizedEmail),
    };

    try {
      const body = new URLSearchParams(payload).toString();
      await fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
      });
      setIsSubmitted(true);
      setEmail("");
    } catch (err) {
      setSubmitError("신청 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
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
            <Link href="/notice">공지</Link>
            <Link href="/performance">성과/백테스트</Link>
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
                우량주 스카우터는 OpenDART 전자공시와 KRX 시장 데이터를 매주 월요일 오전 9시에 자동 수집하고,
                AI가 재무 건전성·저평가 여부·시장 유동성을 함께 분석해 상위 후보 종목을 정리해주는 공식 데이터 기반 주식 리서치 서비스입니다.
                PER, PBR, ROE, 부채비율, 시가총액, 최근 5영업일 평균 거래대금 등을 종합 반영해 랭킹·리스크·리포트 형태로 제공합니다.
                메인 상위 카드는 종합 점수뿐 아니라 안정성 조건을 통과한 후보를 우선 반영합니다.
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
              <p className="updateSubDesc">종합 상위 후보 {topEligibleCount}종목</p>
            </aside>

            <div className="heroCharacter" aria-hidden="true">
              <div className="heroCharacterGlow" />
              <Image
                src="/vegeta-style.png"
                alt=""
                fill
                className="heroCharacterImage"
                priority
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="sectionTitle">이번 주 상위 후보</h2>
          <p className="sectionHelper">
            종합 점수와 함께 재무 안정성 조건을 통과한 종목을 우선 반영하며, 저평가·상승여력 관점은 랭킹 탭에서 별도로 비교할 수 있습니다.
          </p>
          <div className="cardWrap">
            {topStocks.map((stock) => {
              const eligible = !!stock?.rankMeta?.topRankEligible;
              const penalty = Number(stock?.rankMeta?.penalty || 0);
              const flags = stock?.rankMeta?.flags || [];

              return (
                <div className="card" key={stock.code}>
                  <div className="candidateRankRow">
                    <div className={getRankBadgeClass(stock.originalRank)}>
                      <span className="rankHash">#</span>
                      <span className="rankNumber">{stock.originalRank}</span>
                    </div>
                    <p className="marketBadge">{stock.market}</p>
                  </div>

                  <h3>{stock.name}</h3>
                  <p className="stockCode">종목코드 {stock.code}</p>

                  <div className="candidateMetaBadges">
                    {eligible ? (
                      <span className="candidateMetaBadge good">종합 상위 후보</span>
                    ) : (
                      <span className="candidateMetaBadge warn">종합 상위 제외</span>
                    )}
                    {penalty > 0 ? (
                      <span className="candidateMetaBadge muted">패널티 {penalty}</span>
                    ) : null}
                    {flags.map((flag) => (
                      <span className="candidateMetaBadge soft" key={flag}>{flag}</span>
                    ))}
                  </div>

                  <div className="candidatePriceMeta">
                    <div className="candidatePriceItem">
                      <span className="candidatePriceLabel">최근 종가</span>
                      <strong className="priceLine">{formatPrice(stock.metrics?.closePrice)}</strong>
                    </div>
                    <div className="candidatePriceItem">
                      <span className="candidatePriceLabel">적정가 추정</span>
                      <strong className="targetLine">{formatPrice(stock.metrics?.targetPrice)}</strong>
                    </div>
                  </div>

                  <p className={getUpsideClass(stock.metrics?.upside)}>
                    상승여력 {formatPercent(stock.metrics?.upside)}
                  </p>
                  <p className="scoreLine">총점 {stock.totalScore}점</p>
                  <p className="summaryText">{stock.summary}</p>

                  <Link className="linkBtn" href={`/stock/${stock.code}`}>
                    종목 상세 보기
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        <section className="subscribeSection">
          <div className="subscribeCard">
            <p className="subscribeEyebrow">FREE TRIAL OPEN</p>
            <h2>메일로 받아보는 상위 5개 종목 상세 리포트</h2>
            <p className="subscribeDesc">
              주별 상위 5개 종목의 심층분석 핵심 포인트를 이메일로 받아보세요. 매주 화요일 새로운 전략과 목요일 한 주에 대한 복기를 제공합니다. <br />
              현재 무료 체험 기간으로 운영 중! (네이버 메일은 정상적으로 보이지 않을 수 있습니다. 가급적 구글 메일을 기재해 주세요.)
            </p>
            <div className="subscribeActions">
              <a
                href="/sample-report.html"
                target="_blank"
                rel="noopener noreferrer"
                className="secondaryBtn"
              >
                샘플 리포트 보기
              </a>
              <button type="button" className="primaryBtn" onClick={openModal}>
                무료로 신청하기
              </button>
            </div>
          </div>
        </section>

        <section className="quickLinksSection">
          <div className="quickLinksCard">
            <h2>서비스 바로가기</h2>
            <div className="quickLinksGrid">
              <Link href="/notice" className="quickLinkItem">
                <strong>📢 공지</strong>
                <span>사이트 업데이트 안내</span>
              </Link>
              <Link href="/performance" className="quickLinkItem">
                <strong>📢 성과/백테스트</strong>
                <span>추천종목 실제 투자결과</span>
              </Link>
              <Link href="/ranking" className="quickLinkItem">
                <strong>🏆 랭킹</strong>
                <span>AI 점수 기준 상위 종목 보기</span>
              </Link>
              <Link href="/risk" className="quickLinkItem">
                <strong>⚠️ 리스크</strong>
                <span>주의 종목과 체크포인트 확인</span>
              </Link>
              <Link href="/reports" className="quickLinkItem">
                <strong>📝 리포트</strong>
                <span>주간 요약과 핵심 후보 정리</span>
              </Link>
            </div>
          </div>
        </section>

        {latestNotice ? (
          <section className="noticePreviewSection">
            <div className="noticePreviewWrap">
              <Link href="/notice" className="noticePreviewCard">
                <div className="noticePreviewTopLine">
                  <span className="noticePreviewBadge">📢 공지</span>
                  <span className="noticePreviewDate">{latestNotice.date}</span>
                </div>
                <div className="noticePreviewBody">
                  <h2>{latestNotice.title}</h2>
                  <p className="noticePreviewText">{latestNotice.content}</p>
                </div>
              </Link>
            </div>
          </section>
        ) : null}
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
                <h3>상위 5개 종목 리포트 무료 신청</h3>
                <p className="modalDesc">
                  현재 무료 체험 기간입니다. 이메일 주소를 남겨주시면 주 2회 발송되는 상위 5개 종목 상세 리포트 제공 대상에 우선 등록됩니다.
                </p>
                <form className="subscribeForm" onSubmit={handleSubscribe}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일 주소를 입력해주세요"
                    required
                  />
                  {submitError ? <p className="errorText">{submitError}</p> : null}
                  <div className="modalActions">
                    <button type="button" className="ghostBtn" onClick={closeModal}>
                      닫기
                    </button>
                    <button type="submit" className="primaryBtn" disabled={isSubmitting}>
                      {isSubmitting ? "저장 중..." : "구독하기"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="successBox">
                <p className="modalBadge">신청 완료</p>
                <h3>접수가 완료되었습니다</h3>
                <p className="modalDesc">
                  신청이 접수되었습니다. 무료 체험 오픈 안내 및 리포트 제공 소식을 이메일로 보내드릴게요.
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
          position: relative;
          overflow: hidden;
          padding: 20px 0 8px;
        }
        .hero::before {
          content: "";
          position: absolute;
          right: -40px;
          top: 10px;
          width: 340px;
          height: 340px;
          background: radial-gradient(circle, rgba(0, 255, 100, 0.16), transparent 68%);
          filter: blur(42px);
          pointer-events: none;
          z-index: 0;
        }
        .heroTop {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          flex-wrap: wrap;
          min-height: 420px;
          z-index: 1;
        }
        .heroMain {
          position: relative;
          z-index: 2;
          flex: 1 1 720px;
          min-width: 0;
          max-width: 760px;
        }
        .heroCharacter {
          position: absolute;
          right: -10px;
          bottom: -20px;
          width: min(42vw, 520px);
          height: min(42vw, 520px);
          max-width: 520px;
          max-height: 520px;
          opacity: 1;
          pointer-events: none;
          transition: opacity 0.5s ease, transform 0.2s ease;
          z-index: 1;
          overflow: hidden;
        }
        .hero:hover .heroCharacter {
          opacity: 0.5;
          transform: translateY(-4px);
        }
        .heroCharacterGlow {
          position: absolute;
          inset: 16% 18% 18% 18%;
          background: radial-gradient(circle, rgba(120, 255, 160, 0.22), transparent 72%);
          filter: blur(24px);
          z-index: 0;
        }
        .heroCharacterImage {
          object-fit: contain;
          object-position: left bottom;
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
          position: relative;
          z-index: 2;
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
        .updateSubDesc {
          margin: 8px 0 0;
          color: #334155;
          font-size: 0.9rem;
          line-height: 1.5;
          font-weight: 700;
        }
        .heroActions,
        .modalActions,
        .subscribeActions {
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
        .primaryBtn:disabled,
        .ghostBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
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
        .sectionTitle {
          margin: 56px 0 10px;
          font-size: 2rem;
          letter-spacing: -0.03em;
        }
        .sectionHelper {
          margin: 0 0 22px;
          color: #64748b;
          line-height: 1.8;
          font-size: 0.98rem;
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
        .candidateRankRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .rankBadge {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 72px;
          height: 72px;
          border-radius: 22px;
          padding: 0 14px;
          font-weight: 900;
          letter-spacing: -0.04em;
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
          border: 1px solid transparent;
          flex-shrink: 0;
        }
        .rankHash {
          font-size: 1rem;
          line-height: 1;
          margin-right: 2px;
          opacity: 0.92;
        }
        .rankNumber {
          font-size: 1.8rem;
          line-height: 1;
        }
        .rank1 {
          background: linear-gradient(135deg, #facc15 0%, #f59e0b 100%);
          color: #111827;
          border-color: rgba(245, 158, 11, 0.35);
        }
        .rank2 {
          background: linear-gradient(135deg, #e5e7eb 0%, #94a3b8 100%);
          color: #0f172a;
          border-color: rgba(148, 163, 184, 0.38);
        }
        .rank3 {
          background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
          color: #fff;
          border-color: rgba(146, 64, 14, 0.35);
        }
        .rankDefault {
          background: #f8fafc;
          color: #334155;
          border-color: #e2e8f0;
          box-shadow: none;
        }
        .marketBadge {
          display: inline-flex;
          padding: 7px 12px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 800;
          margin: 0;
        }
        .card h3 {
          margin: 0 0 12px;
          font-size: 1.4rem;
          letter-spacing: -0.03em;
          word-break: keep-all;
        }
        .stockCode {
          margin: 0 0 10px;
          color: #64748b;
          font-weight: 600;
        }
        .candidateMetaBadges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 0 0 12px;
        }
        .candidateMetaBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 800;
        }
        .candidateMetaBadge.good {
          background: #ecfeff;
          color: #0891b2;
        }
        .candidateMetaBadge.warn {
          background: #fff7ed;
          color: #c2410c;
        }
        .candidateMetaBadge.muted {
          background: #f1f5f9;
          color: #475569;
        }
        .candidateMetaBadge.soft {
          background: #eef2ff;
          color: #4f46e5;
        }
        .candidatePriceMeta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .candidatePriceItem {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 12px;
          background: #f8fafc;
        }
        .candidatePriceLabel {
          display: block;
          margin-bottom: 6px;
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 700;
        }
        .priceLine,
        .targetLine {
          display: block;
          margin: 0;
          font-weight: 900;
          letter-spacing: -0.01em;
        }
        .priceLine {
          color: #0ea5e9;
        }
        .targetLine {
          color: #0f172a;
        }
        .upsideLine {
          margin: 0 0 10px;
          font-weight: 900;
        }
        .upsidePositive {
          color: #0ea5e9;
        }
        .upsideNegative,
        .upsideNeutral {
          color: #64748b;
        }
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
        .noticePreviewSection {
          margin: 28px 0 34px;
        }
        .noticePreviewWrap {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 22px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .noticePreviewCard {
          display: block;
          text-decoration: none;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 22px 24px;
          background: #ffffff;
          color: #0f172a;
        }
        .noticePreviewTopLine {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .noticePreviewBadge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 8px 14px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.82rem;
          font-weight: 800;
          margin: 0;
        }
        .noticePreviewDate {
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
          text-align: center;
        }
        .noticePreviewBody h2 {
          margin: 0 0 8px;
          font-size: 1.35rem;
          letter-spacing: -0.03em;
        }
        .noticePreviewText {
          margin: 0;
          color: #475569;
          line-height: 1.7;
          font-size: 0.98rem;
          white-space: pre-line;
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
        .errorText {
          margin: 12px 0 0;
          color: #dc2626;
          font-size: 0.92rem;
          font-weight: 600;
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
            min-height: unset;
          }
          .heroMain {
            max-width: 100%;
          }
          .updateBox {
            width: 100%;
            text-align: left;
          }
          .heroCharacter {
            display: none;
          }
          .hero::before {
            display: none;
          }
          .noticePreviewTopLine {
            flex-direction: column;
            align-items: flex-start;
          }
          .noticePreviewDate {
            width: 100%;
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
          .modalActions,
          .subscribeActions {
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
          .modalCard,
          .noticePreviewWrap {
            padding: 22px;
          }
          .candidatePriceMeta {
            grid-template-columns: 1fr;
          }
          .summaryText {
            min-height: auto;
          }
          .candidateRankRow {
            align-items: flex-start;
          }
        }
      `}</style>
    </>
  );
}
