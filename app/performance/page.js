"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import history from "../data/history.json";
import stocks from "../data/stocks.json";
import PageTopBar from "../components/PageTopBar";
import { formatUpside } from "../lib/formatUpside";

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

function formatIndex(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function calcReturnRate(baseValue, currentValue) {
  const base = Number(baseValue);
  const now = Number(currentValue);
  if (!Number.isFinite(base) || !Number.isFinite(now) || base === 0) return null;
  return ((now - base) / base) * 100;
}

function getToneClass(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "toneNeutral";
  if (num > 0) return "tonePositive";
  if (num < 0) return "toneNegative";
  return "toneNeutral";
}

function getRowStatusLabel(returnRate, benchmarkReturn, options = {}) {
  const { hasCurrentPrice = true, isLatestSnapshot = false } = options;
  if (isLatestSnapshot) return { text: "집계 중", className: "statusBadge neutral" };
  if (!hasCurrentPrice) return { text: "데이터 없음", className: "statusBadge neutral" };
  const r = Number(returnRate);
  const b = Number(benchmarkReturn);
  if (!Number.isFinite(r)) return { text: "결과 확인 중", className: "statusBadge neutral" };
  if (Number.isFinite(b)) {
    if (r > 0 && r >= b) return { text: "초과수익", className: "statusBadge good" };
    if (r > 0 && r < b) return { text: "수익 but 벤치마크 하회", className: "statusBadge mid" };
    if (r <= 0 && r > b) return { text: "손실 but 벤치마크 상회", className: "statusBadge mid" };
    return { text: "벤치마크 하회", className: "statusBadge warn" };
  }
  if (r > 0) return { text: "수익", className: "statusBadge good" };
  if (r < 0) return { text: "손실", className: "statusBadge warn" };
  return { text: "보합", className: "statusBadge neutral" };
}

function safeNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export default function PerformancePage() {
  const latestDate = history[0]?.snapshotDate || "-";
  const latestBenchmarkClose = Number(history[0]?.benchmark?.close);
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState(
    history[1]?.snapshotDate || history[0]?.snapshotDate || null
  );
  const [visibleWeeksCount, setVisibleWeeksCount] = useState(10);

  const currentPriceMap = useMemo(
    () => Object.fromEntries(stocks.map((item) => [item.code, item.metrics?.closePrice ?? null])),
    []
  );

  const stockMap = useMemo(
    () => Object.fromEntries(stocks.map((item) => [item.code, item])),
    []
  );

  const performanceData = useMemo(() => {
    const weeklyRows = history.map((entry) => {
      const isLatestSnapshot = entry.snapshotDate === latestDate;
      const picks = (entry.top10 || []).map((pick) => {
        const currentStock = stockMap[pick.code];
        const rawCurrentPrice = currentPriceMap[pick.code];
        const currentPriceNum = Number(rawCurrentPrice);
        const hasCurrentPrice = Number.isFinite(currentPriceNum) && currentPriceNum > 0;
        const currentPrice = hasCurrentPrice ? currentPriceNum : null;
        const returnRate = hasCurrentPrice ? calcReturnRate(pick.selectedPrice, currentPrice) : null;
        const benchmarkBase = Number(entry?.benchmark?.close);
        const benchmarkReturnForPick = calcReturnRate(benchmarkBase, latestBenchmarkClose);
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
        Number.isFinite(avgReturn) && Number.isFinite(benchmarkReturn)
          ? avgReturn - benchmarkReturn
          : null;

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

    const sortedByReturn = [...allPicks]
      .filter((item) => Number.isFinite(item.returnRate))
      .sort((a, b) => b.returnRate - a.returnRate);

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
          .sort(
            (a, b) =>
              ((Number(b.upside) || 0) - (Number(b.returnRate) || 0)) -
              ((Number(a.upside) || 0) - (Number(a.returnRate) || 0))
          )[0]
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
      bestPicks: sortedByReturn.slice(0, 3),
      worstPicks: [...sortedByReturn].reverse().slice(0, 3),
    };
  }, [currentPriceMap, latestBenchmarkClose, latestDate, selectedSnapshotDate, stockMap]);

  const selectedWeek = performanceData.selectedWeek;
  const controversialPick = performanceData.controversialPick;

  const chartValues = useMemo(() => {
    const rows = performanceData.chartRows;
    const width = 860;
    const height = 300;
    const all = rows.flatMap((row) => [row.strategy, row.benchmark, row.excess]).filter((v) => Number.isFinite(v));
    const valid = all.length ? all : [0];
    const minV = Math.min(0, ...valid);
    const maxV = Math.max(0, ...valid);
    const range = maxV - minV || 1;
    const topPad = 24;
    const bottomPad = 34;
    const sidePad = 16;
    const innerW = width - sidePad * 2;
    const innerH = height - topPad - bottomPad;

    function buildLine(key) {
      return rows.map((row, idx) => {
        const x = sidePad + (rows.length === 1 ? innerW / 2 : (idx * innerW) / (rows.length - 1));
        const val = Number.isFinite(row[key]) ? row[key] : 0;
        const y = topPad + ((maxV - val) / range) * innerH;
        return { x, y, value: row[key] };
      });
    }

    const strategyPts = buildLine("strategy");
    const benchmarkPts = buildLine("benchmark");
    const excessPts = buildLine("excess");
    const grid = [maxV, (maxV + minV) / 2, minV].map((v) => ({
      y: topPad + ((maxV - v) / range) * innerH,
      value: v,
    }));
    const zeroY = topPad + ((maxV - 0) / range) * innerH;

    return { width, height, strategyPts, benchmarkPts, excessPts, grid, zeroY };
  }, [performanceData.chartRows]);

  return (
    <>
      <main className="container">
        <PageTopBar />

        {/* 상단 네비를 4개로 통합하면서 "성과/백테스트"가 네비에서 빠져 여기서 진입 경로를 열어둔다 */}
        <Link href="/reports" className="performanceCrossLink">← 무료 리포트로 돌아가기</Link>

        <section className="pageHero">
          <div>
            <p className="badge">PERFORMANCE</p>
            <h1>성과/백테스트</h1>
            <p className="desc">
              추천 결과를 주차별로 기록하고, 시간이 지나면서 실제 성과를 공개하는 페이지입니다.
              <br />
              KOSPI 기준수익률과 비교한 초과수익까지 함께 추적하며, 추천 당시 판단과 현재 결과를 같은 화면에서 확인할 수 있습니다.
            </p>
          </div>
          <div className="updateBox">
            <span className="updateLabel">최신 기록일</span>
            <strong>{latestDate}</strong>
          </div>
        </section>

        <section className="methodSection">
          <div className="methodCard">
            <div className="methodHeader">
              <div>
                <p className="methodBadge">HOW TO READ</p>
                <h2>성과 해석 기준</h2>
              </div>
            </div>
            <div className="methodGrid">
              <div className="methodItem">
                <strong>기준 고정</strong>
                <span>추천 당시 top10과 가격은 history.json 스냅샷을 기준으로 고정하고, 현재값만 최신 데이터를 반영합니다.</span>
              </div>
              <div className="methodItem">
                <strong>벤치마크 비교</strong>
                <span>각 스냅샷 시점 KOSPI 값과 최신 KOSPI 값을 비교해 전략 수익률과 초과수익을 함께 보여줍니다.</span>
              </div>
              <div className="methodItem">
                <strong>추천 vs 결과</strong>
                <span>추천 당시 적정가/상승여력과 현재 수익률, 현재 상승여력을 같이 보여줘 해석의 일관성을 점검합니다.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="kpiSection">
          <div className="kpiGrid">
            <div className="kpiCard">
              <span className="kpiLabel">전략 평균 수익률</span>
              <strong className={getToneClass(performanceData.overallAvg)}>{formatPercent(performanceData.overallAvg)}</strong>
              <p>추천 종목 전체 평균 기준</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">KOSPI 평균 수익률</span>
              <strong className={getToneClass(performanceData.benchmarkAvg)}>{formatPercent(performanceData.benchmarkAvg)}</strong>
              <p>동일 스냅샷 기준 KOSPI 비교값</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">평균 초과수익</span>
              <strong className={getToneClass(performanceData.excessAvg)}>{formatPercent(performanceData.excessAvg)}</strong>
              <p>전략 수익률 - KOSPI 수익률</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">전체 승률</span>
              <strong>{formatPercent(performanceData.overallWinRate)}</strong>
              <p>수익률이 플러스인 종목 비율</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">스냅샷 수</span>
              <strong>{performanceData.totalSnapshots}</strong>
              <p>성과 집계가 끝난 주차 수 (오늘 추천은 제외)</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">누적 종목 수</span>
              <strong>{performanceData.totalPicks}</strong>
              <p>기록된 추천 종목 수</p>
            </div>
          </div>
        </section>

        <section className="graphSection">
          <div className="graphCard">
            <div className="graphHeader">
              <div>
                <h2>전략 vs KOSPI vs 초과수익</h2>
                <p className="graphDesc">파랑은 전략 평균 수익률, 회색은 KOSPI 수익률, 점선 민트는 초과수익입니다.</p>
              </div>
              <div className="legendWrap">
                <span className="legendItem"><i className="legendLine strategy" /> 전략</span>
                <span className="legendItem"><i className="legendLine benchmark" /> KOSPI</span>
                <span className="legendItem"><i className="legendLine excess" /> 초과수익</span>
              </div>
            </div>
            <div className="chartWrap">
              <svg viewBox={`0 0 ${chartValues.width} ${chartValues.height}`} className="chartSvg" role="img" aria-label="전략, KOSPI, 초과수익 비교 그래프">
                {chartValues.grid.map((g, idx) => (
                  <g key={idx}>
                    <line x1="16" x2={chartValues.width - 16} y1={g.y} y2={g.y} className={idx === 1 ? "gridLine strong" : "gridLine"} />
                    <text x="0" y={g.y + 4} className="gridLabel">{formatPercent(g.value)}</text>
                  </g>
                ))}
                <line x1="16" x2={chartValues.width - 16} y1={chartValues.zeroY} y2={chartValues.zeroY} className="zeroLine" />
                <polyline points={chartValues.strategyPts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" className="chartLine strategy" />
                <polyline points={chartValues.benchmarkPts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" className="chartLine benchmark" />
                <polyline points={chartValues.excessPts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" className="chartLine excess" />
                {performanceData.chartRows.map((row, idx) => {
                  const p = chartValues.strategyPts[idx];
                  return (
                    <text key={row.label} x={p.x} y={chartValues.height - 8} textAnchor="middle" className="xLabel">{row.label}</text>
                  );
                })}
              </svg>
            </div>
          </div>
        </section>

        <section className="historySection">
          <div className="sectionCard">
            <div className="sectionHeaderInline">
              <div>
                <h2>주차별 성과 요약</h2>
                <p className="detailDesc">각 주차의 전략 평균 수익률과 벤치마크 대비 초과수익을 한 번에 비교할 수 있습니다.</p>
              </div>
            </div>
            <div className="tableWrap">
              <table className="historyTable">
                <thead>
                  <tr>
                    <th>기준일</th>
                    <th>주차</th>
                    <th>전략 수익률</th>
                    <th>KOSPI</th>
                    <th>초과수익</th>
                    <th>승률</th>
                    <th>최고/최저</th>
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.weeklyRows.slice(0, visibleWeeksCount).map((row) => (
                    <tr key={row.snapshotDate}>
                      <td>{row.snapshotDate}</td>
                      <td>
                        {row.weekLabel}
                        {row.isLatestSnapshot ? <span className="statusBadge neutral" style={{ marginLeft: 8 }}>집계 중</span> : null}
                      </td>
                      <td className={getToneClass(row.avgReturn)}>{row.isLatestSnapshot ? "집계 중" : formatPercent(row.avgReturn)}</td>
                      <td className={getToneClass(row.benchmarkReturn)}>{formatPercent(row.benchmarkReturn)}</td>
                      <td className={getToneClass(row.excessReturn)}>{row.isLatestSnapshot ? "-" : formatPercent(row.excessReturn)}</td>
                      <td>{row.isLatestSnapshot ? "-" : formatPercent(row.winRate)}</td>
                      <td>{row.isLatestSnapshot ? "-" : `${formatPercent(row.bestReturn)} / ${formatPercent(row.worstReturn)}`}</td>
                      <td>
                        <button type="button" className={`detailBtn ${selectedSnapshotDate === row.snapshotDate ? "active" : ""}`} onClick={() => setSelectedSnapshotDate(row.snapshotDate)}>보기</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {performanceData.weeklyRows.length > 10 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "14px 0" }}>
                {visibleWeeksCount < performanceData.weeklyRows.length && (
                  <button
                    type="button"
                    className="detailBtn"
                    onClick={() =>
                      setVisibleWeeksCount((prev) =>
                        Math.min(prev + 10, performanceData.weeklyRows.length)
                      )
                    }
                  >
                    더보기 (
                    {Math.min(visibleWeeksCount, performanceData.weeklyRows.length)}/
                    {performanceData.weeklyRows.length}주차)
                  </button>
                )}
                {visibleWeeksCount > 10 && (
                  <button
                    type="button"
                    className="detailBtn"
                    onClick={() => setVisibleWeeksCount(10)}
                  >
                    접기
                  </button>
                )}
              </div>
            )}
            <p className="tableNote">
              ※ KOSPI 비교값은 각 스냅샷에 저장된 benchmark.close와 최신 스냅샷의 benchmark.close를 비교해 계산합니다.
              <br />
              ※ &lsquo;집계 중&rsquo;은 오늘 처음 추천되어 아직 성과를 판단할 시간이 지나지 않은 상태입니다. &lsquo;데이터 없음&rsquo;은 상장폐지·코드 변경 등으로 현재가를 찾을 수 없는 경우입니다.
            </p>
          </div>
        </section>

        {selectedWeek ? (
          <>
            <section className="detailSection">
              <div className="sectionCard">
                <div className="detailHeader">
                  <div>
                    <h2>{selectedWeek.weekLabel} 상세 성과</h2>
                    <p className="detailDesc">추천 당시 가격, 현재 가격, 실제 수익률과 당시 상승여력을 함께 보여줍니다.</p>
                  </div>
                  <span className="detailBadge">기준일 {selectedWeek.snapshotDate}</span>
                </div>
                <div className="benchmarkSummary">
                  <span>KOSPI 기준값</span>
                  <strong>{formatIndex(selectedWeek.benchmarkBase)}</strong>
                  <span>현재 KOSPI</span>
                  <strong>{formatIndex(selectedWeek.benchmarkCurrent)}</strong>
                  <span>벤치마크 수익률</span>
                  <strong className={getToneClass(selectedWeek.benchmarkReturn)}>{formatPercent(selectedWeek.benchmarkReturn)}</strong>
                </div>
                <div className="tableWrap">
                  <table className="detailTable">
                    <thead>
                      <tr>
                        <th>순위</th>
                        <th>종목</th>
                        <th>상태</th>
                        <th>추천가</th>
                        <th>현재가</th>
                        <th>수익률</th>
                        <th>초과수익</th>
                        <th>당시 적정가</th>
                        <th>당시 상승여력</th>
                        <th>현재 상승여력</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWeek.picks.map((pick) => {
                        const status = getRowStatusLabel(pick.returnRate, selectedWeek.benchmarkReturn, {
                          hasCurrentPrice: pick.hasCurrentPrice,
                          isLatestSnapshot: selectedWeek.isLatestSnapshot,
                        });
                        return (
                          <tr key={`${selectedWeek.snapshotDate}-${pick.code}`}>
                            <td>{pick.rank}</td>
                            <td>
                              <div className="stockCell">
                                <strong>{pick.name}</strong>
                                <span>{pick.market} · {pick.code}</span>
                              </div>
                            </td>
                            <td><span className={status.className}>{status.text}</span></td>
                            <td>{formatPrice(pick.selectedPrice)}</td>
                            <td>{pick.hasCurrentPrice ? formatPrice(pick.currentPrice) : "데이터 없음"}</td>
                            <td className={getToneClass(pick.returnRate)}>{pick.hasCurrentPrice ? formatPercent(pick.returnRate) : "-"}</td>
                            <td className={getToneClass(pick.excessReturnForPick)}>{pick.hasCurrentPrice ? formatPercent(pick.excessReturnForPick) : "-"}</td>
                            <td>{formatPrice(pick.targetPrice)}</td>
                            <td className={getToneClass(pick.upsideRaw)}>{pick.upsideDisplay}</td>
                            <td className={getToneClass(pick.currentUpsideRaw)}>{pick.currentUpsideDisplay}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="trustSection">
              <div className="sectionCard">
                <div className="sectionHeaderInline">
                  <div>
                    <h2>{selectedWeek.weekLabel} 추천 vs 현재 판정</h2>
                    <p className="detailDesc">선택한 주차에서 현재 시점 기준 상대적으로 강하게 남은 종목을 위쪽에 정렬했습니다.</p>
                  </div>
                </div>
                <div className="trustGrid">
                  {performanceData.selectedWeekSortedPicks.slice(0, 4).map((pick) => {
                    const status = getRowStatusLabel(pick.returnRate, selectedWeek.benchmarkReturn, {
                      hasCurrentPrice: pick.hasCurrentPrice,
                      isLatestSnapshot: selectedWeek.isLatestSnapshot,
                    });
                    return (
                      <div className="trustItem" key={`${pick.code}-${pick.rank}`}>
                        <div className="trustItemTop">
                          <div>
                            <p className="pickRank">#{pick.rank}</p>
                            <h3>{pick.name}</h3>
                            <p className="pickMetaLine">{pick.market} · {pick.code}</p>
                          </div>
                          <span className={status.className}>{status.text}</span>
                        </div>
                        <div className="trustMetricRow">
                          <div className="trustMetricBox">
                            <span>수익률</span>
                            <strong className={getToneClass(pick.returnRate)}>{formatPercent(pick.returnRate)}</strong>
                          </div>
                          <div className="trustMetricBox">
                            <span>초과수익</span>
                            <strong className={getToneClass(pick.excessReturnForPick)}>{formatPercent(pick.excessReturnForPick)}</strong>
                          </div>
                          <div className="trustMetricBox">
                            <span>현재 총점</span>
                            <strong>{safeNumber(pick.currentTotalScore, "-") || "-"}</strong>
                          </div>
                        </div>
                        <div className="badgeRow">
                          {pick.currentRankEligible ? <span className="smallBadge good">현재 종합 후보</span> : <span className="smallBadge warn">현재 종합 제외</span>}
                          {pick.currentUndervalueEligible ? <span className="smallBadge info">현재 저평가 후보</span> : null}
                          {Number(pick.currentRankPenalty) > 0 ? <span className="smallBadge muted">패널티 {pick.currentRankPenalty}</span> : null}
                          {[...(pick.currentRankFlags || []), ...(pick.currentUndervalueFlags || [])].slice(0, 2).map((flag) => (
                            <span className="smallBadge soft" key={`${pick.code}-${flag}`}>{flag}</span>
                          ))}
                        </div>
                        <p className="trustReason">
                          추천 당시 상승여력 {pick.upsideDisplay} / 현재 상승여력 {pick.currentUpsideDisplay}.
                          {pick.currentSummary ? ` 현재 요약: ${pick.currentSummary}` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        ) : null}

        <section className="pickSection">
          <div className="pickGrid">
            <div className="pickCard">
              <h2>이번까지 베스트 TOP3</h2>
              <div className="pickList">
                {performanceData.bestPicks.map((item, index) => (
                  <div className="pickItem" key={`${item.code}-${index}`}>
                    <div>
                      <p className="pickName">{item.name}</p>
                      <p className="pickMeta">{item.market} · {item.code}</p>
                    </div>
                    <strong className={getToneClass(item.returnRate)}>{formatPercent(item.returnRate)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="pickCard">
              <h2>이번까지 워스트 TOP3</h2>
              <div className="pickList">
                {performanceData.worstPicks.map((item, index) => (
                  <div className="pickItem" key={`${item.code}-${index}`}>
                    <div>
                      <p className="pickName">{item.name}</p>
                      <p className="pickMeta">{item.market} · {item.code}</p>
                    </div>
                    <strong className={getToneClass(item.returnRate)}>{formatPercent(item.returnRate)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {controversialPick ? (
          <section className="controversySection">
            <div className="controversyCard">
              <div className="controversyHeader">
                <div>
                  <p className="controversyBadge">논란 종목 분석</p>
                  <h2>{controversialPick.name} ({controversialPick.code})</h2>
                  <p className="controversyDesc">기대치와 실제 성과 사이의 간극이 큰 종목을 자동으로 골라 해석하는 영역입니다.</p>
                </div>
                <span className="detailBadge">{selectedWeek?.weekLabel || "-"}</span>
              </div>
              <div className="controversyGrid">
                <div className="controversyMetric"><span>추천 당시</span><strong>{formatPrice(controversialPick.selectedPrice)}</strong></div>
                <div className="controversyMetric"><span>현재가</span><strong>{formatPrice(controversialPick.currentPrice)}</strong></div>
                <div className="controversyMetric"><span>현재 수익률</span><strong className={getToneClass(controversialPick.returnRate)}>{formatPercent(controversialPick.returnRate)}</strong></div>
                <div className="controversyMetric"><span>당시 상승여력</span><strong className={getToneClass(controversialPick.upsideRaw)}>{controversialPick.upsideDisplay}</strong></div>
              </div>
              <div className="controversyReasonGrid">
                <div className="controversyReasonBox">
                  <h3>왜 주목됐나</h3>
                  <ul>
                    {Number.isFinite(controversialPick.upsideRaw) ? <li>당시 상승여력 {controversialPick.upsideDisplay}로 기대치가 높았습니다.</li> : null}
                    {Number.isFinite(controversialPick.totalScore) ? <li>추천 당시 총점 {controversialPick.totalScore}점으로 상위권에 포함되었습니다.</li> : null}
                    {Number.isFinite(controversialPick.currentUpsideRaw) ? <li>현재 상승여력은 {controversialPick.currentUpsideDisplay}로 변했습니다.</li> : null}
                  </ul>
                </div>
                <div className="controversyReasonBox soft">
                  <h3>현재 해석</h3>
                  <p>
                    기대 구간이 컸던 종목이라도 실제 성과는 시장 분위기와 업황, 개별 이벤트에 따라 크게 달라질 수 있습니다.
                    현재 수익률 {formatPercent(controversialPick.returnRate)}와 KOSPI 수익률 {formatPercent(selectedWeek?.benchmarkReturn)}를 함께 보면서,
                    모델이 단순히 시장 상승을 따라간 것인지, 정말 초과수익을 만들었는지를 구분해서 볼 필요가 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="noticeSection">
          <div className="noticeCard">
            <h2>모델 적용 시 주의사항</h2>
            <div className="noticeGrid">
              <div className="noticeItem"><strong>공기업 / 규제 산업</strong><span>정책 변수의 영향이 커서 추가 해석이 필요합니다.</span></div>
              <div className="noticeItem"><strong>금융주</strong><span>일반 제조업과 재무 해석 기준이 다를 수 있습니다.</span></div>
              <div className="noticeItem"><strong>지주사</strong><span>사업 구조상 단순 비교가 어려울 수 있습니다.</span></div>
              <div className="noticeItem"><strong>바이오 / 신약 개발</strong><span>이벤트 리스크가 커서 별도 판단이 필요합니다.</span></div>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        .container { max-width: 1180px; margin: 0 auto; padding: 18px 24px 80px; color: #0f172a; }
        .performanceCrossLink { display: inline-flex; margin-bottom: 16px; color: var(--color-primary); font-weight: 800; text-decoration: none; }
        .pageHero { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
        .badge, .methodBadge, .controversyBadge, .detailBadge { display: inline-flex; padding: 8px 14px; border-radius: 999px; font-size: 0.82rem; font-weight: 800; margin: 0 0 18px; }
        .badge { background: #eef2ff; color: #4f46e5; }
        .methodBadge { background: #ecfeff; color: #0891b2; }
        .controversyBadge, .detailBadge { background: #ecfeff; color: #0891b2; }
        h1 { margin: 0 0 12px; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.04em; }
        .desc { margin: 0; max-width: 760px; color: #475569; line-height: 1.8; font-size: 1.02rem; }
        .updateBox { min-width: 180px; padding: 16px 18px; border-radius: 18px; background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05); text-align: right; }
        .updateLabel { display: block; margin-bottom: 6px; color: #64748b; font-size: 0.88rem; font-weight: 700; }
        .updateBox strong { display: block; font-size: 1.15rem; color: #0f172a; }
        .methodSection, .kpiSection, .graphSection, .historySection, .detailSection, .trustSection, .pickSection, .controversySection, .noticeSection { margin-top: 24px; }
        .methodCard, .kpiCard, .graphCard, .sectionCard, .noticeCard, .pickCard, .controversyCard { border: 1px solid #e5e7eb; border-radius: 28px; padding: 24px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06); }
        .methodHeader h2, .graphCard h2, .sectionCard h2, .noticeCard h2, .pickCard h2, .controversyCard h2 { margin: 0 0 10px; font-size: 1.5rem; letter-spacing: -0.03em; }
        .methodGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .methodItem { border: 1px solid #e5e7eb; border-radius: 18px; padding: 18px; background: #ffffff; }
        .methodItem strong { display: block; margin-bottom: 8px; color: #0f172a; font-size: 1rem; }
        .methodItem span { color: #64748b; line-height: 1.75; font-size: 0.94rem; }
        .kpiGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .kpiLabel { display: block; margin-bottom: 10px; color: #64748b; font-size: 0.9rem; font-weight: 700; }
        .kpiCard strong { display: block; font-size: 2rem; line-height: 1; letter-spacing: -0.04em; margin-bottom: 10px; }
        .kpiCard p { margin: 0; color: #64748b; line-height: 1.7; font-size: 0.92rem; }
        .graphHeader, .detailHeader, .controversyHeader, .sectionHeaderInline { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .graphDesc, .detailDesc, .controversyDesc { margin: 0; color: #64748b; line-height: 1.7; }
        .legendWrap { display: flex; gap: 12px; flex-wrap: wrap; }
        .legendItem { display: inline-flex; align-items: center; gap: 6px; color: #475569; font-size: 0.92rem; font-weight: 700; }
        .legendLine { width: 22px; height: 0; border-top: 3px solid; display: inline-block; }
        .legendLine.strategy { border-color: #2563eb; }
        .legendLine.benchmark { border-color: #94a3b8; }
        .legendLine.excess { border-color: #14b8a6; border-top-style: dashed; }
        .chartWrap { width: 100%; overflow-x: auto; }
        .chartSvg { width: 100%; min-width: 860px; height: auto; display: block; }
        .gridLine { stroke: #e5e7eb; stroke-width: 1; }
        .gridLine.strong { stroke: #cbd5e1; }
        .zeroLine { stroke: #94a3b8; stroke-width: 1.5; stroke-dasharray: 6 6; }
        .chartLine { fill: none; stroke-width: 3; }
        .chartLine.strategy { stroke: #2563eb; }
        .chartLine.benchmark { stroke: #94a3b8; }
        .chartLine.excess { stroke: #14b8a6; stroke-dasharray: 10 8; }
        .gridLabel, .xLabel { fill: #94a3b8; font-size: 12px; }
        .tableWrap { overflow-x: auto; }
        .historyTable, .detailTable { width: 100%; border-collapse: collapse; }
        .historyTable th, .historyTable td, .detailTable th, .detailTable td { padding: 14px 10px; border-bottom: 1px solid #e5e7eb; text-align: left; white-space: nowrap; }
        .historyTable th, .detailTable th { color: #64748b; font-size: 0.86rem; font-weight: 800; }
        .historyTable td, .detailTable td { color: #0f172a; font-size: 0.95rem; }
        .tableNote { margin: 14px 0 0; color: #64748b; font-size: 0.92rem; line-height: 1.7; }
        .detailBtn { height: 38px; padding: 0 14px; border-radius: 12px; border: 1px solid #dbe3f0; background: #ffffff; color: #0f172a; font-weight: 800; cursor: pointer; }
        .detailBtn.active { background: #0f172a; color: #ffffff; border-color: #0f172a; }
        .benchmarkSummary { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; align-items: center; }
        .benchmarkSummary span { color: #64748b; font-size: 0.85rem; font-weight: 700; }
        .benchmarkSummary strong { font-size: 1rem; font-weight: 900; }
        .stockCell { display: flex; flex-direction: column; gap: 4px; }
        .stockCell strong { color: #0f172a; }
        .stockCell span { color: #64748b; font-size: 0.88rem; }
        .statusBadge { display: inline-flex; align-items: center; justify-content: center; padding: 7px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 800; white-space: nowrap; }
        .statusBadge.good { background: #ecfeff; color: #0891b2; }
        .statusBadge.warn { background: #fff7ed; color: #c2410c; }
        .statusBadge.mid { background: #fef3c7; color: #b45309; }
        .statusBadge.neutral { background: #f1f5f9; color: #475569; }
        .trustGrid, .pickGrid, .noticeGrid, .controversyReasonGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .trustItem, .pickItem, .noticeItem, .controversyMetric, .controversyReasonBox { border: 1px solid #e5e7eb; border-radius: 18px; padding: 16px; background: #ffffff; }
        .trustItemTop { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
        .pickRank { margin: 0 0 6px; color: #64748b; font-size: 0.84rem; font-weight: 800; }
        .trustItem h3 { margin: 0 0 6px; font-size: 1.2rem; letter-spacing: -0.02em; }
        .pickMetaLine, .pickMeta { margin: 0; color: #64748b; font-size: 0.9rem; }
        .trustMetricRow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
        .trustMetricBox { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px; background: #f8fafc; }
        .trustMetricBox span { display: block; margin-bottom: 8px; color: #64748b; font-size: 0.8rem; font-weight: 700; }
        .trustMetricBox strong { font-size: 1rem; font-weight: 900; }
        .badgeRow { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .smallBadge { display: inline-flex; align-items: center; justify-content: center; padding: 7px 11px; border-radius: 999px; font-size: 0.78rem; font-weight: 800; }
        .smallBadge.good { background: #ecfeff; color: #0891b2; }
        .smallBadge.warn { background: #fff7ed; color: #c2410c; }
        .smallBadge.muted { background: #f1f5f9; color: #475569; }
        .smallBadge.soft { background: #eef2ff; color: #4f46e5; }
        .smallBadge.info { background: #e0f2fe; color: #0284c7; }
        .trustReason { margin: 0; color: #475569; line-height: 1.75; }
        .pickList { display: grid; gap: 12px; }
        .pickItem { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
        .pickName { margin: 0 0 4px; font-weight: 800; color: #0f172a; }
        .pickItem strong { font-size: 1.05rem; font-weight: 900; flex-shrink: 0; }
        .controversyGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
        .controversyMetric span { display: block; margin-bottom: 8px; color: #64748b; font-size: 0.84rem; font-weight: 700; }
        .controversyMetric strong { font-size: 1.05rem; font-weight: 900; }
        .controversyReasonBox h3 { margin: 0 0 10px; font-size: 1.05rem; }
        .controversyReasonBox ul { margin: 0; padding-left: 18px; color: #475569; line-height: 1.8; }
        .controversyReasonBox p { margin: 0; color: #475569; line-height: 1.8; }
        .controversyReasonBox.soft { background: #f8fafc; }
        .noticeItem { display: flex; flex-direction: column; gap: 8px; }
        .noticeItem strong { font-size: 1rem; color: #0f172a; }
        .noticeItem span { color: #64748b; line-height: 1.7; }
        .tonePositive { color: #0ea5e9; }
        .toneNegative { color: #64748b; }
        .toneNeutral { color: #0f172a; }
        @media (max-width: 900px) {
          .methodGrid, .kpiGrid, .trustGrid, .pickGrid, .noticeGrid, .controversyGrid, .controversyReasonGrid, .benchmarkSummary, .trustMetricRow { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .container { padding: 24px 18px 64px; }
          .pageHero, .graphHeader, .detailHeader, .controversyHeader, .sectionHeaderInline { flex-direction: column; }
          .updateBox { width: 100%; text-align: left; }
          .methodCard, .kpiCard, .graphCard, .sectionCard, .noticeCard, .pickCard, .controversyCard { padding: 22px; }
        }
      `}</style>
    </>
  );
}
