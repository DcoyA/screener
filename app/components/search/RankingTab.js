"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import WishlistButton from "../WishlistButton";
import { getUnifiedGrade } from "../../lib/grade";
import GradeBadge from "../GradeBadge";
import { getScoreGaugeColor } from "../../lib/scoreGauge";
import { formatUpsideDisplay } from "../../lib/formatUpside";
import { getFairValueStatus, fairValueStatusLabel } from "../../lib/fairValue";
import { formatRatio } from "../../lib/formatNumber";
import { percentileLabel, scoreColor } from "../../lib/scoreStats";
import { buildOneLineReason, buildWarningLine } from "../../lib/screenerReason";
import { cleanStockName } from "../../lib/stockName";

const PAGE_SIZE = 30;
// 종합 점수(0~100 스케일)로 해석 가능한 보기에서만 게이지 색상 규칙(70/40)을 적용한다.
// undervalue(가치 점수)와 upside(상승여력 %)는 스케일이 달라 같은 규칙을 적용하면 오해를 부른다.
const SCORE_GAUGE_VIEWS = new Set(["total", "short", "annual", "long"]);

const FILTER_GROUPS = [
  { key: "basic", label: "기본 랭킹" },
  { key: "strategy", label: "전략별 보기" },
  { key: "risk", label: "피해야 할 타입 필터" },
];

const VIEW_CONFIG = {
  total: { label: "종합", title: "종합 랭킹", desc: "기본 조건 통과 여부와 총점을 함께 반영한 기본 랭킹입니다." },
  undervalue: { label: "저평가", title: "저평가 랭킹", desc: "가치 점수 중심으로 보되, 부채비율이 낮은 순서를 우선 반영합니다." },
  upside: { label: "상승여력", title: "상승여력 랭킹", desc: "적정가 추정 대비 괴리가 큰 종목을 우선 보여주는 관점입니다." },
  short: { label: "단기 투자", title: "단기 투자에 좋은 후보", desc: "최근 흐름, 거래대금, 상승여력을 같이 봐서 지금 당장 반응 가능한 쪽을 우선 정렬합니다." },
  annual: { label: "연간 투자", title: "연간 투자에 좋은 후보", desc: "종합 점수, 실적 안정성, 성장 흐름을 묶어서 올해 안에 다시 볼 만한 순서로 정렬합니다." },
  long: { label: "장기 투자", title: "장기 투자에 좋은 후보", desc: "저평가와 재무 안정성 중심으로, 당장보다 구조를 보고 들고 갈 만한 종목을 보여줍니다." },
};

const RISK_CONFIG = {
  all: { label: "전체", title: "전체 종목", desc: "추가 위험 필터 없이 현재 보기 기준 전체를 보여줍니다." },
  highDebt: { label: "고부채", title: "고부채 타입", desc: "부채비율이 높아 저평가처럼 보여도 재무 리스크를 먼저 확인해야 하는 종목입니다." },
  lowLiquidity: { label: "저유동성", title: "저유동성 타입", desc: "점수는 나쁘지 않아도 실제 거래가 약해 체결/수급 측면에서 보수적으로 봐야 하는 종목입니다." },
  unstableEarnings: { label: "이익 불안정", title: "이익 불안정 타입", desc: "영업이익 또는 순이익 흐름이 약해, 실적 지속성을 먼저 확인해야 하는 종목입니다." },
};

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}
// 적정가 밴드 표시값(fair-value v2): 보수~낙관 범위, 둘 다 없으면 단일값.
function formatTargetPriceBand(stock) {
  const lo = Number(stock?.metrics?.targetPriceConservative);
  const hi = Number(stock?.metrics?.targetPriceOptimistic);
  if (Number.isFinite(lo) && Number.isFinite(hi) && lo > 0 && hi > 0) {
    if (lo === hi) return formatPrice(lo);
    return `${formatPrice(lo)}~${formatPrice(hi)}`;
  }
  return formatPrice(stock?.metrics?.targetPrice);
}
function debtRatioForUndervalue(item) {
  const explicit = Number(item?.undervalueMeta?.sortDebtRatio);
  if (Number.isFinite(explicit)) return explicit;
  const fallback = Number(item?.metrics?.debtRatio);
  return Number.isFinite(fallback) ? fallback : 999999;
}
function isHighDebt(item) {
  return Number(item?.metrics?.debtRatio ?? 0) >= 200;
}
function isLowLiquidity(item) {
  return Number(item?.metrics?.avgTradeValue5d ?? 0) < 10_0000_0000;
}
function isUnstableEarnings(item) {
  return Number(item?.metrics?.operatingIncome ?? 0) <= 0 || Number(item?.metrics?.netIncome ?? 0) <= 0;
}

