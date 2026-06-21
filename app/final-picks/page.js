"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import stocks from "../data/stocks.json";
import risks from "../data/risks.json";
import MainNav from "../components/MainNav";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function formatCompactKrw(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  if (num >= 1_0000_0000_0000) return `${(num / 1_0000_0000_0000).toFixed(1)}조원`;
  if (num >= 1_0000_0000) return `${(num / 1_0000_0000).toFixed(0)}억원`;
  return `${num.toLocaleString("ko-KR")}원`;
}

function getRiskLevelClass(level) {
  if (level === "주의") return "riskChip high";
  if (level === "보통") return "riskChip mid";
  return "riskChip low";
}

function getDecisionClass(decision) {
  if (decision === "매수 후보") return "decisionChip buy";
  if (decision === "관찰") return "decisionChip watch";
  return "decisionChip exclude";
}

function sortForBaselineRanking(items) {
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

function buildRiskMap(items) {
  const map = new Map();
  items.forEach((item) => map.set(String(item.code), item));
  return map;
}

function riskPenaltyFromLevel(level) {
  if (level === "주의") return 18;
  if (level === "보통") return 8;
  return 0;
}

function computeSectorScore(stock) {
  const explicit = Number(stock?.sectorMeta?.strengthScore ?? stock?.sectorStrengthScore ?? stock?.marketContext?.sectorStrengthScore);
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 100);
  const momentum = Number(stock?.metrics?.priceChangeRate ?? stock?.metrics?.momentum ?? 0);
  const revenueGrowth = Number(stock?.metrics?.revenueGrowth ?? 0);
  return clamp(50 + momentum * 0.6 + revenueGrowth * 0.4, 0, 100);
}

function computeMarketFitScore(stock) {
  const explicit = Number(stock?.marketContext?.fitScore ?? stock?.marketFitScore);
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 100);
  const market = String(stock?.market || "").toUpperCase();
  const liquidity = Number(stock?.metrics?.avgTradeValue5d ?? 0);
  const base = market === "KOSPI" ? 58 : 52;
  const liquidityBonus = clamp((liquidity / 250_0000_0000) * 20, 0, 20);
  return clamp(base + liquidityBonus, 0, 100);
}

function computeNewsScore(stock) {
  const explicit = Number(stock?.newsMeta?.score ?? stock?.newsScore);
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 100);
  const positiveCount = Number(stock?.newsMeta?.positiveCount ?? 0);
  const negativeCount = Number(stock?.newsMeta?.negativeCount ?? 0);
  const uncertainty = Number(stock?.newsMeta?.uncertaintyCount ?? 0);
  return clamp(60 + positiveCount * 8 - negativeCount * 14 - uncertainty * 6, 0, 100);
}

function computeLiquidityScore(stock) {
  const explicit = Number(stock?.liquidityMeta?.score ?? stock?.liquidityScore);
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 100);
  const liquidity = Number(stock?.metrics?.avgTradeValue5d ?? 0);
  return clamp((liquidity / 300_0000_0000) * 100, 0, 100);
}

function computeTimingScore(stock) {
  const explicit = Number(stock?.timingMeta?.score ?? stock?.timingScore);
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 100);
  const momentum = Number(stock?.metrics?.priceChangeRate ?? stock?.metrics?.momentum ?? 0);
  const upside = Number(stock?.metrics?.upside ?? 0);
  const debt = Number(stock?.metrics?.debtRatio ?? 999999);
  const timingBase = 55 + momentum * 0.8 + upside * 0.15 - clamp((debt - 100) * 0.05, 0, 12);
  return clamp(timingBase, 0, 100);
}

function computeWarningPenalty(stock, riskItem) {
  let penalty = 0;
  penalty += riskPenaltyFromLevel(riskItem?.level);
  const debt = Number(stock?.metrics?.debtRatio ?? 0);
  if (debt >= 200) penalty += 12;
  else if (debt >= 150) penalty += 6;
  const negativeCount = Number(stock?.newsMeta?.negativeCount ?? 0);
  const uncertainty = Number(stock?.newsMeta?.uncertaintyCount ?? 0);
  penalty += negativeCount * 5;
  penalty += uncertainty * 3;
  const recentSpike = Number(stock?.timingMeta?.recentSpikeFlag ? 1 : 0);
  if (recentSpike) penalty += 6;
  return penalty;
}

