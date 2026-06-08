"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import history from "../data/history.json";
import stocks from "../data/stocks.json";

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

function calcReturnRate(selectedPrice, currentPrice) {
  const base = Number(selectedPrice || 0);
  const now = Number(currentPrice || 0);
  if (!base || !now) return null;
  return ((now - base) / base) * 100;
}

function getToneClass(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "toneNeutral";
  if (num > 0) return "tonePositive";
  if (num < 0) return "toneNegative";
  return "toneNeutral";
}

export default function PerformancePage() {
  const latestDate = history[0]?.snapshotDate || "-";
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState(history[0]?.snapshotDate || null);

  useEffect(() => {
    if (!selectedSnapshotDate && history[0]?.snapshotDate) {
      setSelectedSnapshotDate(history[0].snapshotDate);
    }
  }, [selectedSnapshotDate]);

  const currentPriceMap = useMemo(() => {
    return Object.fromEntries(
      stocks.map((item) => [item.code, item.metrics?.closePrice || 0])
    );
  }, []);

  const performanceData = useMemo(() => {
    const weeklyRows = history.map((entry) => {
      const picks = (entry.top10 || []).map((pick) => {
        const currentStock = stocks.find((item) => item.code === pick.code);
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

      const validReturns = picks
        .map((item) => item.returnRate)
        .filter((value) => Number.isFinite(value));

      const avgReturn = validReturns.length
        ? validReturns.reduce((acc, cur) => acc + cur, 0) / validReturns.length
        : null;

      const winCount = validReturns.filter((value) => value > 0).length;
      const loseCount = validReturns.filter((value) => value < 0).length;
      const winRate = validReturns.length ? (winCount / validReturns.length) * 100 : null;
      const bestReturn = validReturns.length ? Math.max(...validReturns) : null;
      const worstReturn = validReturns.length ? Math.min(...validReturns) : null;

      return {
        snapshotDate: entry.snapshotDate,
        weekLabel: entry.weekLabel,
        picks,
        count: picks.length,
        avgReturn,
        winRate,
        winCount,
        loseCount,
        bestReturn,
        worstReturn,
      };
    });

    const allPicks = weeklyRows.flatMap((row) => row.picks);
    const allReturns = allPicks
      .map((item) => item.returnRate)
      .filter((value) => Number.isFinite(value));

    const overallAvg = allReturns.length
      ? allReturns.reduce((acc, cur) => acc + cur, 0) / allReturns.length
      : null;
    const overallWinRate = allReturns.length
      ? (allReturns.filter((value) => value > 0).length / allReturns.length) * 100
      : null;
    const overallBest = allReturns.length ? Math.max(...allReturns) : null;
    const overallWorst = allReturns.length ? Math.min(...allReturns) : null;

    const sortedByReturn = [...allPicks]
      .filter((item) => Number.isFinite(item.returnRate))
      .sort((a, b) => b.returnRate - a.returnRate);

    const selectedWeek = weeklyRows.find((row) => row.snapshotDate === selectedSnapshotDate) || weeklyRows[0] || null;

    return {
      weeklyRows,
      overallAvg,
      overallWinRate,
      overallBest,
      overallWorst,
      totalSnapshots: weeklyRows.length,
      totalPicks: allPicks.length,
      bestPicks: sortedByReturn.slice(0, 3),
      worstPicks: [...sortedByReturn].reverse().slice(0, 3),
      selectedWeek,
    };
  }, [currentPriceMap, selectedSnapshotDate]);

  const selectedWeek = performanceData.selectedWeek;

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">
            홈으로 가기
          </Link>

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
              현재는 history.json에 축적된 추천 당시 가격과 현재 가격을 비교한 기준으로 보여줍니다.
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
              <span className="kpiLabel">전체 평균 수익률</span>
              <strong className={getToneClass(performanceData.overallAvg)}>
                {formatPercent(performanceData.overallAvg)}
              </strong>
              <p>history 기준 전체 추천 종목 평균</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">전체 승률</span>
              <strong>{formatPercent(performanceData.overallWinRate)}</strong>
              <p>수익률이 플러스인 종목 비율</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">최고 수익률</span>
              <strong className={getToneClass(performanceData.overallBest)}>
                {formatPercent(performanceData.overallBest)}
              </strong>
              <p>누적 기준 최고 성과 종목</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">최저 수익률</span>
              <strong className={getToneClass(performanceData.overallWorst)}>
                {formatPercent(performanceData.overallWorst)}
              </strong>
              <p>누적 기준 최저 성과 종목</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">누적 주차 수</span>
              <strong>{performanceData.totalSnapshots}회</strong>
              <p>축적된 추천 스냅샷 수</p>
            </div>
            <div className="kpiCard">
              <span className="kpiLabel">누적 추천 종목 수</span>
              <strong>{performanceData.totalPicks}종목</strong>
              <p>top10 누적 집계 기준</p>
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
                    <th>추천 수</th>
                    <th>평균 수익률</th>
                    <th>승률</th>
                    <th>최고</th>
                    <th>최저</th>
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.weeklyRows.map((row) => (
                    <tr key={row.snapshotDate}>
                      <td>{row.snapshotDate}</td>
                      <td>{row.weekLabel}</td>
                      <td>{row.count}</td>
                      <td className={getToneClass(row.avgReturn)}>{formatPercent(row.avgReturn)}</td>
                      <td>{formatPercent(row.winRate)}</td>
                      <td className={getToneClass(row.bestReturn)}>{formatPercent(row.bestReturn)}</td>
                      <td className={getToneClass(row.worstReturn)}>{formatPercent(row.worstReturn)}</td>
                      <td>
                        <button
                          type="button"
                          className={`detailBtn ${selectedSnapshotDate === row.snapshotDate ? "active" : ""}`}
                          onClick={() => setSelectedSnapshotDate(row.snapshotDate)}
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tableNote">
              ※ 현재 수익률은 추천 당시 selectedPrice와 현재 stocks.json의 최근 종가를 비교한 기준입니다.
            </p>
          </div>
        </section>

        {selectedWeek ? (
          <section className="detailSection">
            <div className="sectionCard">
              <div className="detailHeader">
                <div>
                  <h2>{selectedWeek.weekLabel} 상세 성과</h2>
                  <p className="detailDesc">
                    추천 당시 가격, 현재 가격, 실제 수익률과 당시 상승여력을 함께 보여줍니다.
                  </p>
                </div>
                <span className="detailBadge">기준일 {selectedWeek.snapshotDate}</span>
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
                        <td>
                          <div className="stockCell">
                            <strong>{pick.name}</strong>
                            <span>{pick.market} · {pick.code}</span>
                          </div>
                        </td>
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
                    <strong className={getToneClass(item.returnRate)}>
                      {formatPercent(item.returnRate)}
                    </strong>
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
                    <strong className={getToneClass(item.returnRate)}>
                      {formatPercent(item.returnRate)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="noticeSection">
          <div className="noticeCard">
            <h2>모델 적용 시 주의사항</h2>
            <div className="noticeGrid">
              <div className="noticeItem">
                <strong>공기업 / 규제 산업</strong>
                <span>정책 변수의 영향이 커서 추가 해석이 필요합니다.</span>
              </div>
              <div className="noticeItem">
                <strong>금융주</strong>
                <span>일반 제조업과 재무 해석 기준이 다를 수 있습니다.</span>
              </div>
              <div className="noticeItem">
                <strong>지주사</strong>
                <span>사업 구조상 단순 비교가 어려울 수 있습니다.</span>
              </div>
              <div className="noticeItem">
                <strong>바이오 / 신약 개발</strong>
                <span>이벤트 리스크가 커서 별도 판단이 필요합니다.</span>
              </div>
            </div>
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
        .subNav {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .subNav a {
          color: #475569;
          text-decoration: none;
          font-weight: 700;
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
          margin-bottom: 28px;
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
        .updateBox {
          min-width: 180px;
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
        .kpiSection,
        .historySection,
        .detailSection,
        .pickSection,
        .noticeSection {
          margin-top: 24px;
        }
        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .kpiCard,
        .sectionCard,
        .noticeCard,
        .pickCard {
          border: 1px solid #e5e7eb;
          border-radius: 28px;
          padding: 24px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
        }
        .kpiLabel {
          display: block;
          margin-bottom: 10px;
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 700;
        }
        .kpiCard strong {
          display: block;
          font-size: 2rem;
          line-height: 1;
          letter-spacing: -0.04em;
          margin-bottom: 10px;
        }
        .kpiCard p {
          margin: 0;
          color: #64748b;
          line-height: 1.7;
          font-size: 0.92rem;
        }
        .sectionCard h2,
        .noticeCard h2,
        .pickCard h2 {
          margin: 0 0 18px;
          font-size: 1.5rem;
          letter-spacing: -0.03em;
        }
        .tableWrap {
          overflow-x: auto;
        }
        .historyTable,
        .detailTable {
          width: 100%;
          border-collapse: collapse;
        }
        .historyTable th,
        .historyTable td,
        .detailTable th,
        .detailTable td {
          padding: 14px 10px;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
          white-space: nowrap;
        }
        .historyTable th,
        .detailTable th {
          color: #64748b;
          font-size: 0.86rem;
          font-weight: 800;
        }
        .historyTable td,
        .detailTable td {
          color: #0f172a;
          font-size: 0.95rem;
        }
        .tableNote {
          margin: 14px 0 0;
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.7;
        }
        .detailHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .detailDesc {
          margin: 0;
          color: #64748b;
          line-height: 1.7;
        }
        .detailBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: #ecfeff;
          color: #0891b2;
          font-size: 0.84rem;
          font-weight: 800;
        }
        .detailBtn {
          height: 38px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid #dbe3f0;
          background: #ffffff;
          color: #0f172a;
          font-weight: 800;
          cursor: pointer;
        }
        .detailBtn.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }
        .stockCell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stockCell strong {
          color: #0f172a;
        }
        .stockCell span {
          color: #64748b;
          font-size: 0.88rem;
        }
        .pickGrid,
        .noticeGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .pickList {
          display: grid;
          gap: 12px;
        }
        .pickItem,
        .noticeItem {
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 16px;
          background: #ffffff;
        }
        .pickItem {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
        }
        .pickName {
          margin: 0 0 4px;
          font-weight: 800;
          color: #0f172a;
        }
        .pickMeta {
          margin: 0;
          color: #64748b;
          font-size: 0.9rem;
        }
        .pickItem strong {
          font-size: 1.05rem;
          font-weight: 900;
          flex-shrink: 0;
        }
        .noticeItem {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .noticeItem strong {
          font-size: 1rem;
          color: #0f172a;
        }
        .noticeItem span {
          color: #64748b;
          line-height: 1.7;
        }
        .tonePositive {
          color: #0ea5e9;
        }
        .toneNegative {
          color: #64748b;
        }
        .toneNeutral {
          color: #0f172a;
        }
        @media (max-width: 900px) {
          .kpiGrid,
          .pickGrid,
          .noticeGrid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .container {
            padding: 24px 18px 64px;
          }
          .pageHero,
          .detailHeader {
            flex-direction: column;
          }
          .updateBox {
            width: 100%;
            text-align: left;
          }
          .kpiCard,
          .sectionCard,
          .noticeCard,
          .pickCard {
            padding: 22px;
          }
        }
      `}</style>
    </>
  );
}
