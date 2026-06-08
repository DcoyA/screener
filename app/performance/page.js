"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import history from "../data/history.json";
import stocks from "../data/stocks.json";

function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

function formatIndex(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
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

function buildSeries(values, width, height, topPad = 24, bottomPad = 34, sidePad = 16) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return { points: [], labels: [], grid: [], minV: 0, maxV: 0, zeroY: 0 };

  const minV = Math.min(0, ...valid);
  const maxV = Math.max(0, ...valid);
  const range = maxV - minV || 1;
  const innerW = width - sidePad * 2;
  const innerH = height - topPad - bottomPad;

  const points = values.map((v, idx) => {
    const x = sidePad + (values.length === 1 ? innerW / 2 : (idx * innerW) / (values.length - 1));
    const y = topPad + ((maxV - (Number.isFinite(v) ? v : 0)) / range) * innerH;
    return { x, y, value: v };
  });

  const grid = [maxV, (maxV + minV) / 2, minV].map((v) => ({
    y: topPad + ((maxV - v) / range) * innerH,
    value: v,
  }));

  const zeroY = topPad + ((maxV - 0) / range) * innerH;
  return { points, grid, minV, maxV, zeroY };
}

export default function PerformancePage() {
  const latestDate = history[0]?.snapshotDate || "-";
  const latestBenchmarkClose = Number(history[0]?.benchmark?.close);
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState(history[0]?.snapshotDate || null);

  const currentPriceMap = useMemo(
    () => Object.fromEntries(stocks.map((item) => [item.code, item.metrics?.closePrice || 0])),
    []
  );
  const stockMap = useMemo(
    () => Object.fromEntries(stocks.map((item) => [item.code, item])),
    []
  );

  const performanceData = useMemo(() => {
    const weeklyRows = history.map((entry) => {
      const picks = (entry.top10 || []).map((pick) => {
        const currentStock = stockMap[pick.code];
        const currentPrice = Number(currentPriceMap[pick.code] || 0);
        const returnRate = calcReturnRate(pick.selectedPrice, currentPrice);
        return {
          ...pick,
          currentPrice,
          returnRate,
          currentTargetPrice: currentStock?.metrics?.targetPrice ?? null,
          currentUpside: currentStock?.metrics?.upside ?? null,
        };
      });

      const validReturns = picks.map((item) => item.returnRate).filter((v) => Number.isFinite(v));
      const avgReturn = validReturns.length ? validReturns.reduce((a, b) => a + b, 0) / validReturns.length : null;
      const winRate = validReturns.length ? (validReturns.filter((v) => v > 0).length / validReturns.length) * 100 : null;
      const bestReturn = validReturns.length ? Math.max(...validReturns) : null;
      const worstReturn = validReturns.length ? Math.min(...validReturns) : null;

      const benchmarkBase = Number(entry?.benchmark?.close);
      const benchmarkReturn = calcReturnRate(benchmarkBase, latestBenchmarkClose);
      const excessReturn = Number.isFinite(avgReturn) && Number.isFinite(benchmarkReturn)
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
      };
    });

    const allPicks = weeklyRows.flatMap((row) => row.picks);
    const allReturns = allPicks.map((item) => item.returnRate).filter((v) => Number.isFinite(v));
    const benchmarkReturns = weeklyRows.map((row) => row.benchmarkReturn).filter((v) => Number.isFinite(v));
    const excessReturns = weeklyRows.map((row) => row.excessReturn).filter((v) => Number.isFinite(v));

    const overallAvg = allReturns.length ? allReturns.reduce((a, b) => a + b, 0) / allReturns.length : null;
    const overallWinRate = allReturns.length ? (allReturns.filter((v) => v > 0).length / allReturns.length) * 100 : null;
    const overallBest = allReturns.length ? Math.max(...allReturns) : null;
    const overallWorst = allReturns.length ? Math.min(...allReturns) : null;
    const benchmarkAvg = benchmarkReturns.length ? benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length : null;
    const excessAvg = excessReturns.length ? excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length : null;

    const sortedByReturn = [...allPicks].filter((item) => Number.isFinite(item.returnRate)).sort((a, b) => b.returnRate - a.returnRate);
    const selectedWeek = weeklyRows.find((row) => row.snapshotDate === selectedSnapshotDate) || weeklyRows[0] || null;

    const chartRows = [...weeklyRows].slice().reverse().map((row) => ({
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

    return {
      weeklyRows,
      selectedWeek,
      chartRows,
      controversialPick,
      totalSnapshots: weeklyRows.length,
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
  }, [currentPriceMap, latestBenchmarkClose, selectedSnapshotDate, stockMap]);

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
        <div className="topLinks">
          <Link href="/" className="homeBtn">홈으로 가기</Link>
          <div className="subNav">
            <Link href="/ranking">랭킹</Link>
            <Link href="/risk">리스크</Link>
            <Link href="/reports">리포트</Link>
          </div>
        </div>

        <section className="pageHero">
          <div>
            <p className="badge">PERFORMANCE</p>
            <h1>성과/백테스트</h1>
            <p className="desc">
              추천 결과를 주차별로 기록하고, 시간이 지나면서 실제 성과를 공개하는 페이지입니다.
              <br />
              이제 KOSPI 기준수익률과 비교한 초과수익까지 함께 추적합니다.
            </p>
          </div>
          <div className="updateBox">
            <span className="updateLabel">최신 기록일</span>
            <strong>{latestDate}</strong>
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
              <span className="kpiLabel">최고 수익률</span>
              <strong className={getToneClass(performanceData.overallBest)}>{formatPercent(performanceData.overallBest)}</strong>
              <p>누적 기준 최고 성과 종목</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">최저 수익률</span>
              <strong className={getToneClass(performanceData.overallWorst)}>{formatPercent(performanceData.overallWorst)}</strong>
              <p>누적 기준 최저 성과 종목</p>
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
            <h2>주차별 성과 요약</h2>
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
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.weeklyRows.map((row) => (
                    <tr key={row.snapshotDate}>
                      <td>{row.snapshotDate}</td>
                      <td>{row.weekLabel}</td>
                      <td className={getToneClass(row.avgReturn)}>{formatPercent(row.avgReturn)}</td>
                      <td className={getToneClass(row.benchmarkReturn)}>{formatPercent(row.benchmarkReturn)}</td>
                      <td className={getToneClass(row.excessReturn)}>{formatPercent(row.excessReturn)}</td>
                      <td>{formatPercent(row.winRate)}</td>
                      <td>
                        <button type="button" className={`detailBtn ${selectedSnapshotDate === row.snapshotDate ? "active" : ""}`} onClick={() => setSelectedSnapshotDate(row.snapshotDate)}>보기</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tableNote">※ KOSPI 비교값은 각 스냅샷에 저장된 benchmark.close와 최신 스냅샷의 benchmark.close를 비교해 계산합니다.</p>
          </div>
        </section>

        {selectedWeek ? (
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
                      <th>추천가</th>
                      <th>현재가</th>
                      <th>수익률</th>
                      <th>당시 적정가</th>
                      <th>당시 상승여력</th>
                      <th>현재 상승여력</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWeek.picks.map((pick) => (
                      <tr key={`${selectedWeek.snapshotDate}-${pick.code}`}>
                        <td>{pick.rank}</td>
                        <td><div className="stockCell"><strong>{pick.name}</strong><span>{pick.market} · {pick.code}</span></div></td>
                        <td>{formatPrice(pick.selectedPrice)}</td>
                        <td>{formatPrice(pick.currentPrice)}</td>
                        <td className={getToneClass(pick.returnRate)}>{formatPercent(pick.returnRate)}</td>
                        <td>{formatPrice(pick.targetPrice)}</td>
                        <td className={getToneClass(pick.upside)}>{formatPercent(pick.upside)}</td>
                        <td className={getToneClass(pick.currentUpside)}>{formatPercent(pick.currentUpside)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
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
                <div className="controversyMetric"><span>당시 상승여력</span><strong className={getToneClass(controversialPick.upside)}>{formatPercent(controversialPick.upside)}</strong></div>
              </div>
              <div className="controversyReasonBox">
                <h3>왜 주목됐나</h3>
                <ul>
                  {Number.isFinite(controversialPick.upside) ? <li>당시 상승여력 {formatPercent(controversialPick.upside)}로 기대치가 높았습니다.</li> : null}
                  {Number.isFinite(controversialPick.totalScore) ? <li>추천 당시 총점 {controversialPick.totalScore}점으로 상위권에 포함되었습니다.</li> : null}
                  {Number.isFinite(controversialPick.currentUpside) ? <li>현재 상승여력은 {formatPercent(controversialPick.currentUpside)}로 변했습니다.</li> : null}
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
        .container { max-width: 1180px; margin: 0 auto; padding: 32px 24px 80px; color: #0f172a; }
        .topLinks { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 26px; flex-wrap: wrap; }
        .subNav { display: flex; gap: 14px; flex-wrap: wrap; }
        .subNav a { color: #475569; text-decoration: none; font-weight: 700; }
        .homeBtn { display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; padding: 12px 16px; text-decoration: none; font-weight: 800; border: 1px solid #0f172a; background: #0f172a; color: #fff; }
        .pageHero { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
        .badge { display: inline-flex; padding: 8px 14px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 0.82rem; font-weight: 800; margin: 0 0 18px; }
        h1 { margin: 0 0 12px; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.04em; }
        .desc { margin: 0; max-width: 760px; color: #475569; line-height: 1.8; font-size: 1.02rem; }
        .updateBox { min-width: 180px; padding: 16px 18px; border-radius: 18px; background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05); text-align: right; }
        .updateLabel { display: block; margin-bottom: 6px; color: #64748b; font-size: 0.88rem; font-weight: 700; }
        .kpiSection, .graphSection, .historySection, .detailSection, .pickSection, .controversySection, .noticeSection { margin-top: 24px; }
        .kpiGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .kpiCard, .graphCard, .sectionCard, .noticeCard, .pickCard, .controversyCard { border: 1px solid #e5e7eb; border-radius: 28px; padding: 24px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06); }
        .kpiLabel { display: block; margin-bottom: 10px; color: #64748b; font-size: 0.9rem; font-weight: 700; }
        .kpiCard strong { display: block; font-size: 2rem; line-height: 1; letter-spacing: -0.04em; margin-bottom: 10px; }
        .kpiCard p { margin: 0; color: #64748b; line-height: 1.7; font-size: 0.92rem; }
        .graphHeader, .detailHeader, .controversyHeader { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .graphCard h2, .sectionCard h2, .noticeCard h2, .pickCard h2, .controversyCard h2 { margin: 0 0 10px; font-size: 1.5rem; letter-spacing: -0.03em; }
        .graphDesc, .detailDesc, .controversyDesc { margin: 0; color: #64748b; line-height: 1.7; }
        .graphBadge, .detailBadge, .controversyBadge { display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 999px; background: #ecfeff; color: #0891b2; font-size: 0.84rem; font-weight: 800; }
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
        .pickGrid, .noticeGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .pickList { display: grid; gap: 12px; }
        .pickItem, .noticeItem, .controversyMetric, .controversyReasonBox { border: 1px solid #e5e7eb; border-radius: 18px; padding: 16px; background: #ffffff; }
        .pickItem { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
        .pickName { margin: 0 0 4px; font-weight: 800; color: #0f172a; }
        .pickMeta { margin: 0; color: #64748b; font-size: 0.9rem; }
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
          .kpiGrid, .pickGrid, .noticeGrid, .controversyGrid, .benchmarkSummary { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .container { padding: 24px 18px 64px; }
          .pageHero, .graphHeader, .detailHeader, .controversyHeader { flex-direction: column; }
          .updateBox { width: 100%; text-align: left; }
          .kpiCard, .graphCard, .sectionCard, .noticeCard, .pickCard, .controversyCard { padding: 22px; }
        }
      `}</style>
    </>
  );
}
 