function buildDecisionReasons(stock, riskItem, scores, decision) {
  const reasons = [];
  const sectorName = stock?.sector || stock?.industry || "업종 정보 없음";

  if (scores.base >= 75) reasons.push(`기존 랭킹 총점이 ${Math.round(scores.base)}점으로 높습니다.`);
  else if (scores.base >= 60) reasons.push(`기존 랭킹 기준에서는 상위 후보로 볼 수 있는 점수입니다.`);
  else reasons.push(`기존 랭킹 점수는 높지 않지만 다른 조건까지 함께 점검했습니다.`);

  if (scores.sector >= 65) reasons.push(`${sectorName} 흐름이 비교적 양호해 업종 측면 가점이 있습니다.`);
  else if (scores.sector <= 45) reasons.push(`${sectorName} 흐름이 약해 업종 수급은 보수적으로 봐야 합니다.`);

  if (scores.news >= 70) reasons.push(`최근 뉴스/공시 플래그는 비교적 무난한 편입니다.`);
  else if (scores.news <= 45) reasons.push(`최근 뉴스 플래그상 불확실성이 있어 바로 진입하긴 부담이 있습니다.`);

  if (riskItem?.level === "주의") reasons.push(`리스크 페이지 기준이 \"주의\"라서 최종 판단에서 감점됩니다.`);
  else if (riskItem?.level === "보통") reasons.push(`리스크 수준이 \"보통\"이라 체크 포인트 확인이 필요합니다.`);

  if (scores.timing >= 68) reasons.push(`타이밍/유동성 기준은 크게 무리 없는 구간입니다.`);
  else if (scores.timing <= 45) reasons.push(`지금 진입 타이밍은 다소 아쉬워 관찰이 더 적절합니다.`);

  if (decision === "매수 후보") reasons.push(`기존 랭킹 이후 조건을 한 번 더 걸렀을 때도 통과한 종목입니다.`);
  else if (decision === "관찰") reasons.push(`기존 랭킹에서는 괜찮지만 실전 진입 전 한 번 더 관찰이 필요한 종목입니다.`);
  else reasons.push(`랭킹 상위권일 수는 있어도 지금 바로 매수 대상으로 보긴 어렵습니다.`);

  return reasons.slice(0, 4);
}

function buildFinalPicks(stocksData, risksData) {
  const baseline = sortForBaselineRanking(stocksData);
  const rankMap = new Map(baseline.map((item, index) => [String(item.code), index + 1]));
  const riskMap = buildRiskMap(risksData);

  const evaluated = baseline.map((stock) => {
    const riskItem = riskMap.get(String(stock.code));

    const scores = {
      base: clamp(Number(stock?.totalScore ?? 0), 0, 100),
      sector: computeSectorScore(stock),
      market: computeMarketFitScore(stock),
      news: computeNewsScore(stock),
      liquidity: computeLiquidityScore(stock),
      timing: computeTimingScore(stock),
      warningPenalty: computeWarningPenalty(stock, riskItem),
    };

    const finalScore = clamp(
      scores.base * 0.40 +
      scores.sector * 0.12 +
      scores.market * 0.10 +
      scores.news * 0.12 +
      scores.liquidity * 0.10 +
      scores.timing * 0.16 -
      scores.warningPenalty,
      0,
      100
    );

    const hasHardExclude =
      riskItem?.level === "주의" ||
      Number(stock?.metrics?.debtRatio ?? 0) >= 220 ||
      Number(stock?.newsMeta?.negativeCount ?? 0) >= 2;

    let decision = "관찰";
    if (!hasHardExclude && finalScore >= 72 && scores.news >= 50 && scores.timing >= 52) decision = "매수 후보";
    else if (hasHardExclude || finalScore < 52) decision = "제외";

    return {
      ...stock,
      riskItem,
      baselineRank: rankMap.get(String(stock.code)) ?? null,
      finalScore: Math.round(finalScore),
      decision,
      sectorName: stock?.sector || stock?.industry || "업종 미분류",
      decisionReasons: buildDecisionReasons(stock, riskItem, scores, decision),
      scoreBreakdown: scores,
      riskLevel: riskItem?.level || "낮음",
    };
  });

  const groupOrder = { "매수 후보": 0, "관찰": 1, "제외": 2 };
  const grouped = evaluated.sort((a, b) => {
    const groupDiff = groupOrder[a.decision] - groupOrder[b.decision];
    if (groupDiff !== 0) return groupDiff;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return (a.baselineRank || 9999) - (b.baselineRank || 9999);
  });

  return {
    buy: grouped.filter((item) => item.decision === "매수 후보"),
    watch: grouped.filter((item) => item.decision === "관찰"),
    exclude: grouped.filter((item) => item.decision === "제외"),
  };
}

