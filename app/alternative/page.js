"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useMemo, useState } from "react";
import marketStateData from "../data/market_state.json";
import etfUniverseData from "../data/etf_universe.json";
import MainNav from "../components/MainNav";

function asObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function formatKrwCompact(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  if (num >= 1_0000_0000_0000) return `${(num / 1_0000_0000_0000).toFixed(1)}조원`;
  if (num >= 1_0000_0000) return `${(num / 1_0000_0000).toFixed(0)}억원`;
  return `${num.toLocaleString("ko-KR")}원`;
}

function getStatusClass(status) {
  if (status === "유리") return "statusBadge good";
  if (status === "보수") return "statusBadge warn";
  return "statusBadge neutral";
}

function getToneClass(tone) {
  if (tone === "공격 가능") return "toneChip good";
  if (tone === "보수 우위") return "toneChip warn";
  if (tone === "분산 접근 우위") return "toneChip info";
  return "toneChip neutral";
}

function getEtfTypeLabel(type) {
  if (type === "sector") return "업종형";
  if (type === "index") return "지수형";
  if (type === "dividend") return "배당형";
  if (type === "bond") return "채권형";
  if (type === "commodity") return "원자재형";
  if (type === "global") return "글로벌형";
  if (type === "theme") return "테마형";
  return "기타";
}

