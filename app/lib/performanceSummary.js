// app/performance/page.js의 성과 집계 로직(승률/초과수익/생존자 편향 보정)을
// 그대로 옮긴 것. 홈 화면 성적표 요약 블록(TASK 4-4)도 같은 숫자를 써야
// 페이지마다 다른 승률이 보이는 걸 막을 수 있어서, 계산을 여기 하나로
// 모으고 두 화면이 같이 호출한다.
import { formatUpside } from "./formatUpside";

function calcReturnRate(baseValue, currentValue) {
  const base = Number(baseValue);
  const now = Number(currentValue);
  if (!Number.isFinite(base) || !Number.isFinite(now) || base === 0) return null;
  return ((now - base) / base) * 100;
}

export function buildPerformanceData({ history, stocks, selectedSnapshotDate = null }) {
  const latestDate = history[0]?.snapshotDate || "-";
  const latestBenchmarkClose = Number(history[0]?.benchmark?.close);

  const currentPriceMap = Object.fromEntries(stocks.map((item) => [item.code, item.metrics?.closePrice ?? null]));
  const stockMap = Object.fromEntries(stocks.map((item) => [item.code, item]));

  // 종목이 top500 유니버스에서 빠지면(상장폐지가 아니라 순위 밖으로 밀려난
  // 경우가 대부분) 조용히 계산에서 빼면 "부진한 종목이 사라지는" 생존자
  // 편향이 생긴다. history.json 자체가 각 종목이 top10에 마지막으로 뽑혔을
  // 때의 selectedPrice를 갖고 있으므로, 그 마지막 가격으로 "동결"해서 계속
  // 평균/승률에 포함시킨다. 벤치마크도 같은 날짜 기준으로 동결해야 초과수익
  // 비교가 왜곡되지 않는다.
  const lastKnownPriceByCode = new Map();
  for (const entry of history) {
    for (const pick of entry.top10 || []) {
      const existing = lastKnownPriceByCode.get(pick.code);
      if (!existing || entry.snapshotDate > existing.date) {
        lastKnownPriceByCode.set(pick.code, { price: pick.selectedPrice, date: entry.snapshotDate });
      }
    }
  }

  const benchmarkCloseByDate = new Map();
  for (const entry of history) {
    const close = Number(entry?.benchmark?.close);
    if (Number.isFinite(close)) benchmarkCloseByDate.set(entry.snapshotDate, close);
  }

  const weeklyRows = history.map((entry) => {
    const isLatestSnapshot = entry.snapshotDate === latestDate;
    const picks = (entry.top10 || []).map((pick) => {
      const currentStock = stockMap[pick.code];
      const trackingStatus = currentStock ? "tracked" : "out_of_universe";
      const rawCurrentPrice = currentPriceMap[pick.code];
      const currentPriceNum = Number(rawCurrentPrice);
      const hasCurrentPrice = Number.isFinite(currentPriceNum) && currentPriceNum > 0;
      const currentPrice = hasCurrentPrice ? currentPriceNum : null;

      const frozen = lastKnownPriceByCode.get(pick.code) || null;
      const effectivePrice = hasCurrentPrice ? currentPrice : frozen?.price ?? null;
      const returnRate = effectivePrice != null ? calcReturnRate(pick.selectedPrice, effectivePrice) : null;

      const benchmarkBase = Number(entry?.benchmark?.close);
      const benchmarkCompareClose = hasCurrentPrice
        ? latestBenchmarkClose
        : benchmarkCloseByDate.get(frozen?.date) ?? latestBenchmarkClose;
      const benchmarkReturnForPick = calcReturnRate(benchmarkBase, benchmarkCompareClose);
      const excessReturnForPick =
        Number.isFinite(returnRate) && Number.isFinite(benchmarkReturnForPick)
          ? returnRate - benchmarkReturnForPick
          : null;

      // 상승여력은 원문 %를 그대로 노출하지 않고 app/lib/formatUpside.js를 거친다
      // (+60% 상한/-40% 하한 라벨 처리, fairValue 결측 시 "산출 보류").
      const upsideAtPick = formatUpside(pick.selectedPrice, pick.targetPrice);
      const currentUpsideResult = formatUpside(currentPrice, currentStock?.metrics?.targetPrice);

      return {
        ...pick,
        currentPrice,
        hasCurrentPrice,
        trackingStatus,
        frozenAsOfDate: hasCurrentPrice ? null : frozen?.date ?? null,
        effectivePrice,
        isLatestSnapshot,
        returnRate,
        benchmarkReturnForPick,
        excessReturnForPick,
        upsideDisplay: upsideAtPick.display,
        upsideRaw: upsideAtPick.raw,
        currentTargetPrice: currentStock?.metrics?.targetPrice ?? null,
        currentUpsideDisplay: currentUpsideResult.display,
        currentUpsideRaw: currentUpsideResult.raw,
        currentSummary: currentStock?.summary || "",
        currentRisk: currentStock?.risk || "",
        currentDescription: currentStock?.description || "",
        currentTotalScore: currentStock?.totalScore ?? null,
        currentValueScore: currentStock?.valueScore ?? null,
        currentRankEligible: currentStock?.rankMeta?.topRankEligible ?? null,
        currentRankFlags: currentStock?.rankMeta?.flags || [],
        currentRankPenalty: currentStock?.rankMeta?.penalty ?? 0,
        currentUndervalueEligible: currentStock?.undervalueMeta?.eligible ?? null,
        currentUndervalueFlags: currentStock?.undervalueMeta?.flags || [],
      };
    });

    const validReturns = picks.map((item) => item.returnRate).filter((v) => Number.isFinite(v));
    const avgReturn = validReturns.length ? validReturns.reduce((a, b) => a + b, 0) / validReturns.length : null;
    const winRate = validReturns.length ? (validReturns.filter((v) => v > 0).length / validReturns.length) * 100 : null;
    const bestReturn = validReturns.length ? Math.max(...validReturns) : null;
    const worstReturn = validReturns.length ? Math.min(...validReturns) : null;
    const benchmarkBase = Number(entry?.benchmark?.close);
    const benchmarkReturn = calcReturnRate(benchmarkBase, latestBenchmarkClose);
    const excessReturn =
      Number.isFinite(avgReturn) && Number.isFinite(benchmarkReturn) ? avgReturn - benchmarkReturn : null;

    return {
      snapshotDate: entry.snapshotDate,
      weekLabel: entry.weekLabel,
      benchmarkName: entry?.benchmark?.name || "KOSPI",
      benchmarkBase,
      benchmarkCurrent: latestBenchmarkClose,
      benchmarkReturn,
      excessReturn,
      picks,
      count: picks.length,
      avgReturn,
      winRate,
      bestReturn,
      worstReturn,
      isLatestSnapshot,
    };
  });

  const matureRows = weeklyRows.filter((row) => !row.isLatestSnapshot);
  const allPicks = matureRows.flatMap((row) => row.picks);
  const allReturns = allPicks.map((item) => item.returnRate).filter((v) => Number.isFinite(v));
  const benchmarkReturns = matureRows.map((row) => row.benchmarkReturn).filter((v) => Number.isFinite(v));
  const excessReturns = matureRows.map((row) => row.excessReturn).filter((v) => Number.isFinite(v));
  const overallAvg = allReturns.length ? allReturns.reduce((a, b) => a + b, 0) / allReturns.length : null;
  const overallWinRate = allReturns.length ? (allReturns.filter((v) => v > 0).length / allReturns.length) * 100 : null;
  const overallBest = allReturns.length ? Math.max(...allReturns) : null;
  const overallWorst = allReturns.length ? Math.min(...allReturns) : null;
  const benchmarkAvg = benchmarkReturns.length ? benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length : null;
  const excessAvg = excessReturns.length ? excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length : null;

  // out_of_universe 종목도 동결 가격으로 평균에 포함시키긴 하지만, 그 비율
  // 자체가 너무 높으면("추적 대상이 계속 이탈한다") 별개로 알려줄 가치가
  // 있는 신호다.
  const outOfUniverseCount = allPicks.filter((p) => p.trackingStatus === "out_of_universe").length;
  const outOfUniverseRatio = allPicks.length ? outOfUniverseCount / allPicks.length : 0;
  const survivorshipWarning = outOfUniverseRatio > 0.2;

  const sortedByReturn = [...allPicks].filter((item) => Number.isFinite(item.returnRate)).sort((a, b) => b.returnRate - a.returnRate);

  const selectedWeek = weeklyRows.find((row) => row.snapshotDate === selectedSnapshotDate) || matureRows[0] || weeklyRows[0] || null;

  const chartRows = [...matureRows]
    .slice()
    .reverse()
    .map((row) => ({
      label: row.snapshotDate.slice(5),
      strategy: row.avgReturn,
      benchmark: row.benchmarkReturn,
      excess: row.excessReturn,
    }));

  const controversialPick = selectedWeek?.picks?.length
    ? [...selectedWeek.picks]
        .filter((pick) => Number.isFinite(pick.upside) || Number.isFinite(pick.returnRate))
        .sort((a, b) => ((Number(b.upside) || 0) - (Number(b.returnRate) || 0)) - ((Number(a.upside) || 0) - (Number(a.returnRate) || 0)))[0]
    : null;

  const selectedWeekSortedPicks = selectedWeek?.picks
    ? [...selectedWeek.picks].sort((a, b) => {
        const aExcess = Number(a.excessReturnForPick);
        const bExcess = Number(b.excessReturnForPick);
        if (Number.isFinite(bExcess) && Number.isFinite(aExcess) && bExcess !== aExcess) return bExcess - aExcess;
        return Number(b.returnRate || -999) - Number(a.returnRate || -999);
      })
    : [];

  return {
    weeklyRows,
    selectedWeek,
    selectedWeekSortedPicks,
    chartRows,
    controversialPick,
    totalSnapshots: matureRows.length,
    totalPicks: allPicks.length,
    overallAvg,
    overallWinRate,
    overallBest,
    overallWorst,
    benchmarkAvg,
    excessAvg,
    validReturnCount: allReturns.length,
    outOfUniverseCount,
    outOfUniverseRatio,
    survivorshipWarning,
    latestBenchmarkDate: history[0]?.snapshotDate || null,
    bestPicks: sortedByReturn.slice(0, 3),
    worstPicks: [...sortedByReturn].reverse().slice(0, 3),
  };
}
