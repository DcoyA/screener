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

function getUpsideClass(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "upsideLine";
  if (num > 0) return "upsideLine upsidePositive";
  if (num < 0) return "upsideLine upsideNegative";
  return "upsideLine upsideNeutral";
}

function sortForShortTerm(items) {
  return [...items].sort((a, b) => {
    const aMomentum = Number(a?.metrics?.priceChangeRate ?? a?.metrics?.momentum ?? 0);
    const bMomentum = Number(b?.metrics?.priceChangeRate ?? b?.metrics?.momentum ?? 0);
    if (bMomentum !== aMomentum) return bMomentum - aMomentum;
    const aUpside = Number(a?.metrics?.upside ?? -999999);
    const bUpside = Number(b?.metrics?.upside ?? -999999);
    if (bUpside !== aUpside) return bUpside - aUpside;
    const aLiquidity = Number(a?.metrics?.avgTradeValue5d ?? 0);
    const bLiquidity = Number(b?.metrics?.avgTradeValue5d ?? 0);
    return bLiquidity - aLiquidity;
  });
}

function sortForAnnual(items) {
  return [...items].sort((a, b) => {
    const aEligible = a?.rankMeta?.topRankEligible ? 1 : 0;
    const bEligible = b?.rankMeta?.topRankEligible ? 1 : 0;
    if (bEligible !== aEligible) return bEligible - aEligible;
    const aScore = Number(a?.totalScore ?? 0);
    const bScore = Number(b?.totalScore ?? 0);
    if (bScore !== aScore) return bScore - aScore;
    const aGrowth = Number(a?.metrics?.operatingIncomeGrowth ?? 0) + Number(a?.metrics?.revenueGrowth ?? 0);
    const bGrowth = Number(b?.metrics?.operatingIncomeGrowth ?? 0) + Number(b?.metrics?.revenueGrowth ?? 0);
    if (bGrowth !== aGrowth) return bGrowth - aGrowth;
    const aLiquidity = Number(a?.metrics?.avgTradeValue5d ?? 0);
    const bLiquidity = Number(b?.metrics?.avgTradeValue5d ?? 0);
    return bLiquidity - aLiquidity;
  });
}

function sortForLongTerm(items) {
  return [...items]
    .filter((item) => item?.undervalueMeta?.eligible)
    .sort((a, b) => {
      const aValue = Number(a?.valueScore ?? 0);
      const bValue = Number(b?.valueScore ?? 0);
      if (bValue !== aValue) return bValue - aValue;
      const aDebt = Number(a?.metrics?.debtRatio ?? 999999);
      const bDebt = Number(b?.metrics?.debtRatio ?? 999999);
      if (aDebt !== bDebt) return aDebt - bDebt;
      const aRoe = Number(a?.metrics?.roe ?? -999999);
      const bRoe = Number(b?.metrics?.roe ?? -999999);
      return bRoe - aRoe;
    });
}

function buildReasonLine(parts, fallback) {
  const output = parts.filter(Boolean);
  return output.length ? output.join(" · ") : fallback;
}

function buildShortReason(stock) {
  return buildReasonLine(
    [
      Number.isFinite(Number(stock?.metrics?.priceChangeRate)) ? `최근 흐름 ${formatPercent(stock?.metrics?.priceChangeRate)}` : null,
      Number.isFinite(Number(stock?.metrics?.upside)) ? `상승여력 ${formatPercent(stock?.metrics?.upside)}` : null,
      stock?.metrics?.avgTradeValue5d ? `유동성 ${formatKrwCompact(stock?.metrics?.avgTradeValue5d)}` : null,
      (stock?.rankMeta?.flags || [])[0] || null,
    ],
    "단기 흐름과 거래가 붙는지 중심으로 다시 보는 후보입니다."
  );
}

function buildAnnualReason(stock) {
  return buildReasonLine(
    [
      stock?.rankMeta?.topRankEligible ? "안정성 조건 통과" : null,
      Number(stock?.totalScore ?? 0) ? `총점 ${Number(stock.totalScore).toFixed(0)}점` : null,
      Number.isFinite(Number(stock?.metrics?.operatingIncomeGrowth)) ? `영업이익 성장 ${formatPercent(stock?.metrics?.operatingIncomeGrowth)}` : null,
      Number.isFinite(Number(stock?.metrics?.revenueGrowth)) ? `매출 성장 ${formatPercent(stock?.metrics?.revenueGrowth)}` : null,
    ],
    "연간 보유 관점에서 무난하게 가져갈 수 있는 후보입니다."
  );
}

