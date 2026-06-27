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

function buildRiskMap(items) {
  const map = new Map();
  items.forEach((item) => map.set(String(item.code), item));
  return map;
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

function normalizeDecision(rawDecision) {
  const value = String(rawDecision || "").trim().toUpperCase();

  if (value === "BUY_CANDIDATE" || value === "BUY" || rawDecision === "매수 후보") {
    return "buy";
  }

  if (value === "WATCH" || rawDecision === "관찰") {
    return "watch";
  }

  if (value === "WAIT" || value === "WAIT_FOR_PULLBACK" || rawDecision === "대기") {
    return "wait";
  }

  if (value === "RISKY" || rawDecision === "주의") {
    return "risky";
  }

  if (value === "EXCLUDED" || value === "EXCLUDE" || rawDecision === "제외") {
    return "exclude";
  }

  return "watch";
}

function getDecisionLabel(key) {
  if (key === "buy") return "매수 후보";
  if (key === "watch") return "관찰 후보";
  if (key === "wait") return "대기 후보";
  if (key === "risky") return "주의 후보";
  return "제외 후보";
}

function getDecisionClass(key) {
  if (key === "buy") return "decisionChip buy";
  if (key === "watch") return "decisionChip watch";
  if (key === "wait") return "decisionChip wait";
  if (key === "risky") return "decisionChip risky";
  return "decisionChip exclude";
}

function getRiskLevelClass(level) {
  if (level === "주의") return "riskChip high";
  if (level === "보통") return "riskChip mid";
  return "riskChip low";
}

function getSectorTypeLabel(type) {
  if (type === "theme") return "테마/수급형";
  if (type === "speculative") return "고변동형";
  if (type === "cyclical") return "사이클형";
  if (type === "defensive") return "방어형";
  return "일반형";
}

function fallbackFinalPickMeta(stock) {
  return {
    decision: "WATCH",
    finalScore: Number(stock?.totalScore ?? 50),
    sectorType: "normal",
    reasons: [
      "아직 finalPickMeta가 생성되지 않아 기존 랭킹 정보를 임시로 표시합니다.",
      "데이터 업데이트 워크플로우를 실행하면 실전투자 전용 판단값이 반영됩니다.",
    ],
    debug: {
      baseScore: Number(stock?.totalScore ?? 0),
      timingScore: Number(stock?.timingMeta?.score ?? 0),
      sectorStrength: Number(stock?.sectorMeta?.strengthScore ?? 0),
      marketFit: Number(stock?.marketContext?.fitScore ?? 0),
      liquidityScore: Number(stock?.scoreBreakdown?.liquidityScore ?? 0),
      marketState: stock?.marketContext?.marketState || "unknown",
    },
  };
}

function buildFinalPicks(stocksData, risksData) {
  const baseline = sortForBaselineRanking(stocksData);
  const rankMap = new Map(baseline.map((item, index) => [String(item.code), index + 1]));
  const riskMap = buildRiskMap(risksData);

  const evaluated = baseline.map((stock) => {
    const riskItem = riskMap.get(String(stock.code));
    const meta = stock?.finalPickMeta || fallbackFinalPickMeta(stock);
    const decisionKey = normalizeDecision(meta.decision);
    const finalScore = clamp(Number(meta.finalScore ?? stock.totalScore ?? 0), 0, 100);
    const reasons = Array.isArray(meta.reasons) && meta.reasons.length
      ? meta.reasons
      : ["실전투자 판단 사유가 아직 생성되지 않았습니다."];

    return {
      ...stock,
      finalPickMeta: meta,
      decisionKey,
      decisionLabel: getDecisionLabel(decisionKey),
      finalScore: Math.round(finalScore),
      finalReasons: reasons,
      finalDebug: meta.debug || {},
      finalSectorType: meta.sectorType || "normal",
      riskItem,
      riskLevel: riskItem?.level || stock?.riskMeta?.level || "낮음",
      baselineRank: rankMap.get(String(stock.code)) ?? null,
      sectorName: stock?.sector || stock?.industry || "업종 미분류",
    };
  });

  const groupOrder = { buy: 0, watch: 1, wait: 2, risky: 3, exclude: 4 };
  evaluated.sort((a, b) => {
    const groupDiff = groupOrder[a.decisionKey] - groupOrder[b.decisionKey];
    if (groupDiff !== 0) return groupDiff;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return (a.baselineRank || 9999) - (b.baselineRank || 9999);
  });

  return {
    buy: evaluated.filter((item) => item.decisionKey === "buy"),
    watch: evaluated.filter((item) => item.decisionKey === "watch"),
    wait: evaluated.filter((item) => item.decisionKey === "wait"),
    risky: evaluated.filter((item) => item.decisionKey === "risky"),
    exclude: evaluated.filter((item) => item.decisionKey === "exclude"),
  };
}

const DECISION_META = {
  buy: {
    title: "매수 후보",
    shortTitle: "매수",
    desc: "finalPickMeta 기준으로 업종·타이밍·시장 적합도·리스크를 다시 통과한 후보입니다.",
  },
  watch: {
    title: "관찰 후보",
    shortTitle: "관찰",
    desc: "기본 체력은 볼 만하지만 지금 바로 진입하기엔 확인할 조건이 남은 후보입니다.",
  },
  wait: {
    title: "대기 후보",
    shortTitle: "대기",
    desc: "종목 자체는 버릴 정도는 아니지만 가격·타이밍·상승여력 측면에서 기다림이 필요한 후보입니다.",
  },
  risky: {
    title: "주의 후보",
    shortTitle: "주의",
    desc: "테마성, 업종 변동성, 부채, 뉴스 플래그, 타이밍 약화 등으로 실전 매수 후보에서 강하게 보류한 종목입니다.",
  },
  exclude: {
    title: "제외 후보",
    shortTitle: "제외",
    desc: "랭킹에 올라와도 현재 기준에서는 실전 매수 대상으로 보기 어려운 종목입니다.",
  },
};

function MetricCard({ label, value, accent }) {
  return (
    <div className="metricCard">
      <span>{label}</span>
      <strong className={accent ? "accentText" : ""}>{value}</strong>
    </div>
  );
}

function ScorePill({ label, value }) {
  const display = Number.isFinite(Number(value)) ? Math.round(Number(value)) : "-";
  return (
    <div className="scorePill">
      <span>{label}</span>
      <strong>{display}</strong>
    </div>
  );
}

function PickCard({ item }) {
  const debug = item.finalDebug || {};

  return (
    <article className="pickCard">
      <div className="cardTop">
        <div className="titleArea">
          <div className="chipRow">
            <span className="rankTag">기존 랭킹 #{item.baselineRank ?? "-"}</span>
            <span className={getDecisionClass(item.decisionKey)}>{item.decisionLabel}</span>
            <span className={getRiskLevelClass(item.riskLevel)}>리스크 {item.riskLevel}</span>
            <span className="smallBadge soft">{getSectorTypeLabel(item.finalSectorType)}</span>
            {item?.rankMeta?.topRankEligible ? <span className="smallBadge info">랭킹 적격</span> : null}
          </div>
          <h3>{item.name}</h3>
          <p>{item.market} · {item.code} · {item.sectorName}</p>
        </div>

        <div className={`finalScoreBox ${item.decisionKey}`}>
          <span>실전투자 점수</span>
          <strong>{item.finalScore}점</strong>
        </div>
      </div>

      <div className="middlePanel">
        <div className="metricGrid">
          <MetricCard label="현재가" value={formatPrice(item?.metrics?.closePrice)} />
          <MetricCard label="적정가 추정" value={formatPrice(item?.metrics?.targetPrice)} />
          <MetricCard label="상승여력" value={formatPercent(item?.metrics?.upside)} accent />
          <MetricCard label="거래대금" value={formatCompactKrw(item?.metrics?.avgTradeValue5d)} />
          <MetricCard label="PER" value={item?.metrics?.per ? `${Number(item.metrics.per).toFixed(1)}배` : "-"} />
          <MetricCard label="PBR" value={item?.metrics?.pbr ? `${Number(item.metrics.pbr).toFixed(1)}배` : "-"} />
          <MetricCard label="부채비율" value={item?.metrics?.debtRatio ? `${Number(item.metrics.debtRatio).toFixed(1)}%` : "-"} />
          <MetricCard label="5일 등락률" value={formatPercent(item?.metrics?.priceChangeRate)} accent />
        </div>

        <div className="reasonBox dark">
          <span>최종 판단</span>
          <p>
            기존 랭킹 #{item.baselineRank ?? "-"} 후보였지만, finalPickMeta 기준으로 업종 타입·타이밍·시장 적합도·리스크를 다시 계산한 결과
            <b> {item.decisionLabel}</b>로 분류했습니다.
          </p>
        </div>

        <div className="reasonBox">
          <span>판정 이유</span>
          <ul>
            {item.finalReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>

        <div className="scoreDebugGrid">
          <ScorePill label="랭킹" value={debug.baseScore ?? item.totalScore} />
          <ScorePill label="타이밍" value={debug.timingScore ?? item.timingMeta?.score} />
          <ScorePill label="업종" value={debug.sectorStrength ?? item.sectorMeta?.strengthScore} />
          <ScorePill label="시장" value={debug.marketFit ?? item.marketContext?.fitScore} />
          <ScorePill label="유동성" value={debug.liquidityScore} />
        </div>

        <div className="guideBox">
          <span>읽는 법</span>
          <p>
            이 페이지는 랭킹 점수를 다시 계산하는 페이지가 아니라, 랭킹 후보를 실전 매수 관점에서 한 번 더 줄이는 페이지입니다.
            따라서 랭킹 상위 종목도 테마성 업종, 타이밍 약화, 뉴스 플래그, 시장 부적합성이 있으면 주의 또는 제외로 내려갑니다.
          </p>
        </div>

        <div className="cardActions">
          <Link href={`/stock/${item.code}`} className="detailBtn">종목 상세 보기</Link>
          <Link href={`/risk?code=${item.code}`} className="ghostBtn">리스크 확인</Link>
        </div>
      </div>
    </article>
  );
}

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
            <PickCard key={`${item.decisionKey}-${item.code}`} item={item} />
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
  const currentItems = finalPicks[selectedGroup] || [];
  const hasFinalPickMeta = stocks.some((stock) => stock?.finalPickMeta);

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
            랭킹이 1차 후보를 만든다면, 실전투자 페이지는 finalPickMeta를 기준으로 업종 성격, 시장 적합도, 타이밍, 뉴스/리스크 플래그를 다시 반영해 후보를 압축합니다.
          </p>
          {!hasFinalPickMeta ? (
            <div className="dataWarning">
              아직 stocks.json에 finalPickMeta가 없습니다. 먼저 수정된 update_data.py로 데이터 업데이트 워크플로우를 실행해야 새 실전투자 로직이 완전히 반영됩니다.
            </div>
          ) : null}
        </div>

        <div className="heroInfoGrid">
          <div className="heroInfoCard good"><span>매수</span><strong>{finalPicks.buy.length}</strong></div>
          <div className="heroInfoCard watch"><span>관찰</span><strong>{finalPicks.watch.length}</strong></div>
          <div className="heroInfoCard wait"><span>대기</span><strong>{finalPicks.wait.length}</strong></div>
          <div className="heroInfoCard risky"><span>주의</span><strong>{finalPicks.risky.length}</strong></div>
          <div className="heroInfoCard exclude"><span>제외</span><strong>{finalPicks.exclude.length}</strong></div>
        </div>
      </section>

      <section className="switchSection">
        <div className="switchCard">
          <div className="tabRow">
            {Object.entries(DECISION_META).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                className={`tabBtn ${selectedGroup === key ? "active" : ""} ${key}`}
                onClick={() => setSelectedGroup(key)}
              >
                {meta.shortTitle} <span>{finalPicks[key]?.length ?? 0}</span>
              </button>
            ))}
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
          <p className="badge small">LOGIC NOTE</p>
          <h2>왜 랭킹과 실전투자 결과가 다를 수 있나</h2>
          <div className="logicGrid">
            <div><strong>랭킹</strong><span>재무, 밸류, 유동성 중심의 1차 후보 발굴</span></div>
            <div><strong>실전투자</strong><span>finalPickMeta 기준으로 업종, 타이밍, 시장, 뉴스, 리스크를 재평가</span></div>
            <div><strong>테마/엔터/고변동 업종</strong><span>점수와 타이밍이 충분히 높지 않으면 주의 또는 제외로 분류</span></div>
            <div><strong>최종 판단</strong><span>매수 추천이 아니라 실제 검토 우선순위를 나누는 보조 도구</span></div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .container { max-width:1180px; margin:0 auto; padding:32px 24px 80px; color:#0f172a; }
        .topLinks { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:26px; flex-wrap:wrap; }
        .homeBtn { display:inline-flex; align-items:center; justify-content:center; border-radius:14px; padding:12px 16px; text-decoration:none; font-weight:800; border:1px solid #0f172a; background:#0f172a; color:#fff; }
        .badge { display:inline-flex; padding:8px 14px; border-radius:999px; background:#eef2ff; color:#4f46e5; font-size:.82rem; font-weight:800; margin:0 0 18px; }
        .badge.small { margin:0 0 10px; }
        h1 { margin:0 0 12px; font-size:clamp(2rem,4vw,3rem); letter-spacing:-0.04em; word-break:keep-all; }
        .pageHero { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; flex-wrap:wrap; }
        .desc { margin:0; max-width:760px; color:#475569; line-height:1.8; font-size:1.02rem; }
        .dataWarning { margin-top:16px; border:1px solid #fde68a; border-radius:18px; background:#fffbeb; color:#92400e; padding:14px 16px; font-weight:800; line-height:1.65; }
        .heroInfoGrid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; min-width:500px; width:560px; }
        .heroInfoCard { border:1px solid #e5e7eb; border-radius:20px; padding:16px; background:#fff; }
        .heroInfoCard span { display:block; margin-bottom:8px; font-size:.82rem; font-weight:800; }
        .heroInfoCard strong { font-size:1.55rem; }
        .heroInfoCard.good span,.heroInfoCard.good strong { color:#0f766e; }
        .heroInfoCard.watch span,.heroInfoCard.watch strong { color:#b45309; }
        .heroInfoCard.wait span,.heroInfoCard.wait strong { color:#2563eb; }
        .heroInfoCard.risky span,.heroInfoCard.risky strong { color:#ea580c; }
        .heroInfoCard.exclude span,.heroInfoCard.exclude strong { color:#be123c; }
        .switchSection,.pickSection,.logicSection { margin-top:26px; }
        .switchCard,.emptyBox,.logicCard { border:1px solid #e5e7eb; border-radius:28px; padding:24px; background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%); box-shadow:0 20px 50px rgba(15,23,42,.06); }
        .tabRow { display:flex; gap:10px; flex-wrap:wrap; }
        .tabBtn { height:44px; padding:0 18px; border-radius:999px; border:1px solid #dbe3f0; background:#fff; color:#0f172a; font-weight:800; cursor:pointer; }
        .tabBtn span { margin-left:6px; opacity:.72; }
        .tabBtn.active { background:#0f172a; color:#fff; border-color:#0f172a; }
        .switchDesc { margin:14px 0 0; color:#64748b; line-height:1.7; }
        .sectionHeaderRow { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
        .sectionTitle { margin:0 0 8px; font-size:1.8rem; letter-spacing:-0.03em; }
        .sectionDesc { margin:0; color:#64748b; line-height:1.72; }
        .sectionCount { display:inline-flex; align-items:center; justify-content:center; min-width:74px; height:42px; padding:0 14px; border-radius:14px; background:#0f172a; color:#fff; font-weight:800; }
        .pickGrid { display:grid; gap:18px; }
        .pickCard { border:1px solid #e5e7eb; border-radius:28px; padding:24px; background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%); box-shadow:0 20px 50px rgba(15,23,42,.06); }
        .cardTop { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; flex-wrap:wrap; margin-bottom:18px; }
        .titleArea { min-width:0; flex:1 1 560px; }
        .chipRow { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
        .rankTag,.riskChip,.decisionChip,.smallBadge { display:inline-flex; align-items:center; justify-content:center; padding:7px 12px; border-radius:999px; font-size:.8rem; font-weight:800; }
        .rankTag { background:#eef2ff; color:#4f46e5; }
        .riskChip.low { background:#dcfce7; color:#15803d; }
        .riskChip.mid { background:#fef3c7; color:#b45309; }
        .riskChip.high { background:#fee2e2; color:#dc2626; }
        .decisionChip.buy { background:#ccfbf1; color:#0f766e; }
        .decisionChip.watch { background:#fff7ed; color:#b45309; }
        .decisionChip.wait { background:#dbeafe; color:#2563eb; }
        .decisionChip.risky { background:#ffedd5; color:#ea580c; }
        .decisionChip.exclude { background:#ffe4e6; color:#be123c; }
        .smallBadge.info { background:#e0f2fe; color:#0284c7; }
        .smallBadge.soft { background:#f1f5f9; color:#475569; }
        .titleArea h3 { margin:0 0 8px; font-size:1.72rem; letter-spacing:-0.03em; word-break:keep-all; }
        .titleArea p { margin:0; color:#64748b; }
        .finalScoreBox { min-width:160px; border:1px solid #e5e7eb; border-radius:22px; padding:16px; background:#fff; text-align:right; }
        .finalScoreBox span { display:block; margin-bottom:6px; color:#64748b; font-size:.84rem; font-weight:800; }
        .finalScoreBox strong { display:block; font-size:2rem; line-height:1; }
        .finalScoreBox.buy strong { color:#0f766e; }
        .finalScoreBox.watch strong { color:#b45309; }
        .finalScoreBox.wait strong { color:#2563eb; }
        .finalScoreBox.risky strong { color:#ea580c; }
        .finalScoreBox.exclude strong { color:#be123c; }
        .middlePanel { border:1px solid #e5e7eb; border-radius:24px; background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%); padding:20px; box-shadow:0 18px 40px rgba(15,23,42,.06); }
        .metricGrid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:14px; }
        .metricCard { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fff; }
        .metricCard span { display:block; margin-bottom:8px; color:#64748b; font-size:.84rem; font-weight:800; }
        .metricCard strong { display:block; font-size:1.08rem; line-height:1.35; color:#0f172a; }
        .accentText { color:#0ea5e9 !important; }
        .reasonBox { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fff; margin-bottom:12px; }
        .reasonBox.dark { background:#0f172a; color:#fff; border-color:#0f172a; }
        .reasonBox span,.guideBox span { display:block; margin-bottom:8px; font-size:.84rem; font-weight:900; }
        .reasonBox p,.guideBox p { margin:0; color:#475569; line-height:1.78; }
        .reasonBox.dark p { color:#e5e7eb; }
        .reasonBox.dark b { color:#fff; }
        .reasonBox ul { margin:0; padding-left:18px; color:#475569; line-height:1.8; }
        .reasonBox li + li { margin-top:4px; }
        .scoreDebugGrid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-bottom:12px; }
        .scorePill { border:1px solid #e5e7eb; border-radius:16px; padding:12px; background:#fbfdff; }
        .scorePill span { display:block; margin-bottom:6px; color:#64748b; font-size:.78rem; font-weight:800; }
        .scorePill strong { display:block; font-size:1.15rem; }
        .guideBox { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fbfdff; }
        .cardActions { display:flex; gap:12px; flex-wrap:wrap; margin-top:16px; }
        .detailBtn,.ghostBtn { display:inline-flex; align-items:center; justify-content:center; height:46px; padding:0 16px; border-radius:14px; font-weight:800; text-decoration:none; border:1px solid transparent; }
        .detailBtn { background:#0f172a; color:#fff; }
        .ghostBtn { background:#fff; color:#0f172a; border-color:#dbe3f0; }
        .logicCard h2 { margin:0 0 16px; font-size:1.5rem; letter-spacing:-0.03em; }
        .logicGrid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .logicGrid div { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fff; }
        .logicGrid strong { display:block; margin-bottom:8px; }
        .logicGrid span { color:#64748b; line-height:1.7; }
        .emptyBox p { margin:0; color:#64748b; font-weight:800; }
        @media (max-width:980px) {
          .heroInfoGrid,.metricGrid,.scoreDebugGrid,.logicGrid { grid-template-columns:1fr 1fr; width:100%; min-width:0; }
        }
        @media (max-width:760px) {
          .container { padding:24px 18px 64px; }
          .pageHero,.sectionHeaderRow,.topLinks { flex-direction:column; align-items:flex-start; }
          .heroInfoGrid,.metricGrid,.scoreDebugGrid,.logicGrid { grid-template-columns:1fr; }
          .switchCard,.logicCard,.emptyBox,.pickCard,.middlePanel { padding:20px; }
          .finalScoreBox { width:100%; text-align:left; }
          .detailBtn,.ghostBtn { width:100%; }
        }
      `}</style>
    </main>
  );
}