function sortTotal(items) {
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
function sortUndervalue(items) {
  return [...items]
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
function sortUpside(items) {
  return [...items].sort((a, b) => {
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
function sortShort(items) {
  return [...items].sort((a, b) => {
    const aMomentum = Number(a?.metrics?.priceChangeRate ?? a?.metrics?.momentum ?? 0);
    const bMomentum = Number(b?.metrics?.priceChangeRate ?? b?.metrics?.momentum ?? 0);
    if (bMomentum !== aMomentum) return bMomentum - aMomentum;
    const aUp = Number(a?.metrics?.upside ?? -999999);
    const bUp = Number(b?.metrics?.upside ?? -999999);
    if (bUp !== aUp) return bUp - aUp;
    const aLiquidity = Number(a?.metrics?.avgTradeValue5d ?? 0);
    const bLiquidity = Number(b?.metrics?.avgTradeValue5d ?? 0);
    if (bLiquidity !== aLiquidity) return bLiquidity - aLiquidity;
    return Number(b?.totalScore ?? 0) - Number(a?.totalScore ?? 0);
  });
}
function sortAnnual(items) {
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
    if (bLiquidity !== aLiquidity) return bLiquidity - aLiquidity;
    return Number(b?.metrics?.marketCap ?? 0) - Number(a?.metrics?.marketCap ?? 0);
  });
}
function sortLong(items) {
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
      if (bRoe !== aRoe) return bRoe - aRoe;
      return Number(b?.metrics?.marketCap ?? 0) - Number(a?.metrics?.marketCap ?? 0);
    });
}

function buildSortedStocks(items, view) {
  if (view === "upside") return sortUpside(items);
  if (view === "undervalue") return sortUndervalue(items);
  if (view === "short") return sortShort(items);
  if (view === "annual") return sortAnnual(items);
  if (view === "long") return sortLong(items);
  return sortTotal(items);
}
function applyRiskFilter(items, risk) {
  if (risk === "highDebt") return items.filter(isHighDebt);
  if (risk === "lowLiquidity") return items.filter(isLowLiquidity);
  if (risk === "unstableEarnings") return items.filter(isUnstableEarnings);
  return items;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function computeShortSuitability(stock) {
  const momentum = Number(stock?.metrics?.priceChangeRate ?? stock?.metrics?.momentum ?? 0);
  const upside = Number(stock?.metrics?.upside ?? 0);
  const liquidity = Number(stock?.metrics?.avgTradeValue5d ?? 0);
  const momentumScore = clamp(((momentum + 10) / 40) * 40, 0, 40);
  const upsideScore = clamp(((upside + 30) / 80) * 25, 0, 25);
  const liquidityScore = clamp((liquidity / 300_0000_0000) * 35, 0, 35);
  return Math.round(momentumScore + upsideScore + liquidityScore);
}
function computeAnnualSuitability(stock) {
  return clamp(Math.round(Number(stock?.finalPickMeta?.finalScore ?? 0)), 0, 100);
}
function computeLongSuitability(stock) {
  const valueScore = Number(stock?.valueScore ?? 0);
  const debtRatio = Number(stock?.metrics?.debtRatio ?? 999999);
  const roe = Number(stock?.metrics?.roe ?? 0);
  const valuePart = clamp((valueScore / 30) * 45, 0, 45);
  const debtPart = clamp(((200 - debtRatio) / 200) * 25, 0, 25);
  const roePart = clamp((roe / 20) * 30, 0, 30);
  return Math.round(valuePart + debtPart + roePart);
}
function getGaugeScoreValue(stock, activeView) {
  if (activeView === "short") return computeShortSuitability(stock);
  if (activeView === "annual") return computeAnnualSuitability(stock);
  if (activeView === "long") return computeLongSuitability(stock);
  return Math.round(Number(stock?.finalPickMeta?.finalScore ?? 0));
}
function getScorePresentation(stock, activeView) {
  if (activeView === "short") {
    return { label: "단기 적합도", valueText: `${computeShortSuitability(stock)} / 100`, tooltip: "예상 수익률이 아니라 최근 흐름·유동성·상승여력 조합을 반영한 단기 관점 적합도 점수입니다." };
  }
  if (activeView === "annual") {
    return { label: "연간 적합도", valueText: `${computeAnnualSuitability(stock)} / 100`, tooltip: "예상 수익률이 아니라 종합 점수·실적 안정성·성장 흐름을 반영한 연간 관점 적합도 점수입니다." };
  }
  if (activeView === "long") {
    return { label: "장기 적합도", valueText: `${computeLongSuitability(stock)} / 100`, tooltip: "예상 수익률이 아니라 가치 점수·재무 안정성·ROE를 반영한 장기 관점 적합도 점수입니다." };
  }
  if (activeView === "undervalue") {
    return { label: "가치 점수", valueText: `${Math.round(Number(stock?.valueScore ?? 0))}점`, tooltip: "가치 점수는 저평가 관점에서의 내부 점수이며 예상 수익률을 의미하지 않습니다." };
  }
  if (activeView === "upside") {
    const fvStatus = getFairValueStatus(stock);
    return {
      label: "상승여력",
      valueText: fvStatus === "ok" ? formatUpsideDisplay(stock) : fairValueStatusLabel(fvStatus),
      tooltip: "상승여력은 적정가 추정 대비 괴리 참고치이며 실제 단기 수익률을 보장하지 않습니다. 캡을 초과하는 값은 숫자 대신 구조적 할인/할증 라벨로 표시됩니다.",
    };
  }
  // 종합판단점수 = finalPickMeta.finalScore (등급 산출·슬롯 선정을 구동하는 값과
  // 동일). 스크리너/상세가 서로 다른 숫자를 보여주던 문제를 없앤다.
  // 값 텍스트/색은 app/lib/scoreStats.js(전 종목 백분위) 단일 창구를 거친다.
  const finalScore = Number(stock?.finalPickMeta?.finalScore);
  return {
    label: "종합판단점수",
    valueText: Number.isFinite(finalScore) ? `${Math.round(finalScore)}점` : "-",
    subText: percentileLabel(finalScore),
    color: scoreColor(finalScore),
    tooltip: "종합판단점수는 안정성·가치·시장성·타이밍을 함께 반영한 내부 판단 점수입니다. 옆의 '상위 N%'는 전 종목 대비 위치입니다.",
  };
}

// TASK 5(디자인·IA 개편): view/risk 초기값은 상위(ScreenerPageClient)가
// 서버에서 읽은 searchParams를 그대로 props로 내려준 것을 쓴다.
// useSearchParams()를 여기서 직접 부르면 이 컴포넌트가 통째로 Suspense
// fallback으로 빠져서 랭킹 목록(문서 TASK 5의 SSR 대상)이 서버 응답에
// 안 담긴다.
export default function RankingTab({ stocks, initialView: rawInitialView, initialRisk: rawInitialRisk }) {
  const router = useRouter();
  const pathname = usePathname();

  const initialView = VIEW_CONFIG[rawInitialView] ? rawInitialView : "total";
  const initialRisk = RISK_CONFIG[rawInitialRisk] ? rawInitialRisk : "all";

  const [activeView, setActiveView] = useState(initialView);
  const [activeRisk, setActiveRisk] = useState(initialRisk);
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const updateRoute = (nextView, nextRisk) => {
    const params = new URLSearchParams();
    params.set("tab", "ranking");
    if (nextView && nextView !== "total") params.set("view", nextView);
    if (nextRisk && nextRisk !== "all") params.set("risk", nextRisk);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleViewChange = (nextView) => {
    setActiveView(nextView);
    updateRoute(nextView, activeRisk);
  };
  const handleRiskChange = (nextRisk) => {
    setActiveRisk(nextRisk);
    updateRoute(activeView, nextRisk);
  };
  const handleQuickCardClick = (kind) => {
    if (kind === "total") { setActiveView("total"); setActiveRisk("all"); updateRoute("total", "all"); return; }
    if (kind === "undervalue") { setActiveView("undervalue"); setActiveRisk("all"); updateRoute("undervalue", "all"); return; }
    if (kind === "highDebt") { setActiveRisk("highDebt"); updateRoute(activeView, "highDebt"); return; }
    if (kind === "unstableEarnings") { setActiveRisk("unstableEarnings"); updateRoute(activeView, "unstableEarnings"); }
  };

  const sortedStocks = useMemo(() => buildSortedStocks(stocks, activeView), [activeView]);
  const filteredByRisk = useMemo(() => applyRiskFilter(sortedStocks, activeRisk), [sortedStocks, activeRisk]);
  const rankMap = useMemo(() => new Map(filteredByRisk.map((item, index) => [String(item.code), index + 1])), [filteredByRisk]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredByRisk;
    return filteredByRisk.filter((item) =>
      String(item.name || "").toLowerCase().includes(q) || String(item.code || "").toLowerCase().includes(q)
    );
  }, [filteredByRisk, query]);

  // 필터/검색이 바뀌면 처음부터 PAGE_SIZE개만 다시 보여준다("더보기" 진행분 초기화).
  // 무한스크롤(IntersectionObserver)은 스크롤 중 예상치 못한 시점에 카드가 붙어
  // 사용자가 위치를 놓치기 쉽다는 피드백으로 제거하고, 명시적 클릭인 "더보기" 버튼만 남겼다.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeView, activeRisk, query]);

  const visibleStocks = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const topEligibleCount = useMemo(() => stocks.filter((item) => item?.rankMeta?.topRankEligible).length, []);
  const undervalueEligibleCount = useMemo(() => stocks.filter((item) => item?.undervalueMeta?.eligible).length, []);
  const highDebtCount = useMemo(() => stocks.filter(isHighDebt).length, []);
  const lowLiquidityCount = useMemo(() => stocks.filter(isLowLiquidity).length, []);
  const unstableEarningsCount = useMemo(() => stocks.filter(isUnstableEarnings).length, []);

  const activeViewMeta = VIEW_CONFIG[activeView] || VIEW_CONFIG.total;
  const activeRiskMeta = RISK_CONFIG[activeRisk] || RISK_CONFIG.all;

  return (
    <>
      <section className="rtHero rubySurface">
        <h2>{activeViewMeta.title}</h2>
        <p className="rtDesc">
          {activeViewMeta.desc}<br />
          {activeRisk !== "all" ? `현재는 "${activeRiskMeta.title}" 필터가 적용된 리스트를 보고 있습니다.` : "아래 퀵 선택 또는 필터 바에서 바로 원하는 보기로 이동할 수 있습니다."}
        </p>
        <div className="quickStatGrid">
          <button type="button" className={`quickStatCard ${activeView === "total" && activeRisk === "all" ? "active" : ""}`} onClick={() => handleQuickCardClick("total")}>
            <span className="quickLabel">종합 우선 후보</span>
            <strong>{topEligibleCount}종목</strong>
          </button>
          <button type="button" className={`quickStatCard ${activeView === "undervalue" && activeRisk === "all" ? "active" : ""}`} onClick={() => handleQuickCardClick("undervalue")}>
            <span className="quickLabel">저평가 후보</span>
            <strong>{undervalueEligibleCount}종목</strong>
          </button>
          <button type="button" className={`quickStatCard warn ${activeRisk === "highDebt" ? "active" : ""}`} onClick={() => handleQuickCardClick("highDebt")}>
            <span className="quickLabel">고부채</span>
            <strong>{highDebtCount}종목</strong>
          </button>
          <button type="button" className={`quickStatCard warn ${activeRisk === "unstableEarnings" ? "active" : ""}`} onClick={() => handleQuickCardClick("unstableEarnings")}>
            <span className="quickLabel">이익 불안정</span>
            <strong>{unstableEarningsCount}종목</strong>
          </button>
        </div>
      </section>

      <section className="searchSection">
        <div className="metaCard light fullSearchCard">
          <span className="metaLabel">검색</span>
          <input className="searchInput" placeholder="종목명 / 종목코드" value={query} onChange={(e) => setQuery(e.target.value)} />
          <p className="searchGuide">현재 보기 결과 {filtered.length}개 / 저유동성 종목 {lowLiquidityCount}개</p>
        </div>
      </section>

      <section className="guideSection">
        <div className="guideCard compact">
          <div className="guideHeader"><h3>보기 전환</h3></div>

          <div className="groupChipRow">
            {FILTER_GROUPS.map((group) => (
              <button
                key={group.key}
                type="button"
                className={`groupChip ${openGroup === group.key ? "open" : ""}`}
                onClick={() => setOpenGroup(openGroup === group.key ? null : group.key)}
                aria-expanded={openGroup === group.key}
              >
                {group.label}
                <span className="groupCaret">{openGroup === group.key ? "▲" : "▼"}</span>
              </button>
            ))}
          </div>

          {openGroup === "basic" && (
            <div className="accordionPanel">
              <div className="chipRow">
                {[["total", "종합"], ["undervalue", "저평가"], ["upside", "상승여력"]].map(([key, label]) => (
                  <button key={key} type="button" className={`filterChip ${activeView === key ? "active" : ""}`} onClick={() => handleViewChange(key)}>{label}</button>
                ))}
              </div>
            </div>
          )}
          {openGroup === "strategy" && (
            <div className="accordionPanel">
              <div className="chipRow">
                {[["short", "단기 투자"], ["annual", "연간 투자"], ["long", "장기 투자"]].map(([key, label]) => (
                  <button key={key} type="button" className={`filterChip alt ${activeView === key ? "active" : ""}`} onClick={() => handleViewChange(key)}>{label}</button>
                ))}
              </div>
            </div>
          )}
          {openGroup === "risk" && (
            <div className="accordionPanel">
              <div className="chipRow">
                {[["all", "전체"], ["highDebt", "고부채"], ["lowLiquidity", "저유동성"], ["unstableEarnings", "이익 불안정"]].map(([key, label]) => (
                  <button key={key} type="button" className={`filterChip risk ${activeRisk === key ? "active" : ""}`} onClick={() => handleRiskChange(key)}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="statusSection">
        <div className="statusCard">
          <div><strong>현재 보기</strong><p>{activeViewMeta.title} · {activeRiskMeta.title}</p></div>
          <span>{visibleStocks.length} / {filtered.length}개 노출</span>
        </div>
      </section>

      <section className="listSection">
        <div className="listGrid">
          {visibleStocks.map((stock) => {
            const eligible = !!stock?.rankMeta?.topRankEligible;
            const rankFlags = stock?.rankMeta?.flags || [];
            const undervalueFlags = stock?.undervalueMeta?.flags || [];
            const penalty = Number(stock?.rankMeta?.penalty || 0);
            const displayRank = rankMap.get(String(stock.code)) ?? "-";
            const scorePresentation = getScorePresentation(stock, activeView);
            const fvStatus = getFairValueStatus(stock);
            const fvOk = fvStatus === "ok";
            const unifiedGrade = getUnifiedGrade(stock);
            // total 보기는 scoreStats의 백분위 색(scorePresentation.color)을 쓴다.
            // short/annual/long은 0~100 적합도라 기존 게이지 색(70/40) 유지.
            const gaugeColor =
              scorePresentation.color ??
              (SCORE_GAUGE_VIEWS.has(activeView) ? getScoreGaugeColor(getGaugeScoreValue(stock, activeView)) : null);

            return (
              <article className="stockCard" key={`${stock.code}-${activeView}-${activeRisk}`}>
                <div className="cardTop">
                  <div className="rankWrap">
                    <span className="rankBadge">#{displayRank}</span>
                    <div>
                      <h3>{cleanStockName(stock.name)}</h3>
                      <p className="stockMeta">{stock.market} · {stock.code}</p>
                      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <GradeBadge grade={unifiedGrade} size="sm" />
                        <WishlistButton code={stock.code} name={stock.name} size="sm" />
                      </div>
                    </div>
                  </div>
                  <div className="scoreWrap">
                    <div className="scoreLabelRow">
                      <span className="scoreLabel">{scorePresentation.label}</span>
                      <span className="tooltipTrigger" tabIndex={0} aria-label={scorePresentation.tooltip}>i
                        <span className="tooltipBubble">{scorePresentation.tooltip}</span>
                      </span>
                    </div>
                    <strong style={gaugeColor ? { color: gaugeColor } : undefined}>{scorePresentation.valueText}</strong>
                    {scorePresentation.subText ? (
                      <span className="scoreSub">{scorePresentation.subText}</span>
                    ) : null}
                  </div>
                </div>

                <div className="metricRow">
                  <div className="metricBox"><span>현재가</span><strong>{formatPrice(stock?.metrics?.closePrice)}</strong></div>
                  <div className="metricBox">
                    <span>적정가 추정</span>
                    <strong>{fvOk ? formatTargetPriceBand(stock) : fairValueStatusLabel(fvStatus)}</strong>
                    {fvOk && stock?.holdingDiscount && stock?.metrics?.targetPrice ? (
                      <small style={{ display: "block", marginTop: 2, color: "#94a3b8", fontSize: ".68rem", fontWeight: 700 }}>지주사 할인 30% 반영</small>
                    ) : null}
                  </div>
                  <div className="metricBox"><span>상승여력</span><strong className="sky">{fvOk ? formatUpsideDisplay(stock) : "산출 보류"}</strong></div>
                  <div className="metricBox"><span>부채비율</span><strong>{formatRatio(stock?.metrics?.debtRatio)}</strong></div>
                </div>

                <div className="badgeRow">
                  {(activeView === "total" || activeView === "annual") ? (
                    eligible ? <span className="smallBadge good">종합 상위 후보</span> : <span className="smallBadge warn">종합 상위 제외</span>
                  ) : null}
                  {(activeView === "undervalue" || activeView === "long") && stock?.undervalueMeta?.eligible ? <span className="smallBadge info">저평가 후보</span> : null}
                  {activeRisk === "highDebt" ? <span className="smallBadge warn">고부채</span> : null}
                  {activeRisk === "lowLiquidity" ? <span className="smallBadge muted">저유동성</span> : null}
                  {activeRisk === "unstableEarnings" ? <span className="smallBadge soft">이익 불안정</span> : null}
                  {(activeView === "total" || activeView === "annual") && penalty > 0 ? <span className="smallBadge muted">패널티 {penalty}</span> : null}
                  {(activeView === "total" || activeView === "annual" || activeView === "short") && rankFlags.map((flag) => (
                    <span className="smallBadge soft" key={flag}>{flag}</span>
                  ))}
                  {(activeView === "undervalue" || activeView === "long") && undervalueFlags.map((flag) => (
                    <span className="smallBadge soft" key={flag}>{flag}</span>
                  ))}
                </div>

                <div className="reasonCard goodCard">
                  <span className="reasonLabel">왜 이 리스트에 있나</span>
                  <p>{buildOneLineReason(stock, activeView)}</p>
                </div>
                <div className="reasonCard warnCard">
                  <span className="reasonLabel">무엇을 조심해야 하나</span>
                  <p>{buildWarningLine(stock, activeView, activeRisk)}</p>
                </div>

                <p className="summary">{stock.summary}</p>

                <div className="linkRow">
                  <Link href={`/screener?tab=risk&code=${stock.code}#risk-${stock.code}`} className="riskBtn">리스크 보기</Link>
                  <Link href={`/stock/${stock.code}`} className="detailBtn">상세 보기</Link>
                </div>
              </article>
            );
          })}
        </div>

        {hasMore && (
          <div className="loadMoreRow">
            <button type="button" className="loadMoreBtn" onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length))}>
              더보기 ({visibleStocks.length}/{filtered.length})
            </button>
          </div>
        )}
      </section>

      <style jsx>{`
        /* CLEO 스타일 - 진한 인디고 '면'으로 채운 히어로 패널. 예전엔 좌우 2단
           flex(space-between)라 좁은 화면에서 가운데에 불필요한 빈 공간이 컸다. */
        /* 배경(펄 레이어)은 전역 .rubySurface가 담당한다. */
        .rtHero { border-radius: var(--radius-card); padding: 28px; margin-bottom: 20px; }
        .rtHero h2 { margin: 0 0 10px; font-size: clamp(1.5rem, 3vw, 2rem); letter-spacing: -0.03em; color: #fff; }
        .rtDesc { margin: 0 0 22px; max-width: 700px; color: rgba(255,255,255,0.72); line-height: 1.8; font-size: 0.98rem; }
        .searchSection { margin-bottom: 22px; }
        .quickStatGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .quickStatCard { border: 1px solid rgba(255,255,255,0.14); border-radius: var(--radius-tile); padding: 16px; background: rgba(255,255,255,0.06); text-align: left; cursor: pointer; transition: all .18s ease; }
        .quickStatCard:hover { background: rgba(255,255,255,0.12); }
        /* 액센트(오렌지)는 화면당 1개의 핵심 CTA 전용이라, 필터 선택 상태에는 쓰지 않고
           밝은 흰색 배경으로 "선택됨"을 표시한다. */
        .quickStatCard.active { border-color: #fff; background: #fff; }
        .quickStatCard.active .quickLabel { color: #64748b; }
        .quickStatCard.active strong { color: var(--color-primary-dark); }
        .quickLabel { display: block; margin-bottom: 10px; color: rgba(255,255,255,0.65); font-size: .82rem; font-weight: 700; }
        .quickStatCard strong { color: #fff; }
        .quickStatCard strong { font-size: 1.8rem; letter-spacing: -0.04em; }
        .metaCard { border: 1px solid #e5e7eb; border-radius: 20px; padding: 18px; background: #fff; box-shadow: 0 14px 34px rgba(15,23,42,.05); }
        .metaCard.light { background: #f8fbff; }
        .metaLabel { display: block; margin-bottom: 8px; color: #64748b; font-size: .88rem; font-weight: 700; }
        .searchInput { width: 100%; height: 44px; border-radius: 12px; border: 1px solid #dbe3f0; padding: 0 14px; font-size: .95rem; box-sizing: border-box; }
        .searchGuide { margin: 10px 0 0; color: #64748b; font-size: .9rem; }
        .guideSection, .statusSection, .listSection { margin-top: 22px; }
        .guideCard, .statusCard { border: 1px solid #e5e7eb; border-radius: 28px; padding: 24px; background: linear-gradient(180deg, #fff 0%, #f8fbff 100%); box-shadow: 0 20px 50px rgba(15,23,42,.06); }
        .guideCard.compact { padding: 22px; }
        .guideHeader h3 { margin: 0 0 16px; font-size: 1.25rem; }
        .groupChipRow { display: flex; gap: 8px; flex-wrap: wrap; }
        .groupChip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--color-primary); background: #fff; color: var(--color-primary); border-radius: var(--radius-button); padding: 10px 16px; font-weight: 800; font-size: .9rem; cursor: pointer; }
        .groupChip.open { background: var(--color-primary); color: #fff; }
        .groupCaret { font-size: .7rem; }
        .accordionPanel { margin-top: 14px; padding-top: 14px; border-top: 1px solid #eef2f7; }
        .chipRow { display: flex; gap: 8px; flex-wrap: wrap; }
        .filterChip { border: 1px solid #dbe3f0; background: #fff; border-radius: 999px; padding: 10px 16px; font-weight: 700; font-size: .88rem; cursor: pointer; color: #475569; }
        .filterChip.active { background: #0f172a; border-color: #0f172a; color: #fff; }
        .filterChip.risk.active { background: #dc2626; border-color: #dc2626; }
        .statusCard { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 20px 24px; }
        .statusCard strong { display: block; margin-bottom: 4px; }
        .statusCard p { margin: 0; color: #64748b; }
        .listGrid { display: grid; gap: 16px; }
        .stockCard { border: 1px solid #e5e7eb; border-radius: 28px; padding: 24px; background: #fff; box-shadow: 0 20px 50px rgba(15,23,42,.05); }
        .cardTop { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .rankWrap { display: flex; gap: 12px; align-items: flex-start; }
        .rankBadge { display: inline-flex; align-items: center; justify-content: center; min-width: 42px; height: 42px; border-radius: 14px; background: #eef2ff; color: #4f46e5; font-weight: 900; flex-shrink: 0; }
        .rankWrap h3 { margin: 0 0 4px; font-size: 1.3rem; letter-spacing: -0.03em; }
        .stockMeta { margin: 0; color: #64748b; font-size: .88rem; font-weight: 700; }
        .scoreWrap { text-align: right; }
        .scoreLabelRow { display: flex; align-items: center; gap: 6px; justify-content: flex-end; margin-bottom: 6px; }
        .scoreLabel { color: #64748b; font-size: .82rem; font-weight: 700; }
        .tooltipTrigger { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #e5e7eb; font-size: .68rem; cursor: help; }
        .tooltipBubble { position: absolute; right: 0; top: 22px; width: 220px; background: #0f172a; color: #fff; padding: 10px 12px; border-radius: 10px; font-size: .78rem; line-height: 1.5; display: none; z-index: 10; text-align: left; }
        .tooltipTrigger:hover .tooltipBubble, .tooltipTrigger:focus .tooltipBubble { display: block; }
        .scoreWrap strong { font-size: 1.5rem; letter-spacing: -0.03em; }
        .scoreSub { display: block; color: #94a3b8; font-size: .74rem; font-weight: 700; margin-top: 3px; white-space: nowrap; }
        .metricRow { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 16px; }
        .metricBox { border: 1px solid #eef2f7; border-radius: 14px; padding: 12px; background: #fbfdff; }
        .metricBox span { display: block; color: #94a3b8; font-size: .76rem; margin-bottom: 4px; }
        .metricBox strong { font-size: .98rem; }
        .metricBox strong.sky { color: #0ea5e9; }
        .badgeRow { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
        .smallBadge { display: inline-flex; padding: 6px 12px; border-radius: 999px; font-size: .78rem; font-weight: 800; }
        .smallBadge.good { background: #dcfce7; color: #15803d; }
        .smallBadge.warn { background: #fee2e2; color: #dc2626; }
        .smallBadge.info { background: #dbeafe; color: #2563eb; }
        .smallBadge.muted { background: #f1f5f9; color: #64748b; }
        .smallBadge.soft { background: #fef3c7; color: #b45309; }
        .reasonCard { border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; margin-bottom: 10px; }
        .reasonCard.goodCard { background: #f8fbff; }
        .reasonCard.warnCard { background: #fffdfa; }
        .reasonLabel { display: block; margin-bottom: 6px; font-size: .8rem; font-weight: 800; }
        .reasonCard p { margin: 0; color: #475569; line-height: 1.7; }
        .summary { margin: 0 0 16px; color: #64748b; line-height: 1.7; font-size: .92rem; }
        .linkRow { display: flex; gap: 10px; flex-wrap: wrap; }
        .riskBtn, .detailBtn { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-pill); padding: 10px 18px; font-weight: 800; text-decoration: none; font-size: .88rem; }
        .riskBtn { background: #fff; border: 1px solid var(--color-primary); color: var(--color-primary); }
        .detailBtn { background: var(--color-primary); color: #fff; }
        .loadMoreRow { display: flex; justify-content: center; margin-top: 20px; }
        .loadMoreBtn { border: 1px solid var(--color-primary); background: #fff; color: var(--color-primary); border-radius: var(--radius-pill); padding: 12px 26px; font-weight: 800; cursor: pointer; }
        @media (max-width: 900px) {
          .quickStatGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .metricRow { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
      `}</style>
    </>
  );
}