function buildLongReason(stock) {
  return buildReasonLine(
    [
      Number(stock?.valueScore ?? 0) ? `가치 점수 ${Number(stock.valueScore).toFixed(0)}점` : null,
      Number.isFinite(Number(stock?.metrics?.debtRatio)) ? `부채비율 ${formatPercent(stock?.metrics?.debtRatio)}` : null,
      Number.isFinite(Number(stock?.metrics?.roe)) ? `ROE ${formatPercent(stock?.metrics?.roe)}` : null,
      Number.isFinite(Number(stock?.metrics?.pbr)) ? `PBR ${Number(stock.metrics.pbr).toFixed(2)}배` : null,
    ],
    "장기 보유 관점에서 가격보다 구조를 먼저 보는 후보입니다."
  );
}

function buildAvoidSummary(items) {
  const highDebt = items.filter((item) => Number(item?.metrics?.debtRatio ?? 0) >= 200).length;
  const weakLiquidity = items.filter((item) => Number(item?.metrics?.avgTradeValue5d ?? 0) < 10_0000_0000).length;
  const unstable = items.filter(
    (item) => Number(item?.metrics?.operatingIncome ?? 0) <= 0 || Number(item?.metrics?.netIncome ?? 0) <= 0
  ).length;

  return [
    {
      label: "고부채",
      count: highDebt,
      desc: "저평가처럼 보여도 재무가 불안한 타입",
      href: "/ranking?risk=highDebt",
    },
    {
      label: "저유동성",
      count: weakLiquidity,
      desc: "점수 대비 실제 거래가 약한 타입",
      href: "/ranking?risk=lowLiquidity",
    },
    {
      label: "이익 불안정",
      count: unstable,
      desc: "영업이익/순이익 흐름이 약한 타입",
      href: "/ranking?risk=unstableEarnings",
    },
  ];
}