const DECISION_META = {
  buy: { title: "매수 후보", desc: "기존 랭킹 이후에도 업종·리스크·타이밍 조건을 다시 통과한 종목입니다." },
  watch: { title: "관찰 후보", desc: "재무와 가치 측면은 괜찮지만 지금 바로 진입하기엔 확신이 부족한 종목입니다." },
  exclude: { title: "제외 후보", desc: "랭킹에 올라와도 현재 국면에서는 실전 매수 대상으로 보기 어려운 종목입니다." },
};

function PickSection({ title, desc, items, emptyText }) {
  return (
    <section className="pickSection">
      <div className="sectionHeaderRow">
        <div>
          <h2 className="sectionTitle">{title}</h2>
          <p className="sectionDesc">{desc}</p>
        </div>
        <span className="sectionCount">{items.length}개</span>
      </div>

      {items.length ? (
        <div className="pickGrid">
          {items.map((item) => (
            <article className="pickCard" key={`${title}-${item.code}`}>
              <div className="pickTop">
                <div>
                  <div className="topLabelRow">
                    <span className="rankTag">기존 랭킹 #{item.baselineRank ?? "-"}</span>
                    <span className={getRiskLevelClass(item.riskLevel)}>{item.riskLevel}</span>
                  </div>
                  <h3>{item.name}</h3>
                  <p className="subMeta">{item.market} · {item.code} · {item.sectorName}</p>
                </div>
                <div className="scoreBox">
                  <span>최종 투자 점수</span>
                  <strong>{item.finalScore}점</strong>
                </div>
              </div>

              <div className="middleCard">
                <div className="badgeRow">
                  <span className={getDecisionClass(item.decision)}>{item.decision}</span>
                  {item?.rankMeta?.topRankEligible ? <span className="smallBadge info">기존 종합 조건 통과</span> : null}
                  {item?.undervalueMeta?.eligible ? <span className="smallBadge soft">저평가 후보</span> : null}
                </div>

                <div className="metricRow">
                  <div className="metricBox">
                    <span>현재가</span>
                    <strong>{formatPrice(item?.metrics?.closePrice)}</strong>
                  </div>
                  <div className="metricBox">
                    <span>적정가 추정</span>
                    <strong>{formatPrice(item?.metrics?.targetPrice)}</strong>
                  </div>
                  <div className="metricBox accent">
                    <span>상승여력</span>
                    <strong>{formatPercent(item?.metrics?.upside)}</strong>
                  </div>
                  <div className="metricBox">
                    <span>거래대금</span>
                    <strong>{formatCompactKrw(item?.metrics?.avgTradeValue5d)}</strong>
                  </div>
                </div>

                <div className="middleSections">
                  <div className="innerPanel emphasis">
                    <span className="reasonLabel">한 줄 판단</span>
                    <p>
                      기존 랭킹 #{item.baselineRank ?? "-"} 후보였고, 업종 흐름·리스크·타이밍을 다시 반영한 결과 현재는
                      <b> {item.decision}</b>로 분류했습니다.
                    </p>
                  </div>

                  <div className="innerPanel">
                    <span className="reasonLabel">판정 이유 핵심</span>
                    <ul className="reasonList">
                      {item.decisionReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="innerPanel soft">
                    <span className="reasonLabel">왜 랭킹과 최종 판단이 다를 수 있나</span>
                    <p>
                      랭킹은 재무·밸류·유동성 중심의 1차 후보 생성입니다. 여기서는 여기에 업종 흐름,
                      뉴스 플래그, 리스크 수준, 타이밍 요소를 다시 반영해 실전 후보를 압축합니다.
                    </p>
                  </div>
                </div>

                <div className="cardActions">
                  <Link href={`/stock/${item.code}`} className="detailBtn">종목 상세 보기</Link>
                  <Link href={`/risk?code=${item.code}`} className="ghostBtn">리스크 확인</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="emptyBox">
          <p>{emptyText}</p>
        </div>
      )}
    </section>
  );
}

export default function FinalPicksPage() {
  const [selectedGroup, setSelectedGroup] = useState("buy");
  const finalPicks = useMemo(() => buildFinalPicks(stocks, risks), []);
  const currentItems = selectedGroup === "watch" ? finalPicks.watch : selectedGroup === "exclude" ? finalPicks.exclude : finalPicks.buy;

  return (
    <main className="container">
      <div className="topLinks">
        <Link href="/" className="homeBtn">홈으로 가기</Link>
        <MainNav />
      </div>

      <section className="pageHero">
        <div>
          <p className="badge">FINAL PICKS</p>
          <h1>랭킹 이후, 실전 투자 후보만 한 번 더 걸러봅니다</h1>
          <p className="desc">
            랭킹이 1차 후보를 만든다면, 여기서는 업종 흐름·리스크·뉴스 플래그·타이밍을 다시 반영해 실제로 줄여 볼 후보만 남깁니다.
          </p>
        </div>
        <div className="heroInfoGrid">
          <div className="heroInfoCard good"><span>매수 후보</span><strong>{finalPicks.buy.length}</strong></div>
          <div className="heroInfoCard mid"><span>관찰 후보</span><strong>{finalPicks.watch.length}</strong></div>
          <div className="heroInfoCard warn"><span>제외 후보</span><strong>{finalPicks.exclude.length}</strong></div>
        </div>
      </section>

      <section className="switchSection">
        <div className="switchCard">
          <div className="tabRow">
            <button type="button" className={`tabBtn ${selectedGroup === "buy" ? "active" : ""}`} onClick={() => setSelectedGroup("buy")}>매수 후보</button>
            <button type="button" className={`tabBtn ${selectedGroup === "watch" ? "active" : ""}`} onClick={() => setSelectedGroup("watch")}>관찰 후보</button>
            <button type="button" className={`tabBtn ${selectedGroup === "exclude" ? "active" : ""}`} onClick={() => setSelectedGroup("exclude")}>제외 후보</button>
          </div>
          <p className="switchDesc">현재 선택: {DECISION_META[selectedGroup].title} · {DECISION_META[selectedGroup].desc}</p>
        </div>
      </section>

      <PickSection
        title={DECISION_META[selectedGroup].title}
        desc={DECISION_META[selectedGroup].desc}
        items={currentItems}
        emptyText="현재 기준으로 표시할 종목이 없습니다."
      />

      <section className="logicSection">
        <div className="logicCard">
          <h2>A안 / B안 제안</h2>
          <div className="guideGrid twoCol">
            <div className="guideItem">
              <strong>A안: 규칙 기반 MVP</strong>
              <span>기존 stocks.json + risks.json + 업종/뉴스 플래그 필드만으로 최종 점수를 계산합니다. 빠르게 붙일 수 있고, 현재 서비스 신뢰 회복용 1차 버전으로 적합합니다.</span>
            </div>
            <div className="guideItem">
              <strong>B안: AI 해석 확장</strong>
              <span>뉴스/공시 요약과 자연어 판정 설명까지 붙여서 왜 통과/제외됐는지 사람이 읽는 문장으로 더 정교하게 보여줍니다. MVP 이후 고도화 단계에 적합합니다.</span>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .container { max-width: 1180px; margin: 0 auto; padding: 32px 24px 80px; color: #0f172a; }
        .topLinks { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:26px; flex-wrap:wrap; }
        .homeBtn { display:inline-flex; align-items:center; justify-content:center; border-radius:14px; padding:12px 16px; text-decoration:none; font-weight:800; border:1px solid #0f172a; background:#0f172a; color:#fff; }
        .badge { display:inline-flex; padding:8px 14px; border-radius:999px; background:#eef2ff; color:#4f46e5; font-size:.82rem; font-weight:800; margin:0 0 18px; }
        h1 { margin:0 0 12px; font-size:clamp(2rem,4vw,3rem); letter-spacing:-0.04em; }
        .pageHero { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; flex-wrap:wrap; }
        .desc { margin:0; max-width:760px; color:#475569; line-height:1.8; font-size:1.02rem; }
        .heroInfoGrid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; min-width:320px; width:360px; }
        .heroInfoCard { border:1px solid #e5e7eb; border-radius:20px; padding:18px; background:#fff; }
        .heroInfoCard span { display:block; margin-bottom:10px; font-size:.86rem; font-weight:700; }
        .heroInfoCard strong { font-size:1.7rem; }
        .heroInfoCard.good span,.heroInfoCard.good strong { color:#0f766e; }
        .heroInfoCard.mid span,.heroInfoCard.mid strong { color:#b45309; }
        .heroInfoCard.warn span,.heroInfoCard.warn strong { color:#be123c; }
        .switchSection,.pickSection,.logicSection { margin-top:26px; }
        .switchCard,.pickCard,.emptyBox,.logicCard { border:1px solid #e5e7eb; border-radius:28px; padding:24px; background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); box-shadow:0 20px 50px rgba(15,23,42,.06); }
        .tabRow { display:flex; gap:10px; flex-wrap:wrap; }
        .tabBtn { height:44px; padding:0 18px; border-radius:999px; border:1px solid #dbe3f0; background:#fff; color:#0f172a; font-weight:800; cursor:pointer; }
        .tabBtn.active { background:#0f172a; color:#fff; border-color:#0f172a; }
        .switchDesc { margin:14px 0 0; color:#64748b; }
        .sectionHeaderRow { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
        .sectionTitle { margin:0 0 8px; font-size:1.8rem; }
        .sectionDesc { margin:0; color:#64748b; line-height:1.72; }
        .sectionCount { display:inline-flex; align-items:center; justify-content:center; min-width:74px; height:42px; padding:0 14px; border-radius:14px; background:#0f172a; color:#fff; font-weight:800; }
        .pickGrid { display:grid; gap:18px; }
        .pickCard { padding:28px; }
        .pickTop { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; flex-wrap:wrap; margin-bottom:18px; }
        .topLabelRow { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
        .rankTag,.riskChip,.decisionChip,.smallBadge { display:inline-flex; align-items:center; justify-content:center; padding:7px 12px; border-radius:999px; font-size:.8rem; font-weight:800; }
        .rankTag { background:#eef2ff; color:#4f46e5; }
        .riskChip.low { background:#dcfce7; color:#15803d; }
        .riskChip.mid { background:#fef3c7; color:#b45309; }
        .riskChip.high { background:#fee2e2; color:#dc2626; }
        .decisionChip.buy { background:#ccfbf1; color:#0f766e; }
        .decisionChip.watch { background:#fff7ed; color:#b45309; }
        .decisionChip.exclude { background:#ffe4e6; color:#be123c; }
        .smallBadge.info { background:#e0f2fe; color:#0284c7; }
        .smallBadge.soft { background:#f1f5f9; color:#475569; }
        .pickCard h3 { margin:0 0 8px; font-size:1.72rem; letter-spacing:-0.03em; word-break:keep-all; }
        .subMeta { margin:0; color:#64748b; }
        .scoreBox { min-width:160px; border:1px solid #e5e7eb; border-radius:22px; padding:16px; background:#fff; text-align:right; }
        .scoreBox span { display:block; margin-bottom:6px; color:#64748b; font-size:.84rem; font-weight:700; }
        .scoreBox strong { display:block; font-size:2rem; line-height:1; }
        .middleCard { border:1px solid #e5e7eb; border-radius:24px; background:#ffffff; padding:20px; }
        .badgeRow { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
        .metricRow { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; margin-bottom:14px; }
        .metricBox { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fff; }
        .metricBox.accent { background:#f8fbff; }
        .metricBox span { display:block; margin-bottom:8px; color:#64748b; font-size:.84rem; font-weight:700; }
        .metricBox strong { font-size:1.1rem; line-height:1.35; }
        .middleSections { display:grid; gap:12px; }
        .innerPanel { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fff; }
        .innerPanel.emphasis { background:#f8fafc; }
        .innerPanel.soft { background:#fbfdff; }
        .reasonLabel { display:block; margin-bottom:8px; color:#0f172a; font-size:.84rem; font-weight:800; }
        .innerPanel p { margin:0; color:#475569; line-height:1.78; }
        .innerPanel b { color:#0f172a; }
        .reasonList { margin:0; padding-left:18px; color:#475569; line-height:1.8; }
        .reasonList li + li { margin-top:4px; }
        .cardActions { display:flex; gap:12px; flex-wrap:wrap; margin-top:16px; }
        .detailBtn,.ghostBtn { display:inline-flex; align-items:center; justify-content:center; height:46px; padding:0 16px; border-radius:14px; font-weight:800; text-decoration:none; border:1px solid transparent; }
        .detailBtn { background:#0f172a; color:#fff; }
        .ghostBtn { background:#fff; color:#0f172a; border-color:#dbe3f0; }
        @media (max-width:980px) {
          .heroInfoGrid,.metricRow { grid-template-columns:1fr; }
        }
        @media (max-width:760px) {
          .container { padding:24px 18px 64px; }
          .pageHero,.pickTop,.sectionHeaderRow { flex-direction:column; align-items:flex-start; }
          .scoreBox { width:100%; text-align:left; }
          .switchCard,.pickCard,.logicCard,.emptyBox { padding:20px; }
          .detailBtn,.ghostBtn { width:100%; }
          .pickCard h3 { font-size:1.45rem; }
        }
      `}</style>
    </main>
  );
}
