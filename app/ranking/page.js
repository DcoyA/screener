"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import stocks from "../data/stocks.json";
const scorePresentation = getScorePresentation(stock, activeView);
const unifiedGrade = getUnifiedGrade(stock);
import MainNav from "../components/MainNav";
import WishlistButton from "../components/WishlistButton";

const VIEW_CONFIG = {
  total: {
    label: "종합",
    title: "종합 랭킹",
    desc: "기본 조건 통과 여부와 총점을 함께 반영한 기본 랭킹입니다.",
  },
  undervalue: {
    label: "저평가",
    title: "저평가 랭킹",
    desc: "가치 점수 중심으로 보되, 부채비율이 낮은 순서를 우선 반영합니다.",
  },
  upside: {
    label: "상승여력",
    title: "상승여력 랭킹",
    desc: "적정가 추정 대비 괴리가 큰 종목을 우선 보여주는 관점입니다.",
  },
  short: {
    label: "단기 투자",
    title: "단기 투자에 좋은 후보",
    desc: "최근 흐름, 거래대금, 상승여력을 같이 봐서 지금 당장 반응 가능한 쪽을 우선 정렬합니다.",
  },
  annual: {
    label: "연간 투자",
    title: "연간 투자에 좋은 후보",
    desc: "종합 점수, 실적 안정성, 성장 흐름을 묶어서 올해 안에 다시 볼 만한 순서로 정렬합니다.",
  },
  long: {
    label: "장기 투자",
    title: "장기 투자에 좋은 후보",
    desc: "저평가와 재무 안정성 중심으로, 당장보다 구조를 보고 들고 갈 만한 종목을 보여줍니다.",
  },
};

const RISK_CONFIG = {
  all: {
    label: "전체",
    title: "전체 종목",
    desc: "추가 위험 필터 없이 현재 보기 기준 전체를 보여줍니다.",
  },
  highDebt: {
    label: "고부채",
    title: "고부채 타입",
    desc: "부채비율이 높아 저평가처럼 보여도 재무 리스크를 먼저 확인해야 하는 종목입니다.",
  },
  lowLiquidity: {
    label: "저유동성",
    title: "저유동성 타입",
    desc: "점수는 나쁘지 않아도 실제 거래가 약해 체결/수급 측면에서 보수적으로 봐야 하는 종목입니다.",
  },
  unstableEarnings: {
    label: "이익 불안정",
    title: "이익 불안정 타입",
    desc: "영업이익 또는 순이익 흐름이 약해, 실적 지속성을 먼저 확인해야 하는 종목입니다.",
  },
};

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