function buildStrategyCards(items) {
  const shortTerm = sortForShortTerm(items)[0] || null;
  const annual = sortForAnnual(items)[0] || null;
  const longTerm = sortForLongTerm(items)[0] || null;

  return [
    {
      key: "short",
      badge: "1주~1개월",
      title: "단기 투자에 좋은 후보",
      desc: "최근 흐름, 거래대금, 상승여력을 같이 봐서 지금 당장 반응 가능한 쪽을 고릅니다.",
      stock: shortTerm,
      reason: shortTerm ? buildShortReason(shortTerm) : "단기 관점 후보가 아직 부족합니다.",
      actionLabel: "단기 흐름 더 보기",
      actionHref: "/ranking?view=short",
    },
    {
      key: "annual",
      badge: "6개월~1년",
      title: "연간 투자에 좋은 후보",
      desc: "종합 점수, 실적 안정성, 성장 흐름을 묶어서 올해 안에 다시 볼 만한 종목을 고릅니다.",
      stock: annual,
      reason: annual ? buildAnnualReason(annual) : "연간 관점 후보가 아직 부족합니다.",
      actionLabel: "연간 투자 더 보기",
      actionHref: "/ranking?view=annual",
    },
    {
      key: "long",
      badge: "1년 이상",
      title: "장기 투자에 좋은 후보",
      desc: "저평가와 재무 안정성 기준으로, 당장보다 구조를 보고 들고 갈 만한 종목을 고릅니다.",
      stock: longTerm,
      reason: longTerm ? buildLongReason(longTerm) : "장기 관점 후보가 아직 부족합니다.",
      actionLabel: "장기 투자 더 보기",
      actionHref: "/ranking?view=long",
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
  const strategyCards = useMemo(() => buildStrategyCards(stocks), []);
  const avoidSummary = useMemo(() => buildAvoidSummary(stocks), []);
  const updatedAt = stocks[0]?.updatedAt || "-";

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
          <MainNav className="mainNav" />
        </header>

        <section className="hero">
          <div className="heroTop">
            <div className="heroMain">
              <p className="badge">OFFICIAL DATA LIVE</p>
              <h1>종목을 발굴하려면, <br />데이터부터 분석해야 한다</h1>
              <p className="desc">
                메인에서는 데이터 기반으로 접근 방식을 정리합니다.<br />
                단기 / 연간 / 장기 관점을 나눠서, 같은 종목도 지금은 어떻게 봐야 하는지 다르게 보여줍니다.<br />
                종목을 자세히 보고 싶다면 랭킹 페이지에서 확인하세요.
              </p>
              <div className="heroPointRow">
                <span className="heroPoint">단기: 흐름과 거래대금 중심</span>
                <span className="heroPoint">연간: 점수와 실적 안정성 중심</span>
                <span className="heroPoint">장기: 저평가와 재무 구조 중심</span>
              </div>
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

        <section className="subscribeSection">
          <div className="subscribeCard">
            <p className="subscribeEyebrow">PREMIUM MVP WAITLIST</p>
            <h2>주간 프리미엄 리포트 사전등록</h2>
            <p className="subscribeDesc">
              현재는 무료 공개 구간을 먼저 완성하면서, 프리미엄 MVP를 함께 준비하고 있습니다.
              <br />
              사전등록하면 <strong>상위 후보 주간 리포트 샘플</strong>과
              <strong> 프리미엄 베타 오픈 소식</strong>을 먼저 받아볼 수 있습니다.
              <br />
              (프리미엄은 확정 수익률 안내가 아니라, 단기/중기/장기 시나리오와 체크 포인트를 제공하는 구조입니다.)
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
                리포트 구독하기
              </button>
            </div>
          </div>
        </section>
                  
        <section className="strategySection">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">오늘의 투자 전략 3가지</h2>
              <p className="sectionDesc">
                종합/저평가 같은 기술적 기준보다, 지금 시장에서 실제로 어떻게 들고 갈지에 맞춘 관점으로 나눴습니다.
              </p>
            </div>
          </div>

          <div className="strategyGrid">
            {strategyCards.map((section) => (
              <div className="strategyCard" key={section.key}>
                <div className="strategyHeader">
                  <span className="strategyBadge">{section.badge}</span>
                  <Link href={section.actionHref} className="miniActionLink">
                    {section.actionLabel}
                  </Link>
                </div>
                <h3>{section.title}</h3>
                <p className="strategyDesc">{section.desc}</p>

                {section.stock ? (
                  <>
                    <div className="strategyStockTop">
                      <div>
                        <h4>{section.stock.name}</h4>
                        <p className="stockCode">{section.stock.market} · {section.stock.code}</p>
                      </div>
                      <div className="scoreChip">총점 {Number(section.stock.totalScore || 0).toFixed(0)}점</div>
                    </div>

                    <div className="candidatePriceMeta strategyMetaGrid">
                      <div className="candidatePriceItem">
                        <span className="candidatePriceLabel">최근 종가</span>
                        <strong className="priceLine">{formatPrice(section.stock.metrics?.closePrice)}</strong>
                      </div>
                      <div className="candidatePriceItem">
                        <span className="candidatePriceLabel">적정가 추정</span>
                        <strong className="targetLine">{formatPrice(section.stock.metrics?.targetPrice)}</strong>
                      </div>
                    </div>

                    <p className={getUpsideClass(section.stock.metrics?.upside)}>
                      상승여력 {formatPercent(section.stock.metrics?.upside)}
                    </p>

                    <div className="reasonBox">
                      <span className="reasonLabel">왜 이 관점에서 보나</span>
                      <p>{section.reason}</p>
                    </div>

                    <p className="summaryText short">{section.stock.summary}</p>
                    <Link className="linkBtn" href={`/stock/${section.stock.code}`}>
                      종목 상세 보기
                    </Link>
                  </>
                ) : (
                  <div className="emptyStateBox">
                    <p>현재 기준으로 이 관점에 맞는 후보가 충분하지 않습니다.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="avoidSection">
          <div className="avoidCard">
            <div className="sectionHeaderRow compactHeader">
              <div>
                <h2 className="sectionTitle">오늘은 피해야 할 타입</h2>
                <p className="sectionDesc">
                  추천만 보여주면 오해가 생기니까, 지금 시장에서 같이 조심해야 할 타입도 따로 분리했습니다.
                </p>
              </div>
            </div>
            <div className="avoidGrid">
              {avoidSummary.map((item) => (
                <Link href={item.href} className="avoidItem clickable" key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.count}개 포착</span>
                  <p>{item.desc}</p>
                </Link>
              ))}
            </div>
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
                    <button type="button" className="ghostBtn" onClick={closeModal}>
                      닫기
                    </button>
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
                <p className="modalDesc">
                  프리미엄 MVP 관련 소식과 샘플 리포트 안내를 이메일로 보내드릴게요.
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
        .strategyBadge,
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
        .desc {
          max-width: 920px;
          font-size: 1.08rem;
          line-height: 1.9;
          color: #475569;
          margin: 0;
        }
        .desc strong,
        .bridgeDesc strong,
        .subscribeDesc strong {
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
        .compactHeader {
          margin-top: 0;
          margin-bottom: 16px;
        }
        .sectionTitle {
          margin: 0 0 8px;
          font-size: 2rem;
          letter-spacing: -0.03em;
        }
        .sectionDesc,
        .strategyDesc {
          margin: 0;
          color: #64748b;
          line-height: 1.7;
        }
        .strategySection,
        .avoidSection,
        .bridgeSection,
        .subscribeSection,
        .quickLinksSection {
          margin-top: 40px;
        }
        .strategyGrid,
        .bridgeGrid,
        .quickLinksGrid,
        .avoidGrid {
          display: grid;
          gap: 18px;
        }
        .strategyGrid,
        .bridgeGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .avoidGrid,
        .quickLinksGrid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .strategyCard,
        .avoidCard,
        .bridgeCard,
        .quickLinksCard,
        .subscribeCard,
        .noticePreviewWrap {
          border-radius: 28px;
          border: 1px solid #e5e7eb;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .strategyCard,
        .avoidCard,
        .bridgeCard,
        .quickLinksCard,
        .subscribeCard {
          padding: 24px;
        }
        .strategyHeader,
        .noticePreviewTopLine {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .strategyStockTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-top: 18px;
          margin-bottom: 12px;
        }
        .strategyStockTop h4 {
          margin: 0 0 6px;
          font-size: 1.35rem;
          letter-spacing: -0.03em;
        }
        .scoreChip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 12px;
          background: #0f172a;
          color: #fff;
          font-size: 0.82rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .stockCode,
        .noticePreviewDate {
          color: #64748b;
          font-size: 0.88rem;
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
        .emptyStateBox p,
        .bridgeDesc,
        .subscribeDesc,
        .modalDesc,
        .noticePreviewText,
        .summaryText,
        .bridgeItem ul,
        .quickLinkItem span,
        .avoidItem p {
          margin: 0;
          color: #475569;
          line-height: 1.8;
        }
        .summaryText.short {
          min-height: auto;
          margin: 10px 0 18px;
          word-break: keep-all;
        }
        .emptyStateBox {
          margin-top: 18px;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          padding: 18px;
          background: #ffffff;
        }
        .avoidItem {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 18px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-decoration: none;
          transition: all 0.18s ease;
        }
        .avoidItem.clickable:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          background: #fbfdff;
        }
        .avoidItem strong {
          font-size: 1rem;
          color: #0f172a;
        }
        .avoidItem span {
          color: #b45309;
          font-weight: 800;
          font-size: 0.9rem;
        }
        .bridgeCard h2,
        .quickLinksCard h2,
        .subscribeCard h2,
        .noticePreviewBody h2 {
          margin: 0 0 16px;
          font-size: 1.6rem;
          letter-spacing: -0.03em;
        }
        .bridgeItem {
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 20px;
          background: #ffffff;
        }
        .bridgeItem.premium {
          background: #f8fbff;
        }
        .bridgeItemLabel {
          display: block;
          margin-bottom: 12px;
          color: #0f172a;
          font-weight: 900;
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
        .noticePreviewSection {
          margin: 28px 0 34px;
        }
        .noticePreviewWrap {
          padding: 22px;
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
        @media (max-width: 1100px) {
          .strategyGrid,
          .bridgeGrid,
          .quickLinksGrid,
          .avoidGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .strategyGrid,
          .bridgeGrid,
          .quickLinksGrid,
          .avoidGrid {
            grid-template-columns: 1fr;
          }
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
          .hero::before {
            display: none;
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
          .hero {
            padding: 12px 0 8px;
          }
          .heroTop {
            gap: 12px;
          }
          .heroCharacter {
            width: min(78vw, 320px);
            height: min(78vw, 320px);
            margin-top: 4px;
          }
          .heroCharacterGlow {
            display: none;
          }
          .desc {
            font-size: 1rem;
            line-height: 1.8;
          }
          .heroActions {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            gap: 10px;
            margin-top: 20px;
            width: 100%;
          }
          .modalActions,
          .subscribeActions {
            flex-direction: column;
          }
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
          .secondaryBtn {
            width: 100%;
          }
          .strategyCard,
          .avoidCard,
          .bridgeCard,
          .quickLinksCard,
          .subscribeCard,
          .modalCard,
          .noticePreviewWrap {
            padding: 22px;
          }
          .candidatePriceMeta {
            grid-template-columns: 1fr;
          }
          .strategyStockTop,
          .noticePreviewTopLine {
            flex-direction: column;
            align-items: flex-start;
          }
          .noticePreviewDate {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
