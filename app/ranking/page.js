"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import stocks from "../data/stocks.json";
import MainNav from "../components/MainNav";

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

function debtRatioForUndervalue(item) {
  const explicit = Number(item?.undervalueMeta?.sortDebtRatio);
  if (Number.isFinite(explicit)) return explicit;
  const fallback = Number(item?.metrics?.debtRatio);
  return Number.isFinite(fallback) ? fallback : 999999;
}

function buildSortedStocks(items, tab) {
  const list = [...items];
  if (tab === "upside") {
    return list.sort((a, b) => {
      const aUp = Number(a?.metrics?.upside ?? -999999);
      const bUp = Number(b?.metrics?.upside ?? -999999);
      if (bUp !== aUp) return bUp - aUp;
      const aEligible = a?.rankMeta?.topRankEligible ? 1 : 0;
      const bEligible = b?.rankMeta?.topRankEligible ? 1 : 0;
      if (bEligible !== aEligible) return bEligible - aEligible;
      const aLiquidity = Number(a?.metrics?.avgTradeValue5d ?? 0);
      const bLiquidity = Number(b?.metrics?.avgTradeValue5d ?? 0);
      if (bLiquidity !== aLiquidity) return bLiquidity - aLiquidity;
      return Number(b?.metrics?.marketCap ?? 0) - Number(a?.metrics?.marketCap ?? 0);
    });
  }

  if (tab === "undervalue") {
    return list
      .filter((item) => item?.undervalueMeta?.eligible)
      .sort((a, b) => {
        const aValue = Number(a?.valueScore ?? 0);
        const bValue = Number(b?.valueScore ?? 0);
        if (bValue !== aValue) return bValue - aValue;
        const aDebt = debtRatioForUndervalue(a);
        const bDebt = debtRatioForUndervalue(b);
        if (aDebt !== bDebt) return aDebt - bDebt;
        const aUp = Number(a?.metrics?.upside ?? -999999);
        const bUp = Number(b?.metrics?.upside ?? -999999);
        if (bUp !== aUp) return bUp - aUp;
        const aLiquidity = Number(a?.metrics?.avgTradeValue5d ?? 0);
        const bLiquidity = Number(b?.metrics?.avgTradeValue5d ?? 0);
        if (bLiquidity !== aLiquidity) return bLiquidity - aLiquidity;
        return Number(b?.metrics?.marketCap ?? 0) - Number(a?.metrics?.marketCap ?? 0);
      });
  }

  return list.sort((a, b) => {
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

function buildOneLineReason(stock, activeTab) {
  const parts = [];
  const valueScore = Number(stock?.valueScore ?? 0);
  const totalScore = Number(stock?.totalScore ?? 0);
  const upside = Number(stock?.metrics?.upside);
  const debtRatio = Number(stock?.metrics?.debtRatio);
  const rankPenalty = Number(stock?.rankMeta?.penalty ?? 0);
  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];

  if (activeTab === "total") {
    if (stock?.rankMeta?.topRankEligible) parts.push("안정성 조건 통과");
    if (totalScore >= 70) parts.push(`총점 ${totalScore}점`);
    if (Number.isFinite(upside) && upside > 0) parts.push(`상승여력 ${formatPercent(upside)}`);
    if (rankPenalty > 0) parts.push(`패널티 ${rankPenalty}`);
    if (rankFlags.length) parts.push(rankFlags[0]);
  } else if (activeTab === "undervalue") {
    if (valueScore > 0) parts.push(`가치 점수 ${valueScore}점`);
    if (Number.isFinite(debtRatio)) parts.push(`부채비율 ${formatPercent(debtRatio)}`);
    if (Number.isFinite(upside) && upside > 0) parts.push(`상승여력 ${formatPercent(upside)}`);
    if (undervalueFlags.length) parts.push(undervalueFlags[0]);
  } else {
    if (Number.isFinite(upside)) parts.push(`상승여력 ${formatPercent(upside)}`);
    if (stock?.rankMeta?.topRankEligible) parts.push("종합 조건 통과");
    if (rankFlags.length) parts.push(rankFlags[0]);
  }

  if (!parts.length) return "현재 수치 조합을 기준으로 상대 비교된 결과입니다.";
  return parts.join(" · ");
}

function buildWarningLine(stock, activeTab) {
  const rankPenalty = Number(stock?.rankMeta?.penalty ?? 0);
  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];
  const debtRatio = Number(stock?.metrics?.debtRatio);
  const upside = Number(stock?.metrics?.upside);

  if (activeTab === "total") {
    if (rankPenalty > 0) return `종합 해석에는 패널티 ${rankPenalty}점이 반영됩니다.`;
    if (rankFlags.length) return `주의 포인트: ${rankFlags[0]}`;
    if (Number.isFinite(debtRatio) && debtRatio >= 150) return `부채비율 ${formatPercent(debtRatio)}로 보수 해석이 필요합니다.`;
    return "실적·재무·수급 변화에 따라 종합 조건 통과 여부가 바뀔 수 있습니다.";
  }

  if (activeTab === "undervalue") {
    if (undervalueFlags.length) return `주의 포인트: ${undervalueFlags[0]}`;
    if (Number.isFinite(debtRatio) && debtRatio >= 150) return `저평가처럼 보여도 부채비율 ${formatPercent(debtRatio)}를 함께 확인해야 합니다.`;
    return "가치 점수가 높아도 재무 안정성 해석은 별도로 확인해야 합니다.";
  }

  if (Number.isFinite(upside) && upside <= 0) return "현재 적정가 추정 기준 즉각적인 상승여력은 크지 않을 수 있습니다.";
  if (rankFlags.length) return `주의 포인트: ${rankFlags[0]}`;
  return "상승여력은 참고치이며 실제 결과는 업황·실적·수급에 따라 달라질 수 있습니다.";
}

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState("total");
  const [query, setQuery] = useState("");

  const sortedStocks = useMemo(() => buildSortedStocks(stocks, activeTab), [activeTab]);

  const rankMap = useMemo(() => {
    return new Map(sortedStocks.map((item, index) => [String(item.code), index + 1]));
  }, [sortedStocks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedStocks;
    return sortedStocks.filter((item) => {
      return (
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.code || "").toLowerCase().includes(q)
      );
    });
  }, [sortedStocks, query]);

  const topEligibleCount = useMemo(
    () => stocks.filter((item) => item?.rankMeta?.topRankEligible).length,
    []
  );

  const undervalueEligibleCount = useMemo(
    () => stocks.filter((item) => item?.undervalueMeta?.eligible).length,
    []
  );

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">홈으로 가기</Link>
          <MainNav />
        </div>

        <section className="pageHero">
          <div>
            <p className="badge">RANKING</p>
            <h1>종목 랭킹</h1>
            <p className="desc">
              종합 랭킹은 안정성 조건을 통과한 종목을 우선 반영합니다.
              <br />
              저평가 랭킹은 가치지표 중심으로 보되, 부채비율과 이익 안정성을 함께 확인하는 보수적 정렬을 사용합니다.
            </p>
          </div>

          <div className="heroMeta">
            <div className="heroMetaTopRow">
              <div className="metaCard compact">
                <span className="metaLabel">종합 우선 후보</span>
                <strong>{topEligibleCount}종목</strong>
              </div>
              <div className="metaCard compact">
                <span className="metaLabel">저평가 후보</span>
                <strong>{undervalueEligibleCount}종목</strong>
              </div>
            </div>
            <div className="metaCard light fullSearchCard">
              <span className="metaLabel">검색</span>
              <input
                className="searchInput"
                placeholder="종목명 / 종목코드"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="guideSection">
          <div className="guideCard">
            <h2>랭킹 해석 가이드</h2>
            <div className="guideGrid">
              <div className="guideItem">
                <strong>종합</strong>
                <span>총점이 높더라도 재무 안정성 조건을 통과하지 못하면 상단 노출이 제한될 수 있습니다.</span>
              </div>
              <div className="guideItem">
                <strong>저평가</strong>
                <span>가치 점수 중심 탭이지만, 동점일 때는 부채비율이 낮은 종목을 먼저 보여줍니다.</span>
              </div>
              <div className="guideItem">
                <strong>상승여력</strong>
                <span>적정가 추정 대비 괴리가 큰 종목을 별도 관점으로 보여주며, 실제 실현은 별도 확인이 필요합니다.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="tabSection">
          <div className="tabRow">
            <button type="button" className={`tabBtn ${activeTab === "total" ? "active" : ""}`} onClick={() => setActiveTab("total")}>종합</button>
            <button type="button" className={`tabBtn ${activeTab === "undervalue" ? "active" : ""}`} onClick={() => setActiveTab("undervalue")}>저평가</button>
            <button type="button" className={`tabBtn ${activeTab === "upside" ? "active" : ""}`} onClick={() => setActiveTab("upside")}>상승여력</button>
          </div>
        </section>

        <section className="listSection">
          <div className="listGrid">
            {filtered.map((stock) => {
              const eligible = !!stock?.rankMeta?.topRankEligible;
              const rankFlags = stock?.rankMeta?.flags || [];
              const undervalueFlags = stock?.undervalueMeta?.flags || [];
              const penalty = Number(stock?.rankMeta?.penalty || 0);
              const displayRank = rankMap.get(String(stock.code)) ?? "-";
              const scoreLabel =
                activeTab === "undervalue"
                  ? "가치 점수"
                  : activeTab === "upside"
                    ? "상승여력"
                    : "종합 점수";
              const scoreValue =
                activeTab === "undervalue"
                  ? stock.valueScore
                  : activeTab === "upside"
                    ? formatPercent(stock?.metrics?.upside)
                    : stock.totalScore;

              return (
                <article className="stockCard" key={`${stock.code}-${activeTab}`}>
                  <div className="cardTop">
                    <div className="rankWrap">
                      <span className="rankBadge">#{displayRank}</span>
                      <div>
                        <h3>{stock.name}</h3>
                        <p className="stockMeta">{stock.market} · {stock.code}</p>
                      </div>
                    </div>
                    <div className="scoreWrap">
                      <span className="scoreLabel">{scoreLabel}</span>
                      <strong>{scoreValue}</strong>
                      {activeTab === "total" && Number(stock.rawTotalScore) !== Number(stock.totalScore) ? (
                        <span className="rawScore">원점수 {stock.rawTotalScore}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="metricRow">
                    <div className="metricBox">
                      <span>현재가</span>
                      <strong>{formatPrice(stock?.metrics?.closePrice)}</strong>
                    </div>
                    <div className="metricBox">
                      <span>적정가 추정</span>
                      <strong>{formatPrice(stock?.metrics?.targetPrice)}</strong>
                    </div>
                    <div className="metricBox">
                      <span>상승여력</span>
                      <strong className="sky">{formatPercent(stock?.metrics?.upside)}</strong>
                    </div>
                    <div className="metricBox">
                      <span>부채비율</span>
                      <strong>{formatPercent(stock?.metrics?.debtRatio)}</strong>
                    </div>
                  </div>

                  <div className="badgeRow">
                    {activeTab === "total" ? (
                      eligible ? <span className="smallBadge good">종합 상위 후보</span> : <span className="smallBadge warn">종합 상위 제외</span>
                    ) : null}
                    {activeTab === "undervalue" && stock?.undervalueMeta?.eligible ? <span className="smallBadge info">저평가 후보</span> : null}
                    {activeTab === "total" && penalty > 0 ? <span className="smallBadge muted">패널티 {penalty}</span> : null}
                    {activeTab === "total" && rankFlags.map((flag) => <span className="smallBadge soft" key={flag}>{flag}</span>)}
                    {activeTab === "undervalue" && undervalueFlags.map((flag) => <span className="smallBadge soft" key={flag}>{flag}</span>)}
                  </div>

                  <div className="reasonCard goodCard">
                    <span className="reasonLabel">왜 올라왔나</span>
                    <p>{buildOneLineReason(stock, activeTab)}</p>
                  </div>

                  <div className="reasonCard warnCard">
                    <span className="reasonLabel">무엇을 조심해야 하나</span>
                    <p>{buildWarningLine(stock, activeTab)}</p>
                  </div>

                  <p className="summary">{stock.summary}</p>

                  <div className="linkRow">
                    <Link
                      href={`/risk?code=${stock.code}#risk-${stock.code}`}
                      className="riskBtn"
                    >
                      리스크 보기
                    </Link>
                    <Link href={`/stock/${stock.code}`} className="detailBtn">상세 보기</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <style jsx>{`
        .container { max-width: 1180px; margin: 0 auto; padding: 32px 24px 80px; color: #0f172a; }
        .topLinks { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 26px; flex-wrap: wrap; }
        .homeBtn { display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; padding: 12px 16px; text-decoration: none; font-weight: 800; border: 1px solid #0f172a; background: #0f172a; color: #fff; }
        .pageHero { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
        .badge { display: inline-flex; padding: 8px 14px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 0.82rem; font-weight: 800; margin: 0 0 18px; }
        h1 { margin: 0 0 12px; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.04em; }
        .desc { margin: 0; max-width: 760px; color: #475569; line-height: 1.8; font-size: 1.02rem; }
        .heroMeta { display: grid; gap: 12px; min-width: 280px; width: 320px; }
        .heroMetaTopRow { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .metaCard { border: 1px solid #e5e7eb; border-radius: 20px; padding: 18px; background: #fff; box-shadow: 0 14px 34px rgba(15,23,42,0.05); }
        .metaCard.compact { min-width: 0; }
        .metaCard.light { background: #f8fbff; }
        .metaLabel { display:block; margin-bottom:8px; color:#64748b; font-size:.88rem; font-weight:700; }
        .metaCard strong { font-size: 1.5rem; letter-spacing: -0.03em; }
        .fullSearchCard { width: 100%; }
        .searchInput { width: 100%; height: 44px; border-radius: 12px; border: 1px solid #dbe3f0; padding: 0 14px; font-size: .95rem; box-sizing: border-box; }
        .guideSection, .tabSection, .listSection { margin-top: 20px; }
        .guideCard { border: 1px solid #e5e7eb; border-radius: 28px; padding: 24px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); box-shadow: 0 20px 50px rgba(15,23,42,0.06); }
        .guideCard h2 { margin:0 0 16px; font-size:1.35rem; }
        .guideGrid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
        .guideItem { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fff; display:flex; flex-direction:column; gap:8px; }
        .guideItem strong { color:#0f172a; }
        .guideItem span { color:#64748b; line-height:1.7; font-size:.94rem; }
        .tabRow { display:flex; gap:10px; flex-wrap:wrap; }
        .tabBtn { height:44px; padding:0 18px; border-radius:14px; border:1px solid #dbe3f0; background:#fff; color:#0f172a; font-weight:800; cursor:pointer; }
        .tabBtn.active { background:#0f172a; color:#fff; border-color:#0f172a; }
        .listGrid { display:grid; gap:16px; }
        .stockCard { border: 1px solid #e5e7eb; border-radius: 24px; padding: 22px; background: #fff; box-shadow: 0 18px 40px rgba(15,23,42,0.05); }
        .cardTop { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
        .rankWrap { display:flex; gap:14px; align-items:flex-start; }
        .rankBadge { display:inline-flex; min-width:52px; height:52px; align-items:center; justify-content:center; border-radius:16px; background:#0f172a; color:#fff; font-weight:900; }
        .rankWrap h3 { margin:0 0 6px; font-size:1.2rem; letter-spacing:-0.02em; }
        .stockMeta { margin:0; color:#64748b; font-size:.92rem; }
        .scoreWrap { text-align:right; min-width:110px; }
        .scoreLabel { display:block; margin-bottom:6px; color:#64748b; font-size:.84rem; font-weight:700; }
        .scoreWrap strong { display:block; font-size:1.8rem; line-height:1; letter-spacing:-0.04em; }
        .rawScore { display:block; margin-top:6px; color:#64748b; font-size:.84rem; }
        .metricRow { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:12px; margin-bottom:14px; }
        .metricBox { border:1px solid #e5e7eb; border-radius:16px; padding:14px; background:#f8fbff; }
        .metricBox span { display:block; margin-bottom:8px; color:#64748b; font-size:.84rem; font-weight:700; }
        .metricBox strong { font-size:1rem; letter-spacing:-0.02em; }
        .metricBox strong.sky { color:#0ea5e9; }
        .badgeRow { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
        .smallBadge { display:inline-flex; align-items:center; justify-content:center; padding:7px 11px; border-radius:999px; font-size:.8rem; font-weight:800; }
        .smallBadge.good { background:#ecfeff; color:#0891b2; }
        .smallBadge.warn { background:#fff7ed; color:#c2410c; }
        .smallBadge.muted { background:#f1f5f9; color:#475569; }
        .smallBadge.soft { background:#eef2ff; color:#4f46e5; }
        .smallBadge.info { background:#e0f2fe; color:#0284c7; }
        .reasonCard { border:1px solid #e5e7eb; border-radius:16px; padding:14px; margin-bottom:12px; }
        .goodCard { background:#f8fbff; }
        .warnCard { background:#fffdfa; }
        .reasonLabel { display:block; margin-bottom:8px; color:#0f172a; font-size:.84rem; font-weight:800; }
        .reasonCard p { margin:0; color:#475569; line-height:1.75; }
        .summary { margin:0; color:#475569; line-height:1.8; }
        .linkRow { margin-top:14px; display:flex; justify-content:flex-end; align-items:center; gap:10px; flex-wrap:wrap; }
        .riskBtn { display:inline-flex; align-items:center; justify-content:center; height:42px; padding:0 14px; border-radius:12px; text-decoration:none; background:#ffffff; color:#0f172a; font-weight:800; border:1px solid #cbd5e1; box-shadow:0 6px 16px rgba(15,23,42,0.06); transition:all .15s ease; }
        .riskBtn:hover { border-color:#94a3b8; background:#f8fafc; transform:translateY(-1px); }
        .detailBtn { display:inline-flex; align-items:center; justify-content:center; height:42px; padding:0 14px; border-radius:12px; text-decoration:none; background:#0f172a; color:#fff; font-weight:800; }
        @media (max-width: 900px) {
          .guideGrid, .metricRow { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .container { padding: 24px 18px 64px; }
          .pageHero, .cardTop { flex-direction:column; }
          .scoreWrap { text-align:left; }
          .guideCard, .stockCard { padding:20px; }
          .heroMeta { width: 100%; min-width: 0; }
          .heroMetaTopRow { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .metaCard.compact { padding: 16px; }
          .fullSearchCard { width: 100%; }
          .searchInput { width: 100%; }
        }
      `}</style>
    </>
  );
}
