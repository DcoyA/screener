"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Image from "next/image";
import stocks from "./data/stocks.json";
import notices from "./data/notices.json";
import MainNav from "./components/MainNav";

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

function formatPrice(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function formatKrwCompact(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  if (num >= 1_0000_0000_0000) return `${(num / 1_0000_0000_0000).toFixed(1)}조원`;
  if (num >= 1_0000_0000) return `${(num / 1_0000_0000).toFixed(0)}억원`;
  return `${num.toLocaleString("ko-KR")}원`;
}

function getRankBadgeClass(rank) {
  if (rank === 1) return "rankBadge rank1";
  if (rank === 2) return "rankBadge rank2";
  if (rank === 3) return "rankBadge rank3";
  return "rankBadge rankDefault";
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
    return Number(b?.metrics?.marketCap ?? 0) - Number(a?.metrics?.marketCap ?? 0);
  });
}

function sortForUndervalue(items) {
  return [...items]
    .filter((item) => item?.undervalueMeta?.eligible)
    .sort((a, b) => {
      const aValue = Number(a?.valueScore ?? 0);
      const bValue = Number(b?.valueScore ?? 0);
      if (bValue !== aValue) return bValue - aValue;
      const aDebt = Number(a?.metrics?.debtRatio ?? 999999);
      const bDebt = Number(b?.metrics?.debtRatio ?? 999999);
      if (aDebt !== bDebt) return aDebt - bDebt;
      const aUpside = Number(a?.metrics?.upside ?? -999999);
      const bUpside = Number(b?.metrics?.upside ?? -999999);
      return bUpside - aUpside;
    });
}

function sortForUpside(items) {
  return [...items].sort((a, b) => {
    const aUpside = Number(a?.metrics?.upside ?? -999999);
    const bUpside = Number(b?.metrics?.upside ?? -999999);
    if (bUpside !== aUpside) return bUpside - aUpside;
    const aLiquidity = Number(a?.metrics?.avgTradeValue5d ?? 0);
    const bLiquidity = Number(b?.metrics?.avgTradeValue5d ?? 0);
    return bLiquidity - aLiquidity;
  });
}

function buildTopReason(stock) {
  const reasons = [];
  if (stock?.rankMeta?.topRankEligible) reasons.push("안정성 조건 통과");
  if (Number(stock?.totalScore ?? 0) >= 70) reasons.push(`총점 ${stock.totalScore}점`);
  if (Number.isFinite(Number(stock?.metrics?.upside)) && Number(stock?.metrics?.upside) > 0) {
    reasons.push(`상승여력 ${formatPercent(stock?.metrics?.upside)}`);
  }
  if ((stock?.rankMeta?.flags || []).length) reasons.push(stock.rankMeta.flags[0]);
  return reasons.length ? reasons.join(" · ") : "현재 종합 점수와 조건을 통과한 후보입니다.";
}

function buildUndervalueReason(stock) {
  const chunks = [];
  if (Number(stock?.valueScore ?? 0) > 0) chunks.push(`가치 점수 ${stock.valueScore}점`);
  if (Number.isFinite(Number(stock?.metrics?.debtRatio))) chunks.push(`부채비율 ${formatPercent(stock?.metrics?.debtRatio)}`);
  if (Number.isFinite(Number(stock?.metrics?.upside)) && Number(stock?.metrics?.upside) > 0) {
    chunks.push(`상승여력 ${formatPercent(stock?.metrics?.upside)}`);
  }
  return chunks.length ? chunks.join(" · ") : "저평가 관점에서 다시 볼 만한 후보입니다.";
}

function buildMomentReason(stock) {
  const chunks = [];
  if (Number.isFinite(Number(stock?.metrics?.upside))) chunks.push(`상승여력 ${formatPercent(stock?.metrics?.upside)}`);
  if (Number(stock?.metrics?.avgTradeValue5d ?? 0) > 0) chunks.push(`유동성 ${formatKrwCompact(stock?.metrics?.avgTradeValue5d)}`);
  if ((stock?.rankMeta?.flags || []).length) chunks.push(stock.rankMeta.flags[0]);
  return chunks.length ? chunks.join(" · ") : "지금 흐름 기준으로 다시 보는 후보입니다.";
}

