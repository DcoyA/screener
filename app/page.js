"use client";

import Link from "next/link";
import { useMemo } from "react";
import stocks from "../data/stocks.json";

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function getTopSummaryStocks(allStocks) {
  const list = [...allStocks].sort((a, b) => {
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

  return list.slice(0, 3);
}

export default function HomePage() {
  const topStocks = useMemo(() => getTopSummaryStocks(stocks), []);
  const eligibleCount = useMemo(
    () => stocks.filter((item) => item?.rankMeta?.topRankEligible).length,
    []
  );

  return (
    <>
      <main className="container">
        <header className="heroSection">
          <div className="heroText">
            <p className="heroBadge">HELLO MEDIA</p>
            <h1>우량주 스카우터</h1>
            <p className="heroDesc">
              공개 재무데이터와 시장데이터를 함께 반영해 우량주 후보를 선별합니다.
              <br />
              메인 상위 종목은 종합 점수뿐 아니라 재무 안정성 조건을 통과한 후보를 우선 반영합니다.
            </p>

            <div className="heroActions">
              <Link href="/ranking" className="primaryBtn">종목 랭킹 보기</Link>
              <Link href="/performance" className="secondaryBtn">성과 확인</Link>
            </div>
          </div>

          <div className="heroMetaCard">
            <span className="metaLabel">종합 상위 후보</span>
            <strong>{eligibleCount}종목</strong>
            <p>
              메인 상단 카드는 안정성 조건을 통과한 종목을 우선 반영하며,
              저평가/상승여력은 랭킹 탭에서 별도 관점으로 확인할 수 있습니다.
            </p>
          </div>
        </header>

        <section className="summaryGuideSection">
          <div className="guideCard">
            <h2>메인 상위 카드 해석</h2>
            <div className="guideGrid">
              <div className="guideItem">
                <strong>종합 상위 후보</strong>
                <span>재무 안정성 조건을 통과한 종합랭킹 우선 종목입니다.</span>
              </div>
              <div className="guideItem">
                <strong>리스크 플래그</strong>
                <span>이익 안정성, 고부채 등 주의 요소가 있으면 작은 배지로 표시합니다.</span>
              </div>
              <div className="guideItem">
                <strong>저평가/상승여력</strong>
                <span>종합과 저평가 관점은 다를 수 있으므로 랭킹 탭에서 함께 비교하는 것이 좋습니다.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="topSection">
          <div className="sectionHead">
            <div>
              <p className="sectionEyebrow">TOP PICKS</p>
              <h2>메인 상위 3종목</h2>
            </div>
            <Link href="/ranking" className="sectionLink">전체 랭킹 보기</Link>
          </div>

          <div className="topGrid">
            {topStocks.map((stock, index) => {
              const flags = stock?.rankMeta?.flags || [];
              const penalty = Number(stock?.rankMeta?.penalty || 0);
              const eligible = !!stock?.rankMeta?.topRankEligible;

              return (
                <article className="stockCard" key={stock.code}>
                  <div className="cardHeader">
                    <div className="rankWrap">
                      <span className="rankBadge">TOP {index + 1}</span>
                      <div>
                        <h3>{stock.name}</h3>
                        <p className="stockMeta">{stock.market} · {stock.code}</p>
                      </div>
                    </div>
                    <div className="scoreBox">
                      <span>종합 점수</span>
                      <strong>{stock.totalScore}</strong>
                    </div>
                  </div>

                  <div className="badgeRow">
                    {eligible ? (
                      <span className="smallBadge good">종합 상위 후보</span>
                    ) : (
                      <span className="smallBadge warn">종합 상위 제외</span>
                    )}
                    {penalty > 0 ? <span className="smallBadge muted">패널티 {penalty}</span> : null}
                    {flags.map((flag) => (
                      <span className="smallBadge soft" key={flag}>{flag}</span>
                    ))}
                  </div>

                  <div className="metricGrid">
                    <div className="metricItem">
                      <span>현재가</span>
                      <strong>{formatPrice(stock?.metrics?.closePrice)}</strong>
                    </div>
                    <div className="metricItem">
                      <span>적정가 추정</span>
                      <strong>{formatPrice(stock?.metrics?.targetPrice)}</strong>
                    </div>
                    <div className="metricItem">
                      <span>상승여력</span>
                      <strong className="sky">{formatPercent(stock?.metrics?.upside)}</strong>
                    </div>
                    <div className="metricItem">
                      <span>부채비율</span>
                      <strong>{formatPercent(stock?.metrics?.debtRatio)}</strong>
                    </div>
                  </div>

                  <p className="summary">{stock.summary}</p>

                  <div className="cardActions">
                    <Link href={`/stock/${stock.code}`} className="detailBtn">상세 보기</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="navSection">
          <div className="quickGrid">
            <Link href="/ranking" className="quickCard">
              <strong>종목 랭킹</strong>
              <span>종합 / 저평가 / 상승여력 관점으로 후보를 비교합니다.</span>
            </Link>
            <Link href="/risk" className="quickCard">
              <strong>리스크</strong>
              <span>주의 종목과 재무 안정성 체크 포인트를 확인합니다.</span>
            </Link>
            <Link href="/reports" className="quickCard">
              <strong>리포트</strong>
              <span>주간 요약과 핵심 후보 정리 내용을 봅니다.</span>
            </Link>
            <Link href="/performance" className="quickCard">
              <strong>성과</strong>
              <span>추천 결과와 benchmark 대비 성과 흐름을 확인합니다.</span>
            </Link>
          </div>
        </section>
      </main>

      <style jsx>{`
        .container { max-width: 1180px; margin: 0 auto; padding: 32px 24px 80px; color: #0f172a; }
        .heroSection { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; flex-wrap:wrap; margin-bottom:28px; }
        .heroText { flex:1; min-width:0; }
        .heroBadge { display:inline-flex; padding:8px 14px; border-radius:999px; background:#eef2ff; color:#4f46e5; font-size:.82rem; font-weight:800; margin:0 0 18px; }
        h1 { margin:0 0 12px; font-size:clamp(2.2rem, 4vw, 3.4rem); letter-spacing:-0.05em; }
        .heroDesc { margin:0; max-width:760px; color:#475569; line-height:1.9; font-size:1.03rem; }
        .heroActions { display:flex; gap:12px; flex-wrap:wrap; margin-top:24px; }
        .primaryBtn, .secondaryBtn, .sectionLink, .detailBtn { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; font-weight:800; }
        .primaryBtn { height:46px; padding:0 18px; border-radius:14px; background:#0f172a; color:#fff; }
        .secondaryBtn { height:46px; padding:0 18px; border-radius:14px; border:1px solid #dbe3f0; background:#fff; color:#0f172a; }
        .heroMetaCard, .guideCard, .stockCard, .quickCard { border:1px solid #e5e7eb; border-radius:28px; background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); box-shadow:0 20px 50px rgba(15,23,42,0.06); }
        .heroMetaCard { width:320px; padding:24px; }
        .metaLabel { display:block; margin-bottom:8px; color:#64748b; font-size:.88rem; font-weight:700; }
        .heroMetaCard strong { display:block; font-size:2rem; letter-spacing:-0.04em; margin-bottom:12px; }
        .heroMetaCard p { margin:0; color:#64748b; line-height:1.8; font-size:.95rem; }
        .summaryGuideSection, .topSection, .navSection { margin-top:24px; }
        .guideCard { padding:24px; }
        .guideCard h2 { margin:0 0 16px; font-size:1.5rem; letter-spacing:-0.03em; }
        .guideGrid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; }
        .guideItem { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fff; display:flex; flex-direction:column; gap:8px; }
        .guideItem strong { color:#0f172a; }
        .guideItem span { color:#64748b; line-height:1.7; font-size:.94rem; }
        .sectionHead { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
        .sectionEyebrow { margin:0 0 6px; color:#64748b; font-size:.82rem; font-weight:800; letter-spacing:.08em; }
        .sectionHead h2 { margin:0; font-size:1.7rem; letter-spacing:-0.03em; }
        .sectionLink { color:#0f172a; }
        .topGrid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:16px; }
        .stockCard { padding:22px; }
        .cardHeader { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; }
        .rankWrap { display:flex; gap:12px; align-items:flex-start; }
        .rankBadge { display:inline-flex; min-width:64px; height:38px; align-items:center; justify-content:center; border-radius:12px; background:#0f172a; color:#fff; font-weight:900; font-size:.9rem; }
        .rankWrap h3 { margin:0 0 6px; font-size:1.18rem; letter-spacing:-0.02em; }
        .stockMeta { margin:0; color:#64748b; font-size:.9rem; }
        .scoreBox { text-align:right; }
        .scoreBox span { display:block; margin-bottom:6px; color:#64748b; font-size:.82rem; font-weight:700; }
        .scoreBox strong { display:block; font-size:1.7rem; line-height:1; letter-spacing:-0.04em; }
        .badgeRow { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
        .smallBadge { display:inline-flex; align-items:center; justify-content:center; padding:7px 11px; border-radius:999px; font-size:.8rem; font-weight:800; }
        .smallBadge.good { background:#ecfeff; color:#0891b2; }
        .smallBadge.warn { background:#fff7ed; color:#c2410c; }
        .smallBadge.muted { background:#f1f5f9; color:#475569; }
        .smallBadge.soft { background:#eef2ff; color:#4f46e5; }
        .metricGrid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; margin-bottom:14px; }
        .metricItem { border:1px solid #e5e7eb; border-radius:16px; padding:14px; background:#fff; }
        .metricItem span { display:block; margin-bottom:8px; color:#64748b; font-size:.84rem; font-weight:700; }
        .metricItem strong { font-size:1rem; letter-spacing:-0.02em; }
        .metricItem strong.sky { color:#0ea5e9; }
        .summary { margin:0; color:#475569; line-height:1.8; min-height:72px; }
        .cardActions { margin-top:14px; display:flex; justify-content:flex-end; }
        .detailBtn { height:42px; padding:0 14px; border-radius:12px; background:#0f172a; color:#fff; }
        .quickGrid { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px; }
        .quickCard { padding:20px; text-decoration:none; display:flex; flex-direction:column; gap:8px; color:#0f172a; }
        .quickCard strong { font-size:1.02rem; }
        .quickCard span { color:#64748b; line-height:1.7; font-size:.94rem; }
        @media (max-width: 1000px) {
          .topGrid, .quickGrid, .guideGrid { grid-template-columns:1fr; }
          .heroMetaCard { width:100%; }
        }
        @media (max-width: 720px) {
          .container { padding:24px 18px 64px; }
          .heroSection, .cardHeader, .sectionHead { flex-direction:column; }
          .scoreBox { text-align:left; }
        }
      `}</style>
    </>
  );
}
