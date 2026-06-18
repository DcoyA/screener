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
  return "기타";
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
          <div className="heroMetaCardWrap">
            <div className="heroMetaCard main">
              <span className="metaLabel">시장 톤</span>
              <strong>{header?.marketTone || "-"}</strong>
              <span className={getToneClass(header?.marketTone)}>{header?.marketTone || "중립"}</span>
            </div>
            <div className="heroMetaCard">
              <span className="metaLabel">유리한 접근</span>
              <strong>{preferredModes.length ? preferredModes.join(" / ") : "-"}</strong>
            </div>
          </div>
        </section>

        <section className="summarySection">
          <div className="summaryCard">
            <div className="summaryHeader">
              <div>
                <p className="sectionEyebrow">TODAY SUMMARY</p>
                <h2>오늘 시장 한 줄 요약</h2>
              </div>
            </div>
            <p className="summaryLead">{header?.summary || "현재 시장 상태를 해석할 수 있는 요약이 아직 없습니다."}</p>
            <div className="chipRow">
              {preferredModes.map((item) => (
                <span className="smallChip good" key={`pref-${item}`}>{item}</span>
              ))}
              {avoidModes.map((item) => (
                <span className="smallChip warn" key={`avoid-${item}`}>{item}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="signalSection">
          <div className="sectionCard">
            <div className="sectionHeader">
              <div>
                <p className="sectionEyebrow">MARKET SIGNALS</p>
                <h2>자동 판정 지표</h2>
                <p className="sectionDesc">상위 후보군의 점수, 상승여력, 유동성, 위험 집중도를 바탕으로 현재 시장 성격을 자동 판정합니다.</p>
              </div>
            </div>
            <div className="signalGrid">
              <div className="signalItem">
                <span>종합 후보 비중</span>
                <strong>{formatPercent(Number(signals?.eligibleRatio || 0) * 100)}</strong>
              </div>
              <div className="signalItem">
                <span>상위 평균 총점</span>
                <strong>{Number(signals?.avgTotalScore || 0).toFixed(1)}점</strong>
              </div>
              <div className="signalItem">
                <span>상위 평균 상승여력</span>
                <strong>{formatPercent(signals?.avgUpside)}</strong>
              </div>
              <div className="signalItem">
                <span>상위 평균 유동성</span>
                <strong>{formatKrwCompact(signals?.avgLiquidity5d)}</strong>
              </div>
              <div className="signalItem">
                <span>모멘텀 지지 비율</span>
                <strong>{formatPercent(Number(signals?.momentumSupportRatio || 0) * 100)}</strong>
              </div>
              <div className="signalItem">
                <span>위험 집중도</span>
                <strong>{formatPercent(Number(signals?.riskConcentration || 0) * 100)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="approachSection">
          <div className="sectionCard">
            <div className="sectionHeader">
              <div>
                <p className="sectionEyebrow">APPROACH SCORE</p>
                <h2>오늘 유리한 접근 방식</h2>
                <p className="sectionDesc">상품 설명이 아니라, 지금 시장에서 어떤 방식이 상대적으로 유리한지 보여주는 영역입니다.</p>
              </div>
            </div>
            <div className="approachGrid">
              {approachCards.map((card) => (
                <div className="approachItem" key={card.key}>
                  <div className="approachTop">
                    <div>
                      <h3>{card.label}</h3>
                      <p className="approachDesc">{card.description}</p>
                    </div>
                    <span className={getStatusClass(card.status)}>{card.status}</span>
                  </div>
                  <div className="scoreBox">
                    <span>판정 점수</span>
                    <strong>{Number(card.score || 0).toFixed(1)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="etfSection">
          <div className="sectionCard">
            <div className="sectionHeader">
              <div>
                <p className="sectionEyebrow">ETF PICKS</p>
                <h2>오늘의 ETF 추천</h2>
                <p className="sectionDesc">현재 시장 상태를 기준으로, 개별주 대신 쓰기 좋은 ETF 대안을 자동 추천합니다.</p>
              </div>
            </div>
            <div className="etfGrid">
              {etfRecommendations.length ? etfRecommendations.map((etf) => (
                <div className="etfCard" key={etf.code || etf.name}>
                  <div className="etfTop">
                    <div>
                      <div className="chipRow compact">
                        <span className="smallChip info">{getEtfTypeLabel(etf.type)}</span>
                        {etf.sector && etf.sector !== "지수" ? <span className="smallChip neutral">{etf.sector}</span> : null}
                      </div>
                      <h3>{etf.name}</h3>
                      <p className="etfCode">ETF 코드 {etf.code || "-"}</p>
                    </div>
                    <div className="scoreBox narrow">
                      <span>추천 점수</span>
                      <strong>{Number(etf.score || 0).toFixed(0)}</strong>
                    </div>
                  </div>
                  <div className="reasonCard goodCard">
                    <span className="reasonLabel">왜 추천?</span>
                    <p>{etf.reason || "현재 시장 상태상 대안 접근용 ETF"}</p>
                  </div>
                  <div className="etfInfoGrid">
                    <div className="infoBox">
                      <span>특징</span>
                      <p>{etf.desc || "설명 없음"}</p>
                    </div>
                    <div className="infoBox">
                      <span>과거 성격</span>
                      <p>{etf.behavior || "행동 특성 정보 없음"}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="emptyBlock">추천 가능한 ETF가 아직 생성되지 않았습니다.</div>
              )}
            </div>
          </div>
        </section>

        <section className="sectorSection">
          <div className="sectionCard">
            <div className="sectionHeader">
              <div>
                <p className="sectionEyebrow">SECTOR VIEW</p>
                <h2>현재 상대적으로 포착되는 업종</h2>
                <p className="sectionDesc">상위 후보군 안에서 자주 포착되는 업종을 기준으로 강한 쪽을 간단히 참고할 수 있습니다.</p>
              </div>
            </div>
            <div className="sectorGrid">
              <div className="sectorCard goodCard">
                <span className="sectorLabel">상위에 자주 포착되는 업종</span>
                {topSectors?.strong?.length ? (
                  <div className="chipRow">
                    {topSectors.strong.map((sector) => (
                      <span className="smallChip good" key={sector}>{sector}</span>
                    ))}
                  </div>
                ) : (
                  <p className="emptyText">업종 데이터가 충분하지 않아 자동 분류를 생략했습니다.</p>
                )}
              </div>
              <div className="sectorCard warnCard">
                <span className="sectorLabel">해석 메모</span>
                <p className="sectorNote">
                  이 영역은 업종 뉴스 요약이 아니라, 현재 상위 후보들이 어느 쪽에 몰리는지를 참고하는 용도입니다.
                  업종 필드가 충분히 채워지면 이후 더 정교한 강약 해석으로 확장할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="todaySection">
          <div className="sectionCard">
            <div className="sectionHeader">
              <div>
                <p className="sectionEyebrow">TODAY PICK VS ALTERNATIVE</p>
                <h2>오늘의 1종목 vs 대안</h2>
                <p className="sectionDesc">개별주와 대안 접근을 동시에 보여줘서, 지금 어떤 방식이 더 적합한지 바로 판단할 수 있게 합니다.</p>
              </div>
            </div>
            <div className="todayGrid">
              <div className="todayCard stock">
                <span className="todayLabel">오늘의 1종목</span>
                {todayStock ? (
                  <>
                    <h3>{todayStock.name}</h3>
                    <p className="todayMeta">{todayStock.market} · {todayStock.code} · {todayStock.sector || "미분류"}</p>
                    <div className="metricMiniRow">
                      <div className="metricMiniBox">
                        <span>총점</span>
                        <strong>{Number(todayStock.totalScore || 0).toFixed(0)}점</strong>
                      </div>
                      <div className="metricMiniBox">
                        <span>상승여력</span>
                        <strong>{formatPercent(todayStock.upside)}</strong>
                      </div>
                      <div className="metricMiniBox">
                        <span>유동성</span>
                        <strong>{formatKrwCompact(todayStock.avgTradeValue5d)}</strong>
                      </div>
                    </div>
                    <div className="reasonCard goodCard">
                      <span className="reasonLabel">왜 지금 보는가</span>
                      <p>{todayStock.whyNow || todayStock.summary || "현재 기준으로 가장 균형이 좋은 종목입니다."}</p>
                    </div>
                    {todayStock.summary ? <p className="summaryText">{todayStock.summary}</p> : null}
                    <div className="actionRow">
                      <Link href={`/stock/${todayStock.code}`} className="primaryBtn">종목 상세 보기</Link>
                    </div>
                  </>
                ) : (
                  <p className="emptyText">오늘의 1종목 후보가 아직 생성되지 않았습니다.</p>
                )}
              </div>

              <div className="todayCard alt">
                <span className="todayLabel">오늘의 대안</span>
                {todayAlternative ? (
                  <>
                    <h3>{todayAlternative.label}</h3>
                    <div className="reasonCard warnCard">
                      <span className="reasonLabel">왜 이게 대안인가</span>
                      <p>{todayAlternative.reason}</p>
                    </div>
                    <p className="summaryText">
                      현재 시장 톤이 <strong>{header?.marketTone || "중립"}</strong>으로 판정되었기 때문에,
                      개별주 외에도 <strong>{todayAlternative.label}</strong> 관점으로 접근하는 편이 더 무난할 수 있습니다.
                    </p>
                    {etfRecommendations.length ? (
                      <div className="linkedEtfBox">
                        <span className="reasonLabel">함께 볼 ETF</span>
                        <p>{etfRecommendations[0].name}</p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="emptyText">오늘의 대안 접근이 아직 생성되지 않았습니다.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="memoSection">
          <div className="sectionCard">
            <div className="sectionHeader">
              <div>
                <p className="sectionEyebrow">STRATEGY NOTES</p>
                <h2>오늘 전략 메모</h2>
                <p className="sectionDesc">시장 상태 자동 판정 결과를 사람이 이해하기 쉽게 정리한 요약 메모입니다.</p>
              </div>
            </div>
            <div className="noteList">
              {strategyNotes.length ? strategyNotes.map((note, idx) => (
                <div className="noteItem" key={`note-${idx}`}>{note}</div>
              )) : <p className="emptyText">전략 메모가 아직 없습니다.</p>}
            </div>
            <p className="disclaimer">
              {marketState?.disclaimer || "본 결과는 참고용이며 특정 수익이나 매매를 보장하지 않습니다."}
            </p>
          </div>
        </section>
      </main>

      <style jsx>{`
        .container { max-width: 1180px; margin: 0 auto; padding: 32px 24px 80px; color: #0f172a; }
        .topLinks { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 26px; flex-wrap: wrap; }
        .homeBtn { display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; padding: 12px 16px; text-decoration: none; font-weight: 800; border: 1px solid #0f172a; background: #0f172a; color: #fff; }
        .pageHero { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
        .badge, .sectionEyebrow { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 0.82rem; font-weight: 800; margin: 0 0 18px; }
        h1 { margin: 0 0 12px; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.04em; }
        h2 { margin: 0 0 10px; font-size: 1.5rem; letter-spacing: -0.03em; }
        h3 { margin: 0 0 8px; font-size: 1.25rem; letter-spacing: -0.02em; }
        .desc { margin: 0; max-width: 760px; color: #475569; line-height: 1.8; font-size: 1.02rem; }
        .heroMetaCardWrap { display: grid; gap: 12px; min-width: 280px; width: 320px; }
        .heroMetaCard { border: 1px solid #e5e7eb; border-radius: 20px; padding: 18px; background: #fff; box-shadow: 0 14px 34px rgba(15,23,42,0.05); }
        .heroMetaCard.main { background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); }
        .metaLabel { display: block; margin-bottom: 8px; color: #64748b; font-size: .88rem; font-weight: 700; }
        .heroMetaCard strong { display: block; font-size: 1.35rem; letter-spacing: -0.03em; margin-bottom: 10px; }
        .toneChip { display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 999px; font-size: .8rem; font-weight: 800; }
        .toneChip.good { background:#ecfeff; color:#0891b2; }
        .toneChip.info { background:#e0f2fe; color:#0284c7; }
        .toneChip.warn { background:#fff7ed; color:#c2410c; }
        .toneChip.neutral { background:#f1f5f9; color:#475569; }
        .summarySection, .signalSection, .approachSection, .etfSection, .sectorSection, .todaySection, .memoSection { margin-top: 24px; }
        .sectionCard, .summaryCard { border: 1px solid #e5e7eb; border-radius: 28px; padding: 24px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); box-shadow: 0 20px 50px rgba(15,23,42,0.06); }
        .summaryHeader, .sectionHeader { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
        .sectionDesc { margin: 0; color: #64748b; line-height: 1.7; }
        .summaryLead { margin: 0; color: #0f172a; font-size: 1.08rem; line-height: 1.9; font-weight: 800; }
        .chipRow { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; }
        .chipRow.compact { margin-top: 0; margin-bottom: 8px; }
        .smallChip { display:inline-flex; align-items:center; justify-content:center; padding:7px 11px; border-radius:999px; font-size:.8rem; font-weight:800; }
        .smallChip.good { background:#ecfeff; color:#0891b2; }
        .smallChip.warn { background:#fff7ed; color:#c2410c; }
        .smallChip.neutral { background:#f1f5f9; color:#475569; }
        .smallChip.info { background:#e0f2fe; color:#0284c7; }
        .signalGrid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .signalItem, .scoreBox, .metricMiniBox, .noteItem, .infoBox { border:1px solid #e5e7eb; border-radius:18px; padding:16px; background:#fff; }
        .signalItem span, .scoreBox span, .metricMiniBox span, .infoBox span { display:block; margin-bottom:8px; color:#64748b; font-size:.84rem; font-weight:700; }
        .signalItem strong, .scoreBox strong, .metricMiniBox strong { font-size:1.05rem; letter-spacing:-0.02em; }
        .approachGrid, .sectorGrid, .todayGrid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .etfGrid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .approachItem, .sectorCard, .todayCard, .etfCard { border:1px solid #e5e7eb; border-radius:20px; padding:18px; background:#fff; }
        .approachTop, .etfTop { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
        .approachDesc, .sectorNote, .summaryText, .disclaimer, .emptyText, .etfCode { margin:0; color:#475569; line-height:1.75; }
        .etfCode { font-size:.92rem; }
        .statusBadge { display:inline-flex; align-items:center; justify-content:center; padding:7px 11px; border-radius:999px; font-size:.8rem; font-weight:800; }
        .statusBadge.good { background:#ecfeff; color:#0891b2; }
        .statusBadge.warn { background:#fff7ed; color:#c2410c; }
        .statusBadge.neutral { background:#f1f5f9; color:#475569; }
        .goodCard { background:#f8fbff; }
        .warnCard { background:#fffdfa; }
        .sectorLabel, .todayLabel, .reasonLabel { display:block; margin-bottom:10px; color:#0f172a; font-size:.84rem; font-weight:900; }
        .todayMeta { margin:0 0 12px; color:#64748b; font-size:.9rem; }
        .metricMiniRow, .etfInfoGrid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px; margin-bottom:12px; }
        .metricMiniRow { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .reasonCard { border:1px solid #e5e7eb; border-radius:16px; padding:14px; margin-bottom:12px; }
        .reasonCard p, .infoBox p { margin:0; color:#475569; line-height:1.75; }
        .actionRow { margin-top: 16px; display:flex; justify-content:flex-start; }
        .primaryBtn { display:inline-flex; align-items:center; justify-content:center; border-radius:14px; padding:12px 16px; text-decoration:none; font-weight:800; border:1px solid #0f172a; background:#0f172a; color:#fff; }
        .noteList { display:grid; gap:12px; }
        .disclaimer { margin-top:16px; color:#64748b; font-size:.92rem; }
        .linkedEtfBox { border:1px solid #e5e7eb; border-radius:16px; padding:14px; background:#f8fbff; margin-top:12px; }
        .linkedEtfBox p { margin:0; font-weight:800; color:#0f172a; }
        .scoreBox.narrow { min-width: 92px; text-align: center; }
        .emptyBlock { border:1px dashed #cbd5e1; border-radius:20px; padding:18px; color:#64748b; background:#fff; }
        @media (max-width: 1100px) {
          .etfGrid { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) {
          .signalGrid, .approachGrid, .sectorGrid, .todayGrid, .metricMiniRow, .etfInfoGrid { grid-template-columns: 1fr; }
          .heroMetaCardWrap { width:100%; min-width:0; }
        }
        @media (max-width: 640px) {
          .container { padding: 24px 18px 64px; }
          .pageHero { flex-direction:column; }
          .sectionCard, .summaryCard { padding:20px; }
        }
      `}</style>
    </>
  );
}