function buildSectorSummary(items) {
  const counts = new Map();
  items.forEach((item) => {
    const sector = String(item?.sector || item?.industry || "미분류").trim();
    counts.set(sector, (counts.get(sector) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([sector, count]) => ({ sector, count }));
}

function buildDailyAngles(stocks) {
  const ranked = sortForTopCandidates(stocks);
  const undervalue = sortForUndervalue(stocks);
  const upside = sortForUpside(stocks);
  const sectorSummary = buildSectorSummary(ranked.slice(0, 30));

  return [
    {
      key: "top",
      badge: "종합 우선",
      title: "오늘의 핵심 후보",
      desc: "기본 조건을 통과한 상위권 중심으로 지금 가장 무난한 후보를 봅니다.",
      items: ranked.slice(0, 3).map((stock, index) => ({ ...stock, originalRank: index + 1, reason: buildTopReason(stock) })),
      actionLabel: "종합 랭킹 더 보기",
      actionHref: "/ranking",
    },
    {
      key: "value",
      badge: "저평가 관점",
      title: "오늘 다시 볼 저평가 후보",
      desc: "밸류와 재무 안정성 기준으로 뽑아, 매일 같은 상위주 외에 다른 각도를 보여줍니다.",
      items: undervalue.slice(0, 3).map((stock) => ({ ...stock, reason: buildUndervalueReason(stock) })),
      actionLabel: "저평가 랭킹 보기",
      actionHref: "/ranking",
    },
    {
      key: "move",
      badge: "상승여력 관점",
      title: "오늘 움직임을 볼 후보",
      desc: "적정가 괴리와 유동성을 묶어, 정적인 종합 순위와 다른 흐름용 후보를 보여줍니다.",
      items: upside.slice(0, 3).map((stock) => ({ ...stock, reason: buildMomentReason(stock) })),
      actionLabel: "상승여력 랭킹 보기",
      actionHref: "/ranking",
    },
    {
      key: "sector",
      badge: "상위군 분포",
      title: "오늘 상위권에 많이 보이는 업종",
      desc: "상위 후보 30개 안에서 자주 보이는 업종만 따로 보여줘서, 매일 다른 시장 결을 빠르게 읽게 합니다.",
      sectors: sectorSummary,
      actionLabel: "공지/해석 보기",
      actionHref: "/notice",
    },
  ];
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

  const dailyAngles = useMemo(() => buildDailyAngles(stocks), []);
  const updatedAt = topStocks[0]?.updatedAt || stocks[0]?.updatedAt || "-";

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
            <Image src="/logo.png" alt="우량주 스카우터 로고" width={32} height={32} className="brandLogo" />
            <span className="brandTitle">우량주 스카우터</span>
          </Link>
          <MainNav className="mainNav" />
        </header>

        <section className="hero">
          <div className="heroTop">
            <div className="heroMain">
              <p className="badge">OFFICIAL DATA LIVE</p>
              <h1>매일 같은 종목만 보이는 랭킹에서, 매일 다른 관점을 보여주는 투자 홈으로</h1>
              <p className="desc">
                메인페이지는 단순히 1~3위만 반복 노출하는 대신, <strong>종합 우선 / 저평가 / 상승여력 / 상위 업종 분포</strong>처럼
                서로 다른 기준으로 매일 다시 볼 이유를 만드는 구조로 바꿨습니다.
                <br />
                고정 랭킹은 <strong>랭킹 페이지</strong>에서 보고, 메인에서는 “오늘 어떤 각도로 시장을 볼지”를 빠르게 정리합니다.
              </p>
              <div className="heroPointRow">
                <span className="heroPoint">메인: 오늘의 각도와 변화</span>
                <span className="heroPoint">랭킹: 종합/저평가/상승여력 검색과 상세 확인</span>
                <span className="heroPoint">리포트: 행동 가능한 시나리오</span>
              </div>
              <div className="heroActions">
                <Link className="primaryBtn" href="/ranking">상위 랭킹 보기</Link>
                <Link className="secondaryBtn" href="/reports">이번 주 리포트 보기</Link>
              </div>
            </div>

            <aside className="updateBox" aria-label="업데이트 날짜">
              <span className="updateLabel">업데이트</span>
              <strong>{updatedAt}</strong>
              <p className="updateDesc">최근 자동 수집 및 분석 반영일</p>
            </aside>

            <div className="heroCharacter" aria-hidden="true">
              <div className="heroCharacterGlow" />
              <Image src="/vegeta-style.png" alt="" fill className="heroCharacterImage" priority />
            </div>
          </div>
        </section>

        <section className="dailyAnglesSection">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">오늘의 관점 4가지</h2>
              <p className="sectionDesc">
                매일 같은 상위주만 보는 대신, 종합/저평가/상승여력/업종 분포처럼 서로 다른 기준으로 시장을 다르게 읽습니다.
              </p>
            </div>
          </div>
          <div className="angleGrid">
            {dailyAngles.map((section) => (
              <div className="angleCard" key={section.key}>
                <div className="angleHeader">
                  <span className="angleBadge">{section.badge}</span>
                  <Link href={section.actionHref} className="miniActionLink">{section.actionLabel}</Link>
                </div>
                <h3>{section.title}</h3>
                <p className="angleDesc">{section.desc}</p>

                {section.items ? (
                  <div className="angleStockList">
                    {section.items.map((stock) => (
                      <Link href={`/stock/${stock.code}`} className="angleStockItem" key={`${section.key}-${stock.code}`}>
                        <div className="angleStockTop">
                          <strong>{stock.name}</strong>
                          <span>{stock.code}</span>
                        </div>
                        <div className="angleMetaRow">
                          <span>총점 {Number(stock.totalScore || 0).toFixed(0)}점</span>
                          <span>{formatPercent(stock?.metrics?.upside)}</span>
                        </div>
                        <p>{stock.reason}</p>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {section.sectors ? (
                  <div className="sectorList">
                    {section.sectors.map((item) => (
                      <div className="sectorItem" key={item.sector}>
                        <strong>{item.sector}</strong>
                        <span>상위 30개 중 {item.count}개</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="sectionHeaderRow compactTop">
            <div>
              <h2 className="sectionTitle">이번 주 상위 후보</h2>
              <p className="sectionDesc">무료 영역에서도 왜 상단에 노출됐는지 바로 읽을 수 있게 정리한 후보입니다.</p>
            </div>
          </div>
          <div className="cardWrap">
            {topStocks.map((stock) => (
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
                <p className={getUpsideClass(stock.metrics?.upside)}>상승여력 {formatPercent(stock.metrics?.upside)}</p>
                <p className="scoreLine">총점 {stock.totalScore}점</p>
                <div className="reasonBox">
                  <span className="reasonLabel">왜 보였나</span>
                  <p>{buildTopReason(stock)}</p>
                </div>
                <p className="summaryText">{stock.summary}</p>
                <Link className="linkBtn" href={`/stock/${stock.code}`}>종목 상세 보기</Link>
              </div>
            ))}
          </div>
        </section>

        <section className="bridgeSection">
          <div className="bridgeCard">
            <div className="bridgeHeader">
              <div>
                <p className="bridgeBadge">FREE → PREMIUM</p>
                <h2>무료에서 검증하고, 프리미엄에서 행동합니다</h2>
                <p className="bridgeDesc">
                  무료 페이지는 “왜 추천 / 왜 제외 / 실제 결과”를 검증하는 영역입니다.
                  프리미엄은 그 위에 <strong>행동 가능한 주간 시나리오</strong>를 얹는 구조로 준비 중입니다.
                </p>
              </div>
            </div>
            <div className="bridgeGrid">
              <div className="bridgeItem">
                <span className="bridgeItemLabel">무료에서 보는 것</span>
                <ul>
                  <li>종합/저평가/상승여력 랭킹</li>
                  <li>리스크 체크 포인트</li>
                  <li>상세페이지 해석</li>
                  <li>성과/백테스트 공개</li>
                </ul>
              </div>
              <div className="bridgeItem premium">
                <span className="bridgeItemLabel">프리미엄에서 추가될 것</span>
                <ul>
                  <li>단기 · 중기 · 장기 시나리오</li>
                  <li>왜 지금 보는지 / 무엇이 틀리면 철회할지</li>
                  <li>핵심 후보 정리 + 후속 추적</li>
                  <li>주간 프리미엄 리포트</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="subscribeSection">
          <div className="subscribeCard">
            <p className="subscribeEyebrow">PREMIUM MVP WAITLIST</p>
            <h2>주간 프리미엄 리포트 사전등록</h2>
            <p className="subscribeDesc">
              현재는 무료 공개 구간을 먼저 완성하면서, 프리미엄 MVP를 함께 준비하고 있습니다.
              <br />
              사전등록하면 <strong>상위 후보 주간 리포트 샘플</strong>과 <strong>프리미엄 베타 오픈 소식</strong>을 먼저 받아볼 수 있습니다.
              <br />
              (프리미엄은 확정 수익률 안내가 아니라, 단기/중기/장기 시나리오와 체크 포인트를 제공하는 구조입니다.)
            </p>
            <div className="subscribeActions">
              <a href="/sample-report.html" target="_blank" rel="noopener noreferrer" className="secondaryBtn">
                샘플 리포트 보기
              </a>
              <button type="button" className="primaryBtn" onClick={openModal}>
                리포트 구독하기
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
                <strong>📈 성과/백테스트</strong>
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
                  <span className="noticePreviewBadge">📢 업데이트 안내</span>
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
            <button type="button" className="closeBtn" onClick={closeModal} aria-label="팝업 닫기">
              ×
            </button>
            {!isSubmitted ? (
              <>
                <p className="modalBadge">리포트 구독하기</p>
                <h3>주간 프리미엄 리포트 오픈 알림 신청</h3>
                <p className="modalDesc">
                  사전등록하면 무료 샘플 리포트 안내와 프리미엄 MVP 베타 오픈 소식을 먼저 보내드립니다.
                  프리미엄은 확정 수익이 아니라 단기/중기/장기 시나리오와 체크 포인트를 제공하는 구조로 준비 중입니다.
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
                    <button type="button" className="ghostBtn" onClick={closeModal}>닫기</button>
                    <button type="submit" className="primaryBtn" disabled={isSubmitting}>
                      {isSubmitting ? "저장 중..." : "리포트 구독하기"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="successBox">
                <p className="modalBadge">신청 완료</p>
                <h3>접수가 완료되었습니다</h3>
                <p className="modalDesc">프리미엄 MVP 관련 소식과 샘플 리포트 안내를 이메일로 보내드릴게요.</p>
                <div className="modalActions singleAction">
                  <button type="button" className="primaryBtn" onClick={closeModal}>확인</button>
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
        .modalBadge,
        .bridgeBadge,
        .angleBadge,
        .noticePreviewBadge {
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
        h2 {
          margin: 0 0 8px;
          font-size: 2rem;
          letter-spacing: -0.03em;
        }
        .desc {
          max-width: 920px;
          font-size: 1.08rem;
          line-height: 1.9;
          color: #475569;
          margin: 0;
        }
        .desc strong,
        .bridgeDesc strong {
          color: #0f172a;
        }
        .heroPointRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .heroPoint {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-size: 0.86rem;
          font-weight: 700;
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
        .ghostBtn,
        .miniActionLink {
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
        .linkBtn,
        .miniActionLink {
          background: #ffffff;
          color: #0f172a;
          border-color: #dbe3f0;
        }
        .secondaryBtn:hover,
        .ghostBtn:hover,
        .linkBtn:hover,
        .miniActionLink:hover {
          background: #f8fafc;
        }
        .sectionHeaderRow {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin: 56px 0 22px;
          flex-wrap: wrap;
        }
        .compactTop { margin-top: 40px; }
        .sectionTitle {
          margin: 0 0 8px;
          font-size: 2rem;
          letter-spacing: -0.03em;
        }
        .sectionDesc,
        .angleDesc {
          margin: 0;
          color: #64748b;
          line-height: 1.7;
        }
        .dailyAnglesSection,
        .bridgeSection,
        .subscribeSection,
        .quickLinksSection,
        .noticePreviewSection {
          margin-top: 34px;
        }
        .angleGrid,
        .cardWrap,
        .bridgeGrid,
        .quickLinksGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .cardWrap { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .quickLinksGrid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .angleCard,
        .card,
        .bridgeCard,
        .quickLinksCard,
        .subscribeCard,
        .noticePreviewWrap {
          border-radius: 28px;
          border: 1px solid #e5e7eb;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .angleCard,
        .card,
        .bridgeCard,
        .quickLinksCard,
        .subscribeCard { padding: 24px; }
        .angleHeader,
        .candidateRankRow,
        .noticePreviewTopLine {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .angleStockList { display: grid; gap: 10px; margin-top: 16px; }
        .angleStockItem {
          display: block;
          text-decoration: none;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px;
          background: #fff;
          color: #0f172a;
        }
        .angleStockTop { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
        .angleStockTop strong { font-size: 1rem; }
        .angleStockTop span,
        .angleMetaRow,
        .stockCode,
        .marketBadge,
        .noticePreviewDate {
          color: #64748b;
          font-size: 0.88rem;
        }
        .angleMetaRow { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .angleStockItem p { margin: 0; color: #475569; line-height: 1.65; font-size: 0.92rem; }
        .sectorList { display: grid; gap: 10px; margin-top: 16px; }
        .sectorItem {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px;
          background: #fff;
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
        .rankHash { font-size: 1rem; line-height: 1; margin-right: 2px; opacity: 0.92; }
        .rankNumber { font-size: 1.8rem; line-height: 1; }
        .rank1 { background: linear-gradient(135deg, #facc15 0%, #f59e0b 100%); color: #111827; border-color: rgba(245, 158, 11, 0.35); }
        .rank2 { background: linear-gradient(135deg, #e5e7eb 0%, #94a3b8 100%); color: #0f172a; border-color: rgba(148, 163, 184, 0.38); }
        .rank3 { background: linear-gradient(135deg, #b45309 0%, #92400e 100%); color: #fff; border-color: rgba(146, 64, 14, 0.35); }
        .rankDefault { background: #f8fafc; color: #334155; border-color: #e2e8f0; box-shadow: none; }
        .marketBadge {
          display: inline-flex;
          padding: 7px 12px;
          border-radius: 999px;
          background: #f1f5f9;
          font-weight: 800;
          margin: 0;
        }
        .card h3 { margin: 0 0 12px; font-size: 1.4rem; letter-spacing: -0.03em; word-break: keep-all; }
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
        .targetLine { display: block; margin: 0; font-weight: 900; letter-spacing: -0.01em; }
        .priceLine { color: #0ea5e9; }
        .targetLine { color: #0f172a; }
        .upsideLine { margin: 0 0 10px; font-weight: 900; }
        .upsidePositive { color: #0ea5e9; }
        .upsideNegative,
        .upsideNeutral { color: #64748b; }
        .scoreLine { margin: 0 0 8px; color: #64748b; font-weight: 600; }
        .reasonBox {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px;
          background: #f8fbff;
          margin-bottom: 12px;
        }
        .reasonLabel {
          display: block;
          margin-bottom: 8px;
          color: #0f172a;
          font-size: 0.84rem;
          font-weight: 800;
        }
        .reasonBox p,
        .bridgeDesc,
        .subscribeDesc,
        .modalDesc,
        .noticePreviewText,
        .summaryText,
        .bridgeItem ul,
        .quickLinkItem span {
          margin: 0;
          color: #475569;
          line-height: 1.8;
        }
        .summaryText { min-height: 92px; margin: 10px 0 18px; word-break: keep-all; }
        .bridgeCard h2,
        .quickLinksCard h2,
        .subscribeCard h2,
        .noticePreviewBody h2 {
          margin: 0 0 16px;
          font-size: 1.6rem;
          letter-spacing: -0.03em;
        }
        .bridgeGrid { margin-top: 20px; }
        .bridgeItem {
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 20px;
          background: #ffffff;
        }
        .bridgeItem.premium { background: #f8fbff; }
        .bridgeItemLabel { display: block; margin-bottom: 12px; color: #0f172a; font-weight: 900; }
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
        .quickLinkItem strong { font-size: 1.05rem; }
        .noticePreviewWrap { padding: 22px; }
        .noticePreviewCard {
          display: block;
          text-decoration: none;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 22px 24px;
          background: #ffffff;
          color: #0f172a;
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
          font-weight: 800;
          text-align: center;
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
        .footerInner p { margin: 0; }
        .footerInner a { color: #0f172a; text-decoration: none; font-weight: 700; }
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
        .modalCard h3 { margin: 0 0 12px; font-size: 1.7rem; letter-spacing: -0.03em; }
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
        .subscribeForm { margin-top: 22px; }
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
        .errorText { margin: 12px 0 0; color: #dc2626; font-size: 0.92rem; font-weight: 600; }
        .singleAction { justify-content: flex-start; }
        @media (max-width: 980px) {
          .angleGrid,
          .cardWrap,
          .bridgeGrid,
          .quickLinksGrid { grid-template-columns: 1fr; }
          .heroTop {
            flex-direction: column;
            justify-content: flex-start;
            align-items: stretch;
            min-height: 0;
            gap: 16px;
          }
          .heroMain {
            max-width: 100%;
            flex: none;
          }
          .updateBox {
            width: 100%;
            text-align: left;
            min-width: 0;
          }
          .heroCharacter {
            display: block;
            position: relative;
            right: auto;
            bottom: auto;
            width: min(72vw, 360px);
            height: min(72vw, 360px);
            margin: 0 auto;
            opacity: 0.95;
          }
          .hero::before { display: none; }
        }
        @media (max-width: 640px) {
          .container { padding: 24px 18px 64px; }
          .topBar { align-items: flex-start; margin-bottom: 28px; }
          .hero { padding: 12px 0 8px; }
          .heroTop { gap: 12px; }
          .heroCharacter { width: min(78vw, 320px); height: min(78vw, 320px); margin-top: 4px; }
          .heroCharacterGlow { display: none; }
          .desc { font-size: 1rem; line-height: 1.8; }
          .heroActions {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            gap: 10px;
            margin-top: 20px;
            width: 100%;
          }
          .modalActions,
          .subscribeActions { flex-direction: column; }
          .heroActions .primaryBtn,
          .heroActions .secondaryBtn {
            width: calc(50% - 5px);
            min-width: 0;
            padding: 14px 10px;
            font-size: 0.95rem;
            white-space: nowrap;
          }
          .ghostBtn,
          .linkBtn,
          .miniActionLink,
          .primaryBtn,
          .secondaryBtn { width: 100%; }
          .bridgeCard,
          .quickLinksCard,
          .subscribeCard,
          .card,
          .angleCard,
          .modalCard,
          .noticePreviewWrap { padding: 22px; }
          .candidatePriceMeta { grid-template-columns: 1fr; }
          .summaryText { min-height: auto; }
          .candidateRankRow { align-items: flex-start; }
          .noticePreviewTopLine { flex-direction: column; align-items: flex-start; }
          .noticePreviewDate { width: 100%; }
        }
      `}</style>
    </>
  );
}
