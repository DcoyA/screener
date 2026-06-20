"use client";

import Link from "next/link";
import marketState from "../data/market_state.json";
import MainNav from "../components/MainNav";

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

export default function AlternativePage() {
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
      value: formatPercent(avgUpside),
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
            <p className="sectionDesc">
              이 숫자는 ETF 시장 전체 지표가 아니라, 오늘 분석한 <strong>개별주 후보군</strong>을 기준으로 계산한 시장 상태 요약값입니다.
              즉, “개별주 후보가 얼마나 넓게 분포하는지 / 상위권 질이 괜찮은지 / 실제 거래가 붙는지 / 단기 흐름이 살아있는지 / 공통 위험에 몰려 있는지”를 빠르게 읽기 위한 보조 지표입니다.
            </p>

            <div className="signalMetricGrid">
              <div className="metricCard"><span>종합 후보 비중</span><strong>{formatPercent(eligibleRatio * 100)}</strong></div>
              <div className="metricCard"><span>상위 평균 총점</span><strong>{avgTotalScore.toFixed(1)}점</strong></div>
              <div className="metricCard"><span>상위 평균 상승여력</span><strong>{formatPercent(avgUpside)}</strong></div>
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
            <span className="sectionLabel">ETF PICKS</span>
            <h2>오늘의 ETF 추천</h2>
            <p className="sectionDesc">현재 시장 상태를 기준으로, 개별주 대신 쓰기 좋은 ETF 대안을 자동 추천합니다.</p>
            <div className="etfGrid">
              {etfRecommendations.length ? etfRecommendations.map((etf) => (
                <div className="etfCard" key={etf.code || etf.name}>
                  <div className="etfMetaRow">
                    <span className="typeBadge">{getEtfTypeLabel(etf.type)}</span>
                    {etf.sector && etf.sector !== "지수" ? <span className="typeBadge soft">{etf.sector}</span> : null}
                  </div>
                  <h3>{etf.name}</h3>
                  <p className="codeLine">ETF 코드 {etf.code || "-"}</p>
                  <p className="scoreText">추천 점수 {Number(etf.score || 0).toFixed(0)}</p>
                  <div className="infoBlock"><b>왜 추천?</b><p>{etf.reason || "현재 시장 상태상 대안 접근용 ETF"}</p></div>
                  <div className="infoBlock"><b>특징</b><p>{etf.desc || "설명 없음"}</p></div>
                  <div className="infoBlock"><b>과거 성격</b><p>{etf.behavior || "행동 특성 정보 없음"}</p></div>
                </div>
              )) : <p className="emptyText">추천 가능한 ETF가 아직 생성되지 않았습니다.</p>}
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
                    <h4>{todayStock.name}</h4>
                    <p className="codeLine">{todayStock.market} · {todayStock.code} · {todayStock.sector || "미분류"}</p>
                    <div className="metricInline">총점 <b>{Number(todayStock.totalScore || 0).toFixed(0)}점</b></div>
                    <div className="metricInline">상승여력 <b>{formatPercent(todayStock.upside)}</b></div>
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
                    {etfRecommendations.length ? <p className="metricInline">함께 볼 ETF <b>{etfRecommendations[0].name}</b></p> : null}
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
        .desc, .sectionDesc, .noteText, .infoBlock p, .compareCard p, .summaryCard p { color:#475569; line-height:1.8; }
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
        .approachGrid, .etfGrid, .compareGrid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:14px; margin-top:16px; }
        .approachCard, .etfCard, .compareCard { border:1px solid #e5e7eb; border-radius:22px; background:#fff; padding:18px; }
        .approachHeader { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; }
        .statusBadge { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:7px 11px; font-size:.8rem; font-weight:800; }
        .statusBadge.good { background:#ecfeff; color:#0891b2; }
        .statusBadge.warn { background:#fff7ed; color:#c2410c; }
        .statusBadge.neutral { background:#f1f5f9; color:#475569; }
        .scoreText, .metricInline, .codeLine { color:#0f172a; font-weight:700; }
        .scoreText { margin-top:12px; }
        .metricInline { margin:6px 0; }
        .typeBadge, .sectorChip { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:7px 11px; font-size:.8rem; font-weight:800; background:#eef2ff; color:#4f46e5; }
        .typeBadge.soft { background:#f1f5f9; color:#475569; }
        .etfMetaRow { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
        .infoBlock { margin-top:12px; }
        .infoBlock b { display:block; margin-bottom:6px; }
        .emptyText, .mutedText { color:#64748b; }
        .compareWrap .compareGrid { margin-top:16px; }
        .detailBtn { display:inline-flex; align-items:center; justify-content:center; height:42px; padding:0 14px; border-radius:12px; text-decoration:none; background:#0f172a; color:#fff; font-weight:800; margin-top:12px; }
        .notesList { margin:16px 0 0; padding-left:18px; color:#475569; line-height:1.8; }
        .disclaimer { margin-top:18px; color:#64748b; font-size:.92rem; }
        @media (max-width: 900px) {
          .signalMetricGrid, .guideGrid, .guideGrid.detailed, .approachGrid, .etfGrid, .compareGrid { grid-template-columns:1fr; }
          .heroSide { width:100%; min-width:0; }
        }
        @media (max-width: 640px) {
          .container { padding:24px 18px 64px; }
          .summaryCard, .sectionCard, .heroBox { padding:20px; }
        }
      `}</style>
    </>
  );
}