function formatKrwCompact(value) {
  const num = Number(value || 0);
  if (!num) return "-";
  if (num >= 1_0000_0000_0000) return `${(num / 1_0000_0000_0000).toFixed(1)}조원`;
  if (num >= 1_0000_0000) return `${(num / 1_0000_0000).toFixed(0)}억원`;
  return `${num.toLocaleString("ko-KR")}원`;
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
  return clamp(Math.round(Number(stock?.totalScore ?? 0)), 0, 100);
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

function getScorePresentation(stock, activeView) {
  if (activeView === "short") {
    return {
      label: "단기 적합도",
      valueText: `${computeShortSuitability(stock)} / 100`,
      tooltip: "예상 수익률이 아니라 최근 흐름·유동성·상승여력 조합을 반영한 단기 관점 적합도 점수입니다.",
    };
  }

  if (activeView === "annual") {
    return {
      label: "연간 적합도",
      valueText: `${computeAnnualSuitability(stock)} / 100`,
      tooltip: "예상 수익률이 아니라 종합 점수·실적 안정성·성장 흐름을 반영한 연간 관점 적합도 점수입니다.",
    };
  }

  if (activeView === "long") {
    return {
      label: "장기 적합도",
      valueText: `${computeLongSuitability(stock)} / 100`,
      tooltip: "예상 수익률이 아니라 가치 점수·재무 안정성·ROE를 반영한 장기 관점 적합도 점수입니다.",
    };
  }

  if (activeView === "undervalue") {
    return {
      label: "가치 점수",
      valueText: `${Math.round(Number(stock?.valueScore ?? 0))}점`,
      tooltip: "가치 점수는 저평가 관점에서의 내부 점수이며 예상 수익률을 의미하지 않습니다.",
    };
  }

  if (activeView === "upside") {
    return {
      label: "상승여력",
      valueText: formatPercent(stock?.metrics?.upside),
      tooltip: "상승여력은 적정가 추정 대비 괴리 참고치이며 실제 단기 수익률을 보장하지 않습니다.",
    };
  }

  return {
    label: "종합 점수",
    valueText: `${Math.round(Number(stock?.totalScore ?? 0))}점`,
    tooltip: "종합 점수는 안정성·가치·시장성 등을 함께 반영한 내부 점수이며 예상 수익률을 의미하지 않습니다.",
  };
}

function buildOneLineReason(stock, activeView) {
  const parts = [];
  const valueScore = Number(stock?.valueScore ?? 0);
  const totalScore = Number(stock?.totalScore ?? 0);
  const upside = Number(stock?.metrics?.upside);
  const debtRatio = Number(stock?.metrics?.debtRatio);
  const rankPenalty = Number(stock?.rankMeta?.penalty ?? 0);
  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];

  if (activeView === "total") {
    if (stock?.rankMeta?.topRankEligible) parts.push("안정성 조건 통과");
    if (totalScore >= 70) parts.push(`총점 ${totalScore}점`);
    if (Number.isFinite(upside) && upside > 0) parts.push(`상승여력 ${formatPercent(upside)}`);
    if (rankPenalty > 0) parts.push(`패널티 ${rankPenalty}`);
    if (rankFlags.length) parts.push(rankFlags[0]);
  } else if (activeView === "undervalue") {
    if (valueScore > 0) parts.push(`가치 점수 ${valueScore}점`);
    if (Number.isFinite(debtRatio)) parts.push(`부채비율 ${formatPercent(debtRatio)}`);
    if (Number.isFinite(upside) && upside > 0) parts.push(`상승여력 ${formatPercent(upside)}`);
    if (undervalueFlags.length) parts.push(undervalueFlags[0]);
  } else if (activeView === "upside") {
    if (Number.isFinite(upside)) parts.push(`상승여력 ${formatPercent(upside)}`);
    if (stock?.rankMeta?.topRankEligible) parts.push("종합 조건 통과");
    if (rankFlags.length) parts.push(rankFlags[0]);
  } else if (activeView === "short") {
    const rate = Number(stock?.metrics?.priceChangeRate ?? stock?.metrics?.momentum);
    if (Number.isFinite(rate)) parts.push(`최근 흐름 ${formatPercent(rate)}`);
    if (Number.isFinite(upside)) parts.push(`상승여력 ${formatPercent(upside)}`);
    if (Number(stock?.metrics?.avgTradeValue5d ?? 0) > 0) parts.push(`유동성 ${formatKrwCompact(stock?.metrics?.avgTradeValue5d)}`);
  } else if (activeView === "annual") {
    if (stock?.rankMeta?.topRankEligible) parts.push("안정성 조건 통과");
    if (totalScore > 0) parts.push(`총점 ${totalScore}점`);
    if (Number.isFinite(Number(stock?.metrics?.operatingIncomeGrowth))) {
      parts.push(`영업이익 성장 ${formatPercent(stock?.metrics?.operatingIncomeGrowth)}`);
    }
    if (Number.isFinite(Number(stock?.metrics?.revenueGrowth))) {
      parts.push(`매출 성장 ${formatPercent(stock?.metrics?.revenueGrowth)}`);
    }
  } else if (activeView === "long") {
    if (valueScore > 0) parts.push(`가치 점수 ${valueScore}점`);
    if (Number.isFinite(debtRatio)) parts.push(`부채비율 ${formatPercent(debtRatio)}`);
    if (Number.isFinite(Number(stock?.metrics?.roe))) parts.push(`ROE ${formatPercent(stock?.metrics?.roe)}`);
    if (Number.isFinite(Number(stock?.metrics?.pbr))) parts.push(`PBR ${Number(stock.metrics.pbr).toFixed(2)}배`);
  }

  if (!parts.length) return "현재 수치 조합을 기준으로 상대 비교된 결과입니다.";
  return parts.join(" · ");
}

