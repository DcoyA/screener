"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import marketState from "../../data/market_state.json";
import etfUniverse from "../../data/etf_universe.json";
import { formatUpsidePercent } from "../../lib/formatUpside";
import { cleanStockName } from "../../lib/stockName";

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function formatPercentPlain(value) {
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

function getEligibleBand(value) {
  if (value >= 0.7) return "높음 · 조건 통과 종목이 넓게 분포";
  if (value >= 0.4) return "보통 · 선별적으로 접근할 구간";
  return "낮음 · 후보가 적어 보수 해석 필요";
}

function getScoreBand(value) {
  if (value >= 75) return "상대적으로 양호 · 상위 후보 질이 괜찮은 편";
  if (value >= 65) return "중립 · 아주 강한 구간은 아님";
  return "주의 · 점수 편차가 크거나 질이 약한 구간";
}

function getUpsideBand(value) {
  if (value >= 80) return "높음 · 적정가 대비 괴리가 큰 종목이 많음";
  if (value >= 30) return "보통 · 밸류 매력은 있으나 과열 해석은 금물";
  return "낮음 · 저평가 매력이 강하지 않은 구간";
}

function getLiquidityBand(value) {
  if (value >= 100_0000_0000) return "높음 · 실제 거래가 붙는 후보가 많은 편";
  if (value >= 30_0000_0000) return "보통 · 유동성은 무난한 편";
  return "낮음 · 점수 대비 체결/수급은 조심";
}

function getMomentumBand(value) {
  if (value >= 0.5) return "높음 · 단기 흐름 지지가 넓게 확인됨";
  if (value >= 0.2) return "보통 · 일부 종목만 모멘텀 확인";
  return "낮음 · 밸류는 있어도 속도는 약할 수 있음";
}

function getRiskBand(value) {
  if (value >= 0.6) return "높음 · 상위권이 특정 위험 특성에 몰릴 수 있음";
  if (value >= 0.3) return "보통 · 공통 리스크를 함께 체크할 구간";
  return "낮음 · 후보군이 한쪽 위험에 덜 쏠린 상태";
}

function buildUniverseMap(items) {
  return new Map((items || []).map((item) => [String(item.code), item]));
}

function normalizeTopHoldings(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,/]|\n/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function formatDateLabel(value) {
  if (!value) return "정보 없음";
  return value;
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

function getScoreBreakdown(rec, detail) {
  const chunks = [];
  if (rec?.type === "index") chunks.push("지수 분산형이라 현재 장 해석과 무난하게 맞음");
  if (rec?.type === "bond") chunks.push("리스크 축소 관점에서 가점 가능");
  if (rec?.sector && rec.sector !== "지수") chunks.push(`${rec.sector} 노출용 대안으로 분류`);
  if (detail?.priority !== undefined) chunks.push(`유니버스 우선순위 ${detail.priority}`);
  if (detail?.riskLevel) chunks.push(`리스크 수준 ${detail.riskLevel}`);
  return chunks.length ? chunks.join(" · ") : "현재 시장 상태와 ETF 유형/섹터 특성을 합쳐 만든 추천 점수입니다.";
}

export default function AlternativeTab() {
  const [showAllEtfs, setShowAllEtfs] = useState(false);

  const header = marketState?.header || {};
  const signals = marketState?.signals || {};
  const approachCards = marketState?.approachCards || [];
  const strategyNotes = marketState?.strategyNotes || [];
  const today = marketState?.today || {};
  const todayStock = today?.todayStock || null;
  const todayAlternative = today?.todayAlternative || null;
  const topSectors = marketState?.topSectors || { strong: [], weak: [] };
  const preferredModes = marketState?.preferredModes || [];
  const avoidModes = marketState?.avoidModes || [];
  const etfRecommendations = marketState?.etfRecommendations || [];

  const universeMap = useMemo(() => buildUniverseMap(etfUniverse || []), []);

  const mergedRecommendedEtfs = useMemo(() => {
    return etfRecommendations.map((rec, idx) => {
      const detail = universeMap.get(String(rec.code)) || {};
      return {
        ...detail,
        ...rec,
        _rank: idx + 1,
        topHoldings: normalizeTopHoldings(rec?.topHoldings || detail?.topHoldings || detail?.holdings),
        productsCount: Array.isArray(etfRecommendations) ? etfRecommendations.length : 0,
      };
    });
  }, [etfRecommendations, universeMap]);

  const universeRanked = useMemo(() => {
    const recommendedCodeSet = new Set(mergedRecommendedEtfs.map((item) => String(item.code)));
    const enriched = (etfUniverse || []).map((item) => {
      const rec = mergedRecommendedEtfs.find((v) => String(v.code) === String(item.code));
      return {
        ...item,
        ...(rec || {}),
        score: Number(rec?.score ?? item?.score ?? 0),
      };
    });

    enriched.sort((a, b) => {
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const priDiff = Number(b.priority || 0) - Number(a.priority || 0);
      if (priDiff !== 0) return priDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "ko");
    });

    return enriched.map((item, idx) => ({
      ...item,
      _rank: idx + 1,
      _isRecommended: recommendedCodeSet.has(String(item.code)),
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

  const signalGuide = [
    {
      key: "eligibleRatio",
      label: "종합 후보 비중",
      value: formatPercent(eligibleRatio * 100),
      method: "전체 분석 종목 중 종합 조건(topRankEligible) 통과 종목 비율",
      scope: "ETF 전체가 아니라 개별주 후보군 기준",
      meaning: getEligibleBand(eligibleRatio),
      action: "높을수록 개별주 후보가 넓게 퍼진 장, 낮을수록 선별 접근 필요",
    },
    {
      key: "avgTotalScore",
      label: "상위 평균 총점",
      value: `${avgTotalScore.toFixed(1)}점`,
      method: "상위 후보군의 totalScore 평균",
      scope: "현재 시장 상태를 읽기 위한 상위 종목 질 지표",
      meaning: getScoreBand(avgTotalScore),
      action: "70점 안팎 이상이면 상위권 질이 나쁘지 않은 편으로 해석",
    },
    {
      key: "avgUpside",
      label: "상위 평균 상승여력",
      value: formatUpsidePercent(avgUpside),
      method: "상위 후보군의 적정가 대비 upside 평균",
      scope: "상승 가능성 그 자체보다 밸류 괴리 참고용",
      meaning: getUpsideBand(avgUpside),
      action: "높아도 단기 실현 가능성과는 별개라 모멘텀/유동성과 함께 봐야 함",
    },
    {
      key: "avgLiquidity5d",
      label: "상위 평균 유동성",
      value: formatKrwCompact(avgLiquidity5d),
      method: "상위 후보군의 최근 5일 평균 거래대금 평균",
      scope: "좋아 보이는 종목에 실제 거래가 붙는지 확인하는 지표",
      meaning: getLiquidityBand(avgLiquidity5d),
      action: "낮으면 점수는 높아도 체결·수급 측면에서는 보수적으로 해석",
    },
    {
      key: "momentumSupportRatio",
      label: "모멘텀 지지 비율",
      value: formatPercent(momentumSupportRatio * 100),
      method: "상위 후보군 중 최근 흐름/반등/거래대금 증가 신호가 동반된 종목 비율",
      scope: "단기 진입 친화도에 가까운 지표",
      meaning: getMomentumBand(momentumSupportRatio),
      action: "낮으면 밸류는 있어도 지금 바로 탄력 있게 움직이는 장은 아닐 수 있음",
    },
    {
      key: "riskConcentration",
      label: "위험 집중도",
      value: formatPercent(riskConcentration * 100),
      method: "상위 후보군이 특정 위험 특성에 얼마나 몰려 있는지 보는 비율",
      scope: "상위권이 한쪽 위험에 쏠렸는지 체크",
      meaning: getRiskBand(riskConcentration),
      action: "높을수록 보기 좋은 점수 뒤에 공통 리스크가 숨어 있을 수 있음",
    },
  ];

  return (
    <>
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
            <p className="sectionDesc">
              이 숫자는 ETF 시장 전체 지표가 아니라, 오늘 분석한 <strong>개별주 후보군</strong>을 기준으로 계산한 시장 상태 요약값입니다.
              즉, “개별주 후보가 얼마나 넓게 분포하는지 / 상위권 질이 괜찮은지 / 실제 거래가 붙는지 / 단기 흐름이 살아있는지 / 공통 위험에 몰려 있는지”를 빠르게 읽기 위한 보조 지표입니다.
            </p>

            <div className="signalMetricGrid">
              <div className="metricCard"><span>종합 후보 비중</span><strong>{formatPercent(eligibleRatio * 100)}</strong></div>
              <div className="metricCard"><span>상위 평균 총점</span><strong>{avgTotalScore.toFixed(1)}점</strong></div>
              <div className="metricCard"><span>상위 평균 상승여력</span><strong>{formatUpsidePercent(avgUpside)}</strong></div>
              <div className="metricCard"><span>상위 평균 유동성</span><strong>{formatKrwCompact(avgLiquidity5d)}</strong></div>
              <div className="metricCard"><span>모멘텀 지지 비율</span><strong>{formatPercent(momentumSupportRatio * 100)}</strong></div>
              <div className="metricCard"><span>위험 집중도</span><strong>{formatPercent(riskConcentration * 100)}</strong></div>
            </div>

            <div className="signalHelpBox">
              <h3>이 숫자를 어떻게 읽어야 하나</h3>
              <ul>
                <li><strong>종합 후보 비중</strong>이 높으면 지금 시장에서 기본 조건을 통과하는 종목이 넓게 분포한다는 뜻입니다.</li>
                <li><strong>상위 평균 총점</strong>은 상위권 종목 질의 대략적인 평균값입니다. 70점 전후 이상이면 아주 나쁘진 않은 편으로 해석할 수 있습니다.</li>
                <li><strong>상위 평균 상승여력</strong>은 밸류 괴리를 보여주는 값이라, 그 자체만으로 단기 수익 확률을 뜻하지는 않습니다.</li>
                <li><strong>모멘텀 지지 비율</strong>이 낮다면, 싸 보이는 종목은 있어도 지금 바로 탄력 있게 움직이는 장은 아닐 수 있습니다.</li>
                <li><strong>위험 집중도</strong>가 높으면 상위권이 특정 위험 특성에 몰렸을 수 있으니, 좋아 보이는 숫자만 보고 진입하면 안 됩니다.</li>
              </ul>
            </div>

            <div className="guideGrid detailed">
              {signalGuide.map((item) => (
                <div className="guideItem detailItem" key={item.key}>
                  <div className="guideTopRow">
                    <strong>{item.label}</strong>
                    <span className="guideValue">{item.value}</span>
                  </div>
                  <p><b>기준</b> {item.scope}</p>
                  <p><b>산정방법</b> {item.method}</p>
                  <p><b>현재 해석</b> {item.meaning}</p>
                  <p><b>실전 해석</b> {item.action}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="approachSection">
          <div className="sectionCard">
            <span className="sectionLabel">APPROACH SCORE</span>
            <h2>오늘 유리한 접근 방식</h2>
            <p className="sectionDesc">상품 설명이 아니라, 지금 시장에서 어떤 방식이 상대적으로 유리한지 보여주는 영역입니다.</p>
            <div className="approachGrid">
              {approachCards.map((card) => (
                <div className="approachCard" key={card.label}>
                  <div className="approachHeader">
                    <h3>{card.label}</h3>
                    <span className={getStatusClass(card.status)}>{card.status}</span>
                  </div>
                  <p>{card.description}</p>
                  <div className="scoreText">판정 점수 {Number(card.score || 0).toFixed(1)}</div>
                </div>
              ))}
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

            <div className="signalHelpBox etfHelpBox">
              <h3>ETF 추천 점수는 뭘 뜻하나</h3>
              <ul>
                <li><strong>추천 점수</strong>는 절대평가가 아니라, 현재 시장 상태와 ETF 유형/섹터 적합도를 합쳐 만든 내부 점수입니다.</li>
                <li><strong>최고점수</strong>는 고정 공개값이 아니라 현재 추천 로직 내 상대 비교용이며, 추천 카드에서는 "몇 점 받았는지"와 함께 "왜 그 점수를 받았는지"를 같이 보여주도록 수정했습니다.</li>
                <li><strong>랭크</strong>는 현재 추천/유니버스 안에서의 상대 순위입니다. 추천 2점이라도 현재 장에서는 상위권일 수 있고, 강한 확신 구간이 아니라는 뜻일 수도 있습니다.</li>
                <li><strong>구성 종목 / 출시일 / 운용사 / 수익률</strong>은 JSON에 값이 있으면 보여주고, 없으면 "정보 없음"으로 표시됩니다. 즉 이 부분은 유니버스 데이터 품질이 올라갈수록 같이 좋아집니다.</li>
              </ul>
            </div>

            <div className="etfGrid wide">
              {(showAllEtfs ? visibleUniverse : mergedRecommendedEtfs).length ? (showAllEtfs ? visibleUniverse : mergedRecommendedEtfs).map((etf) => {
                const returnItems = getReturnItems(etf);
                return (
                  <div className={`etfCard rich ${etf._isRecommended ? "recommended" : ""}`} key={`${etf.code}-${etf._rank}`}>
                    <div className="etfHeaderRow">
                      <div>
                        <div className="etfMetaRow">
                          <span className="typeBadge">{getEtfTypeLabel(etf.type)}</span>
                          {etf.sector && etf.sector !== "지수" ? <span className="typeBadge soft">{etf.sector}</span> : null}
                          {etf._isRecommended ? <span className="typeBadge rank">추천</span> : null}
                        </div>
                        <h3>{etf.name}</h3>
                        <p className="codeLine">ETF 코드 {etf.code || "-"} · 유니버스 순위 #{etf._rank || "-"}</p>
                      </div>
                      <div className="scorePanel">
                        <span>추천 점수</span>
                        <strong>{Number(etf.score || 0).toFixed(1)}</strong>
                        <small>{getScoreMeaning(etf.score)}</small>
                      </div>
                    </div>

                    <div className="infoBlock emphasis">
                      <b>왜 추천?</b>
                      <p>{etf.reason || "현재 시장 상태상 대안 접근용 ETF"}</p>
                      <p className="subInfo">점수 설명: {getScoreBreakdown(etfRecommendations.find((v) => String(v.code) === String(etf.code)) || etf, etf)}</p>
                    </div>

                    <div className="detailGrid">
                      <div className="miniBox"><span>운용사</span><strong>{etf.manager || etf.provider || etf.operator || "정보 없음"}</strong></div>
                      <div className="miniBox"><span>출시일</span><strong>{formatDateLabel(etf.launchDate || etf.inceptionDate || etf.listedDate)}</strong></div>
                      <div className="miniBox"><span>기초/추종</span><strong>{etf.indexName || etf.benchmark || etf.desc || "정보 없음"}</strong></div>
                      <div className="miniBox"><span>리스크 수준</span><strong>{etf.riskLevel || "정보 없음"}</strong></div>
                    </div>

                    <div className="returnsBox">
                      <b>최근 수익률</b>
                      <div className="returnsRow">
                        {returnItems.map((ret) => (
                          <div className="returnItem" key={ret.label}>
                            <span>{ret.label}</span>
                            <strong>{formatPercentPlain(ret.value)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="compositionBox">
                      <b>구성 종목 / 포지션 성격</b>
                      {etf.topHoldings?.length ? (
                        <div className="holdingList">
                          {etf.topHoldings.slice(0, showAllEtfs ? 10 : 6).map((holding) => (
                            <span className="holdingChip" key={holding}>{holding}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="mutedText">구성 종목 정보 없음 — 유니버스 JSON에 topHoldings / holdings 필드를 넣으면 여기서 바로 보여줄 수 있습니다.</p>
                      )}
                    </div>

                    <div className="splitInfoGrid">
                      <div className="infoBlock"><b>특징</b><p>{etf.desc || "설명 없음"}</p></div>
                      <div className="infoBlock"><b>과거 성격</b><p>{etf.behavior || "행동 특성 정보 없음"}</p></div>
                    </div>
                  </div>
                );
              }) : <p className="emptyText">추천 가능한 ETF가 아직 생성되지 않았습니다.</p>}
            </div>
          </div>
        </section>

        <section className="sectorSection">
          <div className="sectionCard">
            <span className="sectionLabel">SECTOR VIEW</span>
            <h2>현재 상대적으로 포착되는 업종</h2>
            <p className="sectionDesc">상위 후보군 안에서 자주 포착되는 업종을 기준으로 강한 쪽을 간단히 참고할 수 있습니다.</p>
            <div className="chipRow">
              {topSectors?.strong?.length ? topSectors.strong.map((sector) => <span className="sectorChip" key={sector}>{sector}</span>) : <span className="mutedText">업종 데이터가 충분하지 않아 자동 분류를 생략했습니다.</span>}
            </div>
            <p className="noteText">이 영역은 업종 뉴스 요약이 아니라, 현재 상위 후보들이 어느 쪽에 몰리는지를 참고하는 용도입니다.</p>
          </div>
        </section>

        <section className="compareSection">
          <div className="sectionCard compareWrap">
            <span className="sectionLabel">TODAY PICK VS ALTERNATIVE</span>
            <h2>오늘의 1종목 vs 대안</h2>
            <p className="sectionDesc">개별주와 대안 접근을 동시에 보여줘서, 지금 어떤 방식이 더 적합한지 바로 판단할 수 있게 합니다.</p>
            <div className="compareGrid">
              <div className="compareCard">
                <h3>오늘의 1종목</h3>
                {todayStock ? (
                  <>
                    <h4>{cleanStockName(todayStock.name)}</h4>
                    <p className="codeLine">{todayStock.market} · {todayStock.code} · {todayStock.sector || "미분류"}</p>
                    <div className="metricInline">총점 <b>{Number(todayStock.totalScore || 0).toFixed(0)}점</b></div>
                    <div className="metricInline">상승여력 <b>{formatUpsidePercent(todayStock.upside)}</b></div>
                    <div className="metricInline">유동성 <b>{formatKrwCompact(todayStock.avgTradeValue5d)}</b></div>
                    <div className="infoBlock"><b>왜 지금 보는가</b><p>{todayStock.whyNow || todayStock.summary || "현재 기준으로 가장 균형이 좋은 종목입니다."}</p></div>
                    <Link href={`/stock/${todayStock.code}`} className="detailBtn">종목 상세 보기</Link>
                  </>
                ) : <p className="emptyText">오늘의 1종목 후보가 아직 생성되지 않았습니다.</p>}
              </div>
              <div className="compareCard">
                <h3>오늘의 대안</h3>
                {todayAlternative ? (
                  <>
                    <h4>{todayAlternative.label}</h4>
                    <div className="infoBlock"><b>왜 이게 대안인가</b><p>{todayAlternative.reason}</p></div>
                    <p className="noteText">현재 시장 톤이 {header?.marketTone || "중립"}으로 판정되었기 때문에, 개별주 외에도 {todayAlternative.label} 관점으로 접근하는 편이 더 무난할 수 있습니다.</p>
                    {mergedRecommendedEtfs.length ? <p className="metricInline">함께 볼 ETF <b>{mergedRecommendedEtfs[0].name}</b></p> : null}
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
            <p className="sectionDesc">시장 상태 자동 판정 결과를 사람이 이해하기 쉽게 정리한 요약 메모입니다.</p>
            <ul className="notesList">
              {strategyNotes.length ? strategyNotes.map((note, idx) => <li key={idx}>{note}</li>) : <li>전략 메모가 아직 없습니다.</li>}
            </ul>
            <p className="disclaimer">{marketState?.disclaimer || "본 결과는 참고용이며 특정 수익이나 매매를 보장하지 않습니다."}</p>
          </div>
        </section>

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
        .signalsSection, .approachSection, .etfSection, .sectorSection, .compareSection, .notesSection, .summarySection { margin-top:24px; }
        .signalMetricGrid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; margin-top:18px; }
        .metricCard { border:1px solid #e5e7eb; border-radius:18px; background:#fff; padding:18px; }
        .metricCard span { display:block; margin-bottom:10px; color:#64748b; font-size:.86rem; font-weight:700; }
        .metricCard strong { font-size:1.65rem; letter-spacing:-0.03em; }
        .signalHelpBox { margin-top:18px; padding:18px; border-radius:20px; background:#fffdfa; border:1px solid #fde68a; }
        .signalHelpBox h3 { margin:0 0 12px; }
        .signalHelpBox ul { margin:0; padding-left:18px; color:#475569; line-height:1.8; }
        .guideGrid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; margin-top:18px; }
        .guideGrid.detailed { grid-template-columns:repeat(2, minmax(0,1fr)); }
        .guideItem { border:1px solid #e5e7eb; border-radius:20px; padding:18px; background:#fff; }
        .guideTopRow { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:10px; }
        .guideValue { color:#0f172a; font-weight:900; }
        .detailItem p { margin:0 0 8px; color:#475569; line-height:1.7; font-size:.94rem; }
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
        .typeBadge, .sectorChip, .holdingChip { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:7px 11px; font-size:.8rem; font-weight:800; background:#eef2ff; color:#4f46e5; }
        .typeBadge.soft { background:#f1f5f9; color:#475569; }
        .typeBadge.rank { background:#dcfce7; color:#15803d; }
        .holdingChip { background:#f8fafc; color:#334155; border:1px solid #e2e8f0; }
        .etfMetaRow, .holdingList, .returnsRow { display:flex; gap:8px; flex-wrap:wrap; }
        .etfHeaderRow { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:14px; }
        .scorePanel { min-width:128px; border:1px solid #e5e7eb; border-radius:18px; padding:14px; background:#f8fbff; text-align:center; }
        .scorePanel span { display:block; margin-bottom:6px; color:#64748b; font-size:.84rem; font-weight:700; }
        .scorePanel strong { display:block; font-size:1.7rem; line-height:1; }
        .scorePanel small { display:block; margin-top:8px; color:#64748b; line-height:1.5; }
        .detailGrid, .splitInfoGrid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; margin-top:14px; }
        .miniBox { border:1px solid #e5e7eb; border-radius:16px; padding:14px; background:#f8fbff; }
        .miniBox span { display:block; margin-bottom:8px; color:#64748b; font-size:.84rem; font-weight:700; }
        .miniBox strong { font-size:.96rem; line-height:1.6; }
        .returnsBox, .compositionBox, .infoBlock.emphasis { margin-top:14px; padding:14px; border:1px solid #e5e7eb; border-radius:16px; background:#fff; }
        .returnsBox b, .compositionBox b, .infoBlock b { display:block; margin-bottom:8px; }
        .returnItem { min-width:88px; border:1px solid #e5e7eb; border-radius:14px; padding:10px 12px; background:#f8fbff; }
        .returnItem span { display:block; margin-bottom:6px; color:#64748b; font-size:.8rem; font-weight:700; }
        .returnItem strong { font-size:.95rem; }
        .emptyText, .mutedText { color:#64748b; }
        .compareWrap .compareGrid { margin-top:16px; }
        .detailBtn, .moreBtn { display:inline-flex; align-items:center; justify-content:center; height:42px; padding:0 14px; border-radius:12px; text-decoration:none; font-weight:800; }
        .detailBtn { background:#0f172a; color:#fff; margin-top:12px; }
        .moreBtn { background:#fff; color:#0f172a; border:1px solid #cbd5e1; cursor:pointer; }
        .notesList { margin:16px 0 0; padding-left:18px; color:#475569; line-height:1.8; }
        .disclaimer { margin-top:18px; color:#64748b; font-size:.92rem; }
        @media (max-width: 1000px) {
          .signalMetricGrid, .guideGrid, .guideGrid.detailed, .approachGrid, .etfGrid.wide, .compareGrid, .detailGrid, .splitInfoGrid { grid-template-columns:1fr; }
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