function normalizeTopHoldings(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[|,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function formatDateLabel(value) {
  if (!value) return "정보 없음";
  return String(value);
}

function getReturnItems(item) {
  return [
    { label: "1개월", value: item?.return1m ?? item?.returns?.m1 ?? item?.perf?.m1 },
    { label: "3개월", value: item?.return3m ?? item?.returns?.m3 ?? item?.perf?.m3 },
    { label: "6개월", value: item?.return6m ?? item?.returns?.m6 ?? item?.perf?.m6 },
    { label: "1년", value: item?.return1y ?? item?.returns?.y1 ?? item?.perf?.y1 },
  ];
}

function getScoreMeaning(score) {
  const num = Number(score || 0);
  if (num >= 4) return "상위권 · 현재 시장 해석과 잘 맞는 편";
  if (num >= 3) return "양호 · 보조 대안으로 볼 수 있는 수준";
  if (num >= 2) return "중립 · 후보군 안에는 들지만 강한 확신 구간은 아님";
  if (num > 0) return "낮음 · 참고 후보 수준";
  return "미부여 · 자동 추천 점수 없음";
}

function buildUniverseMap(items) {
  return new Map(asArray(items).filter(Boolean).map((item) => [String(item?.code ?? ""), item]));
}

export default function AlternativePage() {
  const [showAllEtfs, setShowAllEtfs] = useState(false);

  const marketState = asObject(marketStateData, {});
  const etfUniverse = asArray(etfUniverseData);

  const header = asObject(marketState.header, {});
  const signals = asObject(marketState.signals, {});
  const approachCards = asArray(marketState.approachCards);
  const strategyNotes = asArray(marketState.strategyNotes);
  const today = asObject(marketState.today, {});
  const todayStock = asObject(today.todayStock, null);
  const todayAlternative = asObject(today.todayAlternative, null);
  const topSectors = asObject(marketState.topSectors, { strong: [], weak: [] });
  const preferredModes = asArray(marketState.preferredModes);
  const avoidModes = asArray(marketState.avoidModes);
  const etfRecommendations = asArray(marketState.etfRecommendations);

  const universeMap = useMemo(() => buildUniverseMap(etfUniverse), [etfUniverse]);

  const mergedRecommendedEtfs = useMemo(() => {
    return etfRecommendations.filter(Boolean).map((rec, idx) => {
      const detail = asObject(universeMap.get(String(rec?.code ?? "")), {});
      return {
        ...detail,
        ...rec,
        _rank: idx + 1,
        topHoldings: normalizeTopHoldings(rec?.topHoldings || detail?.topHoldings || detail?.holdings),
      };
    });
  }, [etfRecommendations, universeMap]);

  const universeRanked = useMemo(() => {
    const recommendedCodeSet = new Set(mergedRecommendedEtfs.map((item) => String(item?.code ?? "")));
    const enriched = etfUniverse.filter(Boolean).map((item) => {
      const rec = mergedRecommendedEtfs.find((v) => String(v?.code ?? "") === String(item?.code ?? ""));
      return {
        ...item,
        ...(rec || {}),
        score: Number(rec?.score ?? item?.score ?? 0),
      };
    });
    enriched.sort((a, b) => {
      const scoreDiff = Number(b?.score || 0) - Number(a?.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const priDiff = Number(b?.priority || 0) - Number(a?.priority || 0);
      if (priDiff !== 0) return priDiff;
      return String(a?.name || "").localeCompare(String(b?.name || ""), "ko");
    });
    return enriched.map((item, idx) => ({
      ...item,
      _rank: idx + 1,
      _isRecommended: recommendedCodeSet.has(String(item?.code ?? "")),
      topHoldings: normalizeTopHoldings(item?.topHoldings || item?.holdings),
    }));
  }, [etfUniverse, mergedRecommendedEtfs]);

  const visibleUniverse = showAllEtfs ? universeRanked : universeRanked.slice(0, 12);

  const eligibleRatio = Number(signals?.eligibleRatio || 0);
  const avgTotalScore = Number(signals?.avgTotalScore || 0);
  const avgUpside = Number(signals?.avgUpside || 0);
  const avgLiquidity5d = Number(signals?.avgLiquidity5d || 0);
  const momentumSupportRatio = Number(signals?.momentumSupportRatio || 0);
  const riskConcentration = Number(signals?.riskConcentration || 0);

  const etfCards = showAllEtfs ? visibleUniverse : mergedRecommendedEtfs;

  return (
    <>
      <main className="container">
        <div className="topLinks">
          <Link href="/" className="homeBtn">홈으로 가기</Link>
          <MainNav />
        </div>

        <section className="pageHero">
          <div>
            <p className="badge">ALTERNATIVE INVESTMENT</p>
            <h1>대안 투자</h1>
            <p className="desc">
              개별주 외에도 지금 시장에서 고려할 수 있는 접근 방식을 정리한 페이지입니다.
              오늘 시장이 개별주에 우호적인지, ETF/배당 같은 대안 접근이 더 나은지를 한 번에 볼 수 있습니다.
            </p>
          </div>
          <div className="heroSide">
            <div className="heroBox">
              <span className="metaLabel">시장 톤</span>
              <div className={getToneClass(header?.marketTone || "중립")}>{header?.marketTone || "중립"}</div>
            </div>
            <div className="heroBox">
              <span className="metaLabel">유리한 접근</span>
              <strong>{preferredModes.length ? preferredModes.join(" / ") : "-"}</strong>
            </div>
          </div>
        </section>

        <section className="summarySection">
          <div className="summaryCard">
            <span className="sectionLabel">TODAY SUMMARY</span>
            <h2>오늘 시장 한 줄 요약</h2>
            <p>{header?.summary || "현재 시장 상태를 해석할 수 있는 요약이 아직 없습니다."}</p>
            <div className="chipRow">
              {preferredModes.map((item) => <span key={item} className="toneChip info">{item}</span>)}
              {avoidModes.map((item) => <span key={item} className="toneChip warn">주의: {item}</span>)}
            </div>
          </div>
        </section>

        <section className="signalsSection">
          <div className="sectionCard">
            <span className="sectionLabel">MARKET SIGNALS</span>
            <h2>자동 판정 지표</h2>
            <div className="signalMetricGrid">
              <div className="metricCard"><span>종합 후보 비중</span><strong>{formatPercent(eligibleRatio * 100)}</strong></div>
              <div className="metricCard"><span>상위 평균 총점</span><strong>{avgTotalScore.toFixed(1)}점</strong></div>
              <div className="metricCard"><span>상위 평균 상승여력</span><strong>{formatPercent(avgUpside)}</strong></div>
              <div className="metricCard"><span>상위 평균 유동성</span><strong>{formatKrwCompact(avgLiquidity5d)}</strong></div>
              <div className="metricCard"><span>모멘텀 지지 비율</span><strong>{formatPercent(momentumSupportRatio * 100)}</strong></div>
              <div className="metricCard"><span>위험 집중도</span><strong>{formatPercent(riskConcentration * 100)}</strong></div>
            </div>
          </div>
        </section>

        <section className="approachSection">
          <div className="sectionCard">
            <span className="sectionLabel">APPROACH SCORE</span>
            <h2>오늘 유리한 접근 방식</h2>
            <div className="approachGrid">
              {approachCards.length ? approachCards.map((card, idx) => (
                <div className="approachCard" key={`${card?.label || 'card'}-${idx}`}>
                  <div className="approachHeader">
                    <h3>{card?.label || "접근 방식"}</h3>
                    <span className={getStatusClass(card?.status)}>{card?.status || "중립"}</span>
                  </div>
                  <p>{card?.description || "설명이 아직 없습니다."}</p>
                  <div className="scoreText">판정 점수 {Number(card?.score || 0).toFixed(1)}</div>
                </div>
              )) : <p className="emptyText">접근 방식 데이터가 아직 없습니다.</p>}
            </div>
          </div>
        </section>

        <section className="etfSection">
          <div className="sectionCard">
            <div className="sectionHeaderRow">
              <div>
                <span className="sectionLabel">ETF PICKS</span>
                <h2>오늘의 ETF 추천</h2>
                <p className="sectionDesc">현재 시장 상태를 기준으로, 개별주 대신 쓰기 좋은 ETF 대안을 자동 추천합니다.</p>
              </div>
              <button type="button" className="moreBtn" onClick={() => setShowAllEtfs((prev) => !prev)}>
                {showAllEtfs ? "추천 중심으로 보기" : `더보기 (${universeRanked.length}개 ETF)`}
              </button>
            </div>
            <div className="etfGrid wide">
              {etfCards.length ? etfCards.map((etf, idx) => {
                const returnItems = getReturnItems(etf);
                const safeCode = etf?.code ? String(etf.code) : "";
                return (
                  <div className={`etfCard rich ${etf?._isRecommended ? "recommended" : ""}`} key={`${safeCode || 'etf'}-${idx}`}>
                    <div className="etfHeaderRow">
                      <div>
                        <div className="etfMetaRow">
                          <span className="typeBadge">{getEtfTypeLabel(etf?.type)}</span>
                          {etf?.sector && etf.sector !== "지수" ? <span className="typeBadge soft">{etf.sector}</span> : null}
                          {etf?._isRecommended ? <span className="typeBadge rank">추천</span> : null}
                        </div>
                        <h3>{etf?.name || "이름 없음"}</h3>
                        <p className="codeLine">ETF 코드 {safeCode || "-"} · 유니버스 순위 #{etf?._rank || "-"}</p>
                      </div>
                      <div className="scorePanel">
                        <span>추천 점수</span>
                        <strong>{Number(etf?.score || 0).toFixed(1)}</strong>
                        <small>{getScoreMeaning(etf?.score)}</small>
                      </div>
                    </div>
                    <div className="infoBlock emphasis">
                      <b>왜 추천?</b>
                      <p>{etf?.reason || "현재 시장 상태상 대안 접근용 ETF"}</p>
                    </div>
                    <div className="detailGrid">
                      <div className="miniBox"><span>운용사</span><strong>{etf?.manager || etf?.provider || etf?.operator || "정보 없음"}</strong></div>
                      <div className="miniBox"><span>출시일</span><strong>{formatDateLabel(etf?.launchDate || etf?.inceptionDate || etf?.listedDate)}</strong></div>
                      <div className="miniBox"><span>기초/추종</span><strong>{etf?.indexName || etf?.benchmark || etf?.desc || "정보 없음"}</strong></div>
                      <div className="miniBox"><span>리스크 수준</span><strong>{etf?.riskLevel || "정보 없음"}</strong></div>
                    </div>
                    <div className="returnsBox">
                      <b>최근 수익률</b>
                      <div className="returnsRow">
                        {returnItems.map((ret) => (
                          <div className="returnItem" key={ret.label}>
                            <span>{ret.label}</span>
                            <strong>{formatPercent(ret.value)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="compositionBox">
                      <b>구성 종목 / 포지션 성격</b>
                      {asArray(etf?.topHoldings).length ? (
                        <div className="holdingList">
                          {asArray(etf?.topHoldings).slice(0, showAllEtfs ? 10 : 6).map((holding) => (
                            <span className="holdingChip" key={holding}>{holding}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="mutedText">구성 종목 정보 없음</p>
                      )}
                    </div>
                  </div>
                );
              }) : <p className="emptyText">추천 가능한 ETF가 아직 생성되지 않았습니다.</p>}
            </div>
          </div>
        </section>

        <section className="compareSection">
          <div className="sectionCard compareWrap">
            <span className="sectionLabel">TODAY PICK VS ALTERNATIVE</span>
            <h2>오늘의 1종목 vs 대안</h2>
            <div className="compareGrid">
              <div className="compareCard">
                <h3>오늘의 1종목</h3>
                {todayStock ? (
                  <>
                    <h4>{todayStock?.name || "종목 없음"}</h4>
                    <p className="codeLine">{todayStock?.market || "-"} · {todayStock?.code || "-"} · {todayStock?.sector || "미분류"}</p>
                    <div className="metricInline">총점 <b>{Number(todayStock?.totalScore || 0).toFixed(0)}점</b></div>
                    <div className="metricInline">상승여력 <b>{formatPercent(todayStock?.upside)}</b></div>
                    <div className="metricInline">유동성 <b>{formatKrwCompact(todayStock?.avgTradeValue5d)}</b></div>
                    <div className="infoBlock"><b>왜 지금 보는가</b><p>{todayStock?.whyNow || todayStock?.summary || "현재 기준으로 가장 균형이 좋은 종목입니다."}</p></div>
                    {todayStock?.code ? <a href={`/stock/${todayStock.code}`} className="detailBtn">종목 상세 보기</a> : null}
                  </>
                ) : <p className="emptyText">오늘의 1종목 후보가 아직 생성되지 않았습니다.</p>}
              </div>
              <div className="compareCard">
                <h3>오늘의 대안</h3>
                {todayAlternative ? (
                  <>
                    <h4>{todayAlternative?.label || "대안 없음"}</h4>
                    <div className="infoBlock"><b>왜 이게 대안인가</b><p>{todayAlternative?.reason || "설명 없음"}</p></div>
                    <p className="noteText">현재 시장 톤이 {header?.marketTone || "중립"}으로 판정되었기 때문에, 개별주 외에도 {todayAlternative?.label || "대안 접근"} 관점으로 접근하는 편이 더 무난할 수 있습니다.</p>
                  </>
                ) : <p className="emptyText">오늘의 대안 접근이 아직 생성되지 않았습니다.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="notesSection">
          <div className="sectionCard">
            <span className="sectionLabel">STRATEGY NOTES</span>
            <h2>오늘 전략 메모</h2>
            <ul className="notesList">
              {strategyNotes.length ? strategyNotes.map((note, idx) => <li key={idx}>{String(note)}</li>) : <li>전략 메모가 아직 없습니다.</li>}
            </ul>
            <p className="disclaimer">{marketState?.disclaimer || "본 결과는 참고용이며 특정 수익이나 매매를 보장하지 않습니다."}</p>
          </div>
        </section>
      </main>

      <style jsx>{`
        .container { max-width: 1180px; margin: 0 auto; padding: 32px 24px 88px; color: #0f172a; }
        .topLinks { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:26px; flex-wrap:wrap; }
        .homeBtn { display:inline-flex; align-items:center; justify-content:center; border-radius:14px; padding:12px 16px; text-decoration:none; font-weight:800; border:1px solid #0f172a; background:#0f172a; color:#fff; }
        .pageHero { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-bottom:24px; flex-wrap:wrap; }
        .badge, .sectionLabel { display:inline-flex; padding:8px 14px; border-radius:999px; background:#eef2ff; color:#4f46e5; font-size:.82rem; font-weight:800; }
        h1 { margin:14px 0 12px; font-size:clamp(2rem, 4vw, 3rem); letter-spacing:-0.04em; }
        h2 { margin:14px 0 12px; font-size:clamp(1.45rem, 2.6vw, 2rem); letter-spacing:-0.03em; }
        h3 { margin:0 0 10px; font-size:1.15rem; }
        h4 { margin:0 0 8px; font-size:1.05rem; }
        .desc, .sectionDesc, .noteText, .infoBlock p, .compareCard p, .summaryCard p, .subInfo { color:#475569; line-height:1.8; }
        .desc { max-width:760px; margin:0; }
        .heroSide { display:grid; gap:12px; min-width:290px; width:320px; }
        .heroBox, .summaryCard, .sectionCard { border:1px solid #e5e7eb; border-radius:28px; background:linear-gradient(180deg, #fff 0%, #f8fbff 100%); box-shadow:0 20px 50px rgba(15,23,42,.06); }
        .heroBox { padding:18px; }
        .summaryCard, .sectionCard { padding:24px; }
        .metaLabel { display:block; margin-bottom:8px; color:#64748b; font-size:.88rem; font-weight:700; }
        .toneChip { display:inline-flex; align-items:center; justify-content:center; padding:8px 12px; border-radius:999px; font-weight:800; font-size:.84rem; }
        .toneChip.good { background:#dcfce7; color:#15803d; }
        .toneChip.warn { background:#fff7ed; color:#c2410c; }
        .toneChip.info { background:#e0f2fe; color:#0284c7; }
        .toneChip.neutral { background:#f1f5f9; color:#475569; }
        .chipRow { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
        .signalsSection, .approachSection, .etfSection, .compareSection, .notesSection, .summarySection { margin-top:24px; }
        .signalMetricGrid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; margin-top:18px; }
        .metricCard { border:1px solid #e5e7eb; border-radius:18px; background:#fff; padding:18px; }
        .metricCard span { display:block; margin-bottom:10px; color:#64748b; font-size:.86rem; font-weight:700; }
        .metricCard strong { font-size:1.65rem; letter-spacing:-0.03em; }
        .approachGrid, .compareGrid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:14px; margin-top:16px; }
        .etfGrid { display:grid; gap:14px; margin-top:16px; }
        .etfGrid.wide { grid-template-columns:repeat(2, minmax(0,1fr)); }
        .approachCard, .etfCard, .compareCard { border:1px solid #e5e7eb; border-radius:22px; background:#fff; padding:18px; }
        .etfCard.rich.recommended { border-color:#93c5fd; box-shadow:0 0 0 3px rgba(59,130,246,.08); }
        .approachHeader, .sectionHeaderRow { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
        .sectionHeaderRow { flex-wrap:wrap; }
        .statusBadge { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:7px 11px; font-size:.8rem; font-weight:800; }
        .statusBadge.good { background:#ecfeff; color:#0891b2; }
        .statusBadge.warn { background:#fff7ed; color:#c2410c; }
        .statusBadge.neutral { background:#f1f5f9; color:#475569; }
        .scoreText, .metricInline, .codeLine { color:#0f172a; font-weight:700; }
        .scoreText { margin-top:12px; }
        .metricInline { margin:6px 0; }
        .typeBadge, .holdingChip { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:7px 11px; font-size:.8rem; font-weight:800; background:#eef2ff; color:#4f46e5; }
        .typeBadge.soft { background:#f1f5f9; color:#475569; }
        .typeBadge.rank { background:#dcfce7; color:#15803d; }
        .holdingChip { background:#f8fafc; color:#334155; border:1px solid #e2e8f0; }
        .etfMetaRow, .holdingList, .returnsRow { display:flex; gap:8px; flex-wrap:wrap; }
        .etfHeaderRow { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:14px; }
        .scorePanel { min-width:128px; border:1px solid #e5e7eb; border-radius:18px; padding:14px; background:#f8fbff; text-align:center; }
        .scorePanel span { display:block; margin-bottom:6px; color:#64748b; font-size:.84rem; font-weight:700; }
        .scorePanel strong { display:block; font-size:1.7rem; line-height:1; }
        .scorePanel small { display:block; margin-top:8px; color:#64748b; line-height:1.5; }
        .detailGrid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; margin-top:14px; }
        .miniBox, .returnsBox, .compositionBox, .infoBlock.emphasis, .infoBlock { margin-top:14px; padding:14px; border:1px solid #e5e7eb; border-radius:16px; background:#fff; }
        .miniBox span { display:block; margin-bottom:8px; color:#64748b; font-size:.84rem; font-weight:700; }
        .miniBox strong { font-size:.96rem; line-height:1.6; }
        .returnsBox b, .compositionBox b, .infoBlock b { display:block; margin-bottom:8px; }
        .returnItem { min-width:88px; border:1px solid #e5e7eb; border-radius:14px; padding:10px 12px; background:#f8fbff; }
        .returnItem span { display:block; margin-bottom:6px; color:#64748b; font-size:.8rem; font-weight:700; }
        .returnItem strong { font-size:.95rem; }
        .emptyText, .mutedText { color:#64748b; }
        .detailBtn, .moreBtn { display:inline-flex; align-items:center; justify-content:center; height:42px; padding:0 14px; border-radius:12px; text-decoration:none; font-weight:800; }
        .detailBtn { background:#0f172a; color:#fff; margin-top:12px; }
        .moreBtn { background:#fff; color:#0f172a; border:1px solid #cbd5e1; cursor:pointer; }
        .notesList { margin:16px 0 0; padding-left:18px; color:#475569; line-height:1.8; }
        .disclaimer { margin-top:18px; color:#64748b; font-size:.92rem; }
        @media (max-width: 1000px) {
          .signalMetricGrid, .approachGrid, .etfGrid.wide, .compareGrid, .detailGrid { grid-template-columns:1fr; }
          .heroSide { width:100%; min-width:0; }
        }
        @media (max-width: 640px) {
          .container { padding:24px 18px 64px; }
          .summaryCard, .sectionCard, .heroBox { padding:20px; }
          .scorePanel, .moreBtn, .detailBtn { width:100%; }
          .etfHeaderRow, .sectionHeaderRow { flex-direction:column; }
        }
      `}</style>
    </>
  );
}