function buildWarningLine(stock, activeView, activeRisk) {
  const rankPenalty = Number(stock?.rankMeta?.penalty ?? 0);
  const rankFlags = stock?.rankMeta?.flags || [];
  const undervalueFlags = stock?.undervalueMeta?.flags || [];
  const debtRatio = Number(stock?.metrics?.debtRatio);
  const upside = Number(stock?.metrics?.upside);

  if (activeRisk === "highDebt") {
    return `부채비율 ${formatPercent(debtRatio)} 수준이라 저평가처럼 보여도 재무 리스크를 먼저 확인해야 합니다.`;
  }
  if (activeRisk === "lowLiquidity") {
    return `최근 5일 평균 거래대금 ${formatKrwCompact(stock?.metrics?.avgTradeValue5d)} 수준이라 체결/수급은 보수적으로 봐야 합니다.`;
  }
  if (activeRisk === "unstableEarnings") {
    return "영업이익 또는 순이익 흐름이 약해, 다음 실적 발표와 회복 가능성을 우선 확인해야 합니다.";
  }

  if (activeView === "total" || activeView === "annual") {
    if (rankPenalty > 0) return `종합 해석에는 패널티 ${rankPenalty}점이 반영됩니다.`;
    if (rankFlags.length) return `주의 포인트: ${rankFlags[0]}`;
    if (Number.isFinite(debtRatio) && debtRatio >= 150) return `부채비율 ${formatPercent(debtRatio)}로 보수 해석이 필요합니다.`;
    return "실적·재무·수급 변화에 따라 종합 조건 통과 여부가 바뀔 수 있습니다.";
  }
  if (activeView === "undervalue" || activeView === "long") {
    if (undervalueFlags.length) return `주의 포인트: ${undervalueFlags[0]}`;
    if (Number.isFinite(debtRatio) && debtRatio >= 150) return `저평가처럼 보여도 부채비율 ${formatPercent(debtRatio)}를 함께 확인해야 합니다.`;
    return "가치 점수가 높아도 재무 안정성 해석은 별도로 확인해야 합니다.";
  }
  if (Number.isFinite(upside) && upside <= 0) {
    return "현재 적정가 추정 기준 즉각적인 상승여력은 크지 않을 수 있습니다.";
  }
  if (rankFlags.length) return `주의 포인트: ${rankFlags[0]}`;
  return "상승여력은 참고치이며 실제 결과는 업황·실적·수급에 따라 달라질 수 있습니다.";
}

function RankingPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requestedView = (searchParams.get("view") || "").trim();
  const requestedRisk = (searchParams.get("risk") || "").trim();

  const initialView = VIEW_CONFIG[requestedView] ? requestedView : "total";
  const initialRisk = RISK_CONFIG[requestedRisk] ? requestedRisk : "all";

  const [activeView, setActiveView] = useState(initialView);
  const [activeRisk, setActiveRisk] = useState(initialRisk);
  const [query, setQuery] = useState("");

  const updateRoute = (nextView, nextRisk) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    params.delete("risk");
    if (nextView && nextView !== "total") params.set("view", nextView);
    if (nextRisk && nextRisk !== "all") params.set("risk", nextRisk);
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
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
    if (kind === "total") {
      setActiveView("total");
      setActiveRisk("all");
      updateRoute("total", "all");
      return;
    }
    if (kind === "undervalue") {
      setActiveView("undervalue");
      setActiveRisk("all");
      updateRoute("undervalue", "all");
      return;
    }
    if (kind === "highDebt") {
      setActiveRisk("highDebt");
      updateRoute(activeView, "highDebt");
      return;
    }
    if (kind === "unstableEarnings") {
      setActiveRisk("unstableEarnings");
      updateRoute(activeView, "unstableEarnings");
    }
  };

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    setActiveRisk(initialRisk);
  }, [initialRisk]);

  const sortedStocks = useMemo(() => buildSortedStocks(stocks, activeView), [activeView]);
  const filteredByRisk = useMemo(() => applyRiskFilter(sortedStocks, activeRisk), [sortedStocks, activeRisk]);

  const rankMap = useMemo(() => new Map(filteredByRisk.map((item, index) => [String(item.code), index + 1])), [filteredByRisk]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredByRisk;
    return filteredByRisk.filter((item) =>
      String(item.name || "").toLowerCase().includes(q) ||
      String(item.code || "").toLowerCase().includes(q)
    );
  }, [filteredByRisk, query]);

  const topEligibleCount = useMemo(() => stocks.filter((item) => item?.rankMeta?.topRankEligible).length, []);
  const undervalueEligibleCount = useMemo(() => stocks.filter((item) => item?.undervalueMeta?.eligible).length, []);
  const highDebtCount = useMemo(() => stocks.filter(isHighDebt).length, []);
  const lowLiquidityCount = useMemo(() => stocks.filter(isLowLiquidity).length, []);
  const unstableEarningsCount = useMemo(() => stocks.filter(isUnstableEarnings).length, []);

  const activeViewMeta = VIEW_CONFIG[activeView] || VIEW_CONFIG.total;
  const activeRiskMeta = RISK_CONFIG[activeRisk] || RISK_CONFIG.all;

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
            <h1>{activeViewMeta.title}</h1>
            <p className="desc">
              {activeViewMeta.desc}<br />
              {activeRisk !== "all"
                ? `현재는 “${activeRiskMeta.title}” 필터가 적용된 리스트를 보고 있습니다.`
                : "아래 퀵 선택 또는 필터 바에서 바로 원하는 보기로 이동할 수 있습니다."}
            </p>
          </div>

          <div className="heroMeta">
            <div className="quickStatGrid">
              <button
                type="button"
                className={`quickStatCard ${activeView === "total" && activeRisk === "all" ? "active" : ""}`}
                onClick={() => handleQuickCardClick("total")}
              >
                <span className="quickLabel">종합 우선 후보</span>
                <strong>{topEligibleCount}종목</strong>
              </button>
              <button
                type="button"
                className={`quickStatCard ${activeView === "undervalue" && activeRisk === "all" ? "active" : ""}`}
                onClick={() => handleQuickCardClick("undervalue")}
              >
                <span className="quickLabel">저평가 후보</span>
                <strong>{undervalueEligibleCount}종목</strong>
              </button>
              <button
                type="button"
                className={`quickStatCard warn ${activeRisk === "highDebt" ? "active" : ""}`}
                onClick={() => handleQuickCardClick("highDebt")}
              >
                <span className="quickLabel">고부채</span>
                <strong>{highDebtCount}종목</strong>
              </button>
              <button
                type="button"
                className={`quickStatCard warn ${activeRisk === "unstableEarnings" ? "active" : ""}`}
                onClick={() => handleQuickCardClick("unstableEarnings")}
              >
                <span className="quickLabel">이익 불안정</span>
                <strong>{unstableEarningsCount}종목</strong>
              </button>
            </div>

            <div className="metaCard light fullSearchCard">
              <span className="metaLabel">검색</span>
              <input
                className="searchInput"
                placeholder="종목명 / 종목코드"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <p className="searchGuide">현재 보기 결과 {filtered.length}개 / 저유동성 종목 {lowLiquidityCount}개</p>
            </div>
          </div>
        </section>

        <section className="guideSection">
          <div className="guideCard compact">
            <div className="guideHeader">
              <div>
                <h2>보기 전환</h2>
              </div>
            </div>

            <div className="controlPanel">
              <div className="controlBlock">
                <span className="groupLabel">기본 랭킹</span>
                <div className="chipRow">
                  {[
                    ["total", "종합"],
                    ["undervalue", "저평가"],
                    ["upside", "상승여력"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`filterChip ${activeView === key ? "active" : ""}`}
                      onClick={() => handleViewChange(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="controlBlock">
                <span className="groupLabel">전략별 보기</span>
                <div className="chipRow">
                  {[
                    ["short", "단기 투자"],
                    ["annual", "연간 투자"],
                    ["long", "장기 투자"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`filterChip alt ${activeView === key ? "active" : ""}`}
                      onClick={() => handleViewChange(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="controlBlock">
                <span className="groupLabel">피해야 할 타입 필터</span>
                <div className="chipRow">
                  {[
                    ["all", "전체"],
                    ["highDebt", "고부채"],
                    ["lowLiquidity", "저유동성"],
                    ["unstableEarnings", "이익 불안정"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`filterChip risk ${activeRisk === key ? "active" : ""}`}
                      onClick={() => handleRiskChange(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="statusSection">
          <div className="statusCard">
            <div>
              <strong>현재 보기</strong>
              <p>{activeViewMeta.title} · {activeRiskMeta.title}</p>
            </div>
            <span>{filtered.length}개 노출</span>
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

              const scorePresentation = getScorePresentation(stock, activeView);

              return (
                <article className="stockCard" key={`${stock.code}-${activeView}-${activeRisk}`}>
                  <div className="cardTop">
                    <div className="rankWrap">
                      <span className="rankBadge">#{displayRank}</span>
                      <div>
                        <h3>{stock.name}</h3>
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
                      <strong>{scorePresentation.valueText}</strong>
                      {activeView === "total" && Number(stock.rawTotalScore) !== Number(stock.totalScore) ? (
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
                    {(activeView === "total" || activeView === "annual") ? (
                      eligible
                        ? <span className="smallBadge good">종합 상위 후보</span>
                        : <span className="smallBadge warn">종합 상위 제외</span>
                    ) : null}
                    {(activeView === "undervalue" || activeView === "long") && stock?.undervalueMeta?.eligible ? (
                      <span className="smallBadge info">저평가 후보</span>
                    ) : null}
                    {activeRisk === "highDebt" ? <span className="smallBadge warn">고부채</span> : null}
                    {activeRisk === "lowLiquidity" ? <span className="smallBadge muted">저유동성</span> : null}
                    {activeRisk === "unstableEarnings" ? <span className="smallBadge soft">이익 불안정</span> : null}
                    {(activeView === "total" || activeView === "annual") && penalty > 0 ? (
                      <span className="smallBadge muted">패널티 {penalty}</span>
                    ) : null}
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
                    <Link href={`/risk?code=${stock.code}#risk-${stock.code}`} className="riskBtn">
                      리스크 보기
                    </Link>
                    <Link href={`/stock/${stock.code}`} className="detailBtn">
                      상세 보기
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
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
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .badge {
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
        .heroMeta {
          display: grid;
          gap: 12px;
          min-width: 300px;
          width: 320px;
        }
        .quickStatGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .quickStatCard {
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 18px;
          background: #fff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
          text-align: left;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .quickStatCard:hover {
          transform: translateY(-1px);
          border-color: #cbd5e1;
          background: #fbfdff;
        }
        .quickStatCard.warn {
          background: #fffdfa;
        }
        .quickStatCard.active {
          border-color: #0f172a;
          box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.08);
        }
        .quickLabel {
          display: block;
          margin-bottom: 10px;
          color: #64748b;
          font-size: 0.88rem;
          font-weight: 700;
        }
        .quickStatCard strong {
          font-size: 1.8rem;
          letter-spacing: -0.04em;
        }
        .metaCard {
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 18px;
          background: #fff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
        }
        .metaCard.light {
          background: #f8fbff;
        }
        .metaLabel {
          display: block;
          margin-bottom: 8px;
          color: #64748b;
          font-size: 0.88rem;
          font-weight: 700;
        }
        .searchInput {
          width: 100%;
          height: 44px;
          border-radius: 12px;
          border: 1px solid #dbe3f0;
          padding: 0 14px;
          font-size: 0.95rem;
          box-sizing: border-box;
        }
        .searchGuide {
          margin: 10px 0 0;
          color: #64748b;
          font-size: 0.9rem;
        }
        .guideSection,
        .statusSection,
        .listSection {
          margin-top: 22px;
        }
        .guideCard,
        .statusCard {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 24px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .guideCard.compact {
          padding: 22px;
        }
        .guideHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .guideHeader h2 {
          margin: 0 0 6px;
          font-size: 1.35rem;
        }
        .guideIntro {
          margin: 0;
          color: #64748b;
          line-height: 1.7;
        }
        .controlPanel {
          display: grid;
          gap: 14px;
        }
        .controlBlock {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 16px;
          background: #fff;
        }
        .groupLabel {
          display: block;
          margin-bottom: 10px;
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 800;
        }
        .chipRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .filterChip {
          height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid #dbe3f0;
          background: #fff;
          color: #0f172a;
          font-weight: 800;
          cursor: pointer;
        }
        .filterChip.alt {
          background: #f8fbff;
        }
        .filterChip.risk {
          background: #fffdfa;
        }
        .filterChip.active {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }
        .statusCard {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .statusCard strong {
          display: block;
          margin-bottom: 6px;
          font-size: 1rem;
        }
        .statusCard p {
          margin: 0;
          color: #64748b;
        }
        .statusCard span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 90px;
          height: 42px;
          border-radius: 14px;
          background: #0f172a;
          color: #fff;
          font-weight: 800;
        }
        .listGrid {
          display: grid;
          gap: 16px;
        }
        .stockCard {
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          padding: 22px;
          background: #fff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
        }
        .cardTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .rankWrap {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }
        .rankBadge {
          display: inline-flex;
          min-width: 52px;
          height: 52px;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: #0f172a;
          color: #fff;
          font-weight: 900;
        }
        .rankWrap h3 {
          margin: 0 0 6px;
          font-size: 1.2rem;
          letter-spacing: -0.02em;
        }
        .stockMeta {
          margin: 0;
          color: #64748b;
          font-size: 0.92rem;
        }
        .scoreWrap {
          text-align: right;
          min-width: 110px;
        }
        .scoreLabel {
          display: block;
          color: #64748b;
          font-size: 0.84rem;
          font-weight: 700;
        }
        .scoreLabelRow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }
        .tooltipTrigger {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 0.72rem;
          font-weight: 800;
          cursor: help;
          outline: none;
        }
        .tooltipBubble {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          width: 260px;
          padding: 10px 12px;
          border-radius: 12px;
          background: #0f172a;
          color: #fff;
          font-size: 0.78rem;
          font-weight: 600;
          line-height: 1.55;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.18);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-4px);
          transition: all 0.18s ease;
          z-index: 20;
          text-align: left;
        }
        .tooltipTrigger:hover .tooltipBubble,
        .tooltipTrigger:focus .tooltipBubble {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .scoreWrap strong {
          display: block;
          font-size: 1.8rem;
          line-height: 1;
          letter-spacing: -0.04em;
        }
        .rawScore {
          display: block;
          margin-top: 6px;
          color: #64748b;
          font-size: 0.84rem;
        }
        .metricRow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }
        .metricBox {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px;
          background: #f8fbff;
        }
        .metricBox span {
          display: block;
          margin-bottom: 8px;
          color: #64748b;
          font-size: 0.84rem;
          font-weight: 700;
        }
        .metricBox strong {
          font-size: 1rem;
          letter-spacing: -0.02em;
        }
        .metricBox strong.sky {
          color: #0ea5e9;
        }
        .badgeRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .smallBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 800;
        }
        .smallBadge.good {
          background: #ecfeff;
          color: #0891b2;
        }
        .smallBadge.warn {
          background: #fff7ed;
          color: #c2410c;
        }
        .smallBadge.muted {
          background: #f1f5f9;
          color: #475569;
        }
        .smallBadge.soft {
          background: #eef2ff;
          color: #4f46e5;
        }
        .smallBadge.info {
          background: #e0f2fe;
          color: #0284c7;
        }
        .reasonCard {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 12px;
        }
        .goodCard {
          background: #f8fbff;
        }
        .warnCard {
          background: #fffdfa;
        }
        .reasonLabel {
          display: block;
          margin-bottom: 8px;
          color: #0f172a;
          font-size: 0.84rem;
          font-weight: 800;
        }
        .reasonCard p {
          margin: 0;
          color: #475569;
          line-height: 1.75;
        }
        .summary {
          margin: 0;
          color: #475569;
          line-height: 1.8;
        }
        .linkRow {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .riskBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          text-decoration: none;
          background: #ffffff;
          color: #0f172a;
          font-weight: 800;
          border: 1px solid #cbd5e1;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
          transition: all 0.15s ease;
        }
        .riskBtn:hover {
          border-color: #94a3b8;
          background: #f8fafc;
          transform: translateY(-1px);
        }
        .detailBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          text-decoration: none;
          background: #0f172a;
          color: #fff;
          font-weight: 800;
        }
        @media (max-width: 980px) {
          .guideGrid,
          .metricRow,
          .quickStatGrid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 900px) {
          .metricRow,
          .quickStatGrid {
            grid-template-columns: 1fr;
          }
          .pageHero,
          .cardTop,
          .statusCard {
            flex-direction: column;
            align-items: flex-start;
          }
          .scoreWrap {
            text-align: left;
          }
          .heroMeta {
            width: 100%;
            min-width: 0;
          }
        }
        @media (max-width: 640px) {
          .container {
            padding: 24px 18px 64px;
          }
          .guideCard,
          .statusCard,
          .stockCard {
            padding: 20px;
          }
          .linkRow {
            justify-content: stretch;
          }
          .riskBtn,
          .detailBtn {
            width: 100%;
          }
          .chipRow {
            gap: 8px;
          }
        }
      `}</style>
    </>
  );
}

function RankingPageFallback() {
  return (
    <main className="container" style={{ padding: "32px 24px 80px", color: "#0f172a" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ color: "#64748b", fontWeight: 700 }}>랭킹 페이지 불러오는 중...</p>
      </div>
    </main>
  );
}

export default function RankingPage() {
  return (
    <Suspense fallback={<RankingPageFallback />}>
      <RankingPageContent />
    </Suspense>
  );
}
